import { app, BrowserWindow, clipboard, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { importPsdBuffer } from '@l2d/psd';
import { generateTextureAtlas } from '@l2d/renderer';
import { createRequire } from 'node:module';
import type { WasmModel } from '@l2d/schema/wasm-node';
import { startEditorBridge } from './editorBridge.js';
import { saveProjectFile } from './project-files.js';

const nodeWasm = createRequire(import.meta.url)('@l2d/schema/wasm-node') as typeof import('@l2d/schema/wasm-node');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let evaluatedProjectJson = '';
let evaluatedModel: WasmModel | null = null;
let parameterDefaults: Record<string, number> = {};
let previousParameterKeys: string[] = [];

function getAppIconPath(): string | undefined {
  const candidates = process.env.VITE_DEV_SERVER_URL
    ? [path.join(app.getAppPath(), 'public/app-icon.png')]
    : [
        path.join(__dirname, '../dist/app-icon.png'),
        path.join(app.getAppPath(), 'public/app-icon.png'),
      ];
  return candidates.find(candidate => fs.existsSync(candidate));
}

function createWindow() {
  const icon = getAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#141416',
    title: 'L2DEditor',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 10 },
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  startEditorBridge(mainWindow, json => { const model = new nodeWasm.WasmModel(json); model.free(); });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Do not retain a destroyed BrowserWindow across macOS hide/activate
  // cycles. Keeping this reference alive also keeps its renderer graph alive
  // until the next window is created.
  mainWindow.on('closed', () => {
    mainWindow = null;
    evaluatedModel?.free();
    evaluatedModel = null;
    evaluatedProjectJson = '';
    previousParameterKeys = [];
  });
}

function getAgentSetupInfo() {
  const candidates = [
    path.resolve(app.getAppPath(), '../..'),
    path.resolve(process.cwd(), '../..'),
    process.cwd(),
    path.resolve(app.getAppPath(), '..'),
    app.getAppPath(),
  ];
  const repoRoot = candidates.find(candidate =>
    fs.existsSync(path.join(candidate, 'skills/l2deditor-mcp/SKILL.md')) &&
    fs.existsSync(path.join(candidate, 'packages/mcp-server/package.json')),
  ) ?? candidates[0];
  const port = Number(process.env.L2D_EDITOR_PORT ?? 22033);
  const mcpServerPath = path.join(repoRoot, 'packages/mcp-server/dist/bin.js');

  return {
    repoRoot,
    mcpServerPath,
    mcpServerBuilt: fs.existsSync(mcpServerPath),
    editorUrl: `ws://127.0.0.1:${Number.isInteger(port) ? port : 22033}`,
    skills: [
      {
        id: 'l2deditor-mcp' as const,
        path: path.join(repoRoot, 'skills/l2deditor-mcp'),
        required: true,
      },
      {
        id: 'live2d-model-building' as const,
        path: path.join(repoRoot, 'skills/live2d-model-building'),
        required: false,
      },
    ],
  };
}

app.whenReady().then(() => {
  const icon = getAppIconPath();
  if (process.platform === 'darwin' && app.dock && icon) app.dock.setIcon(icon);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('l2d:get-system-locale', () => {
  return app.getLocale() || 'en';
});

ipcMain.handle('l2d:get-agent-setup-info', () => getAgentSetupInfo());

ipcMain.handle('l2d:copy-text', (_, text: unknown) => {
  if (typeof text !== 'string' || text.length > 100_000) throw new Error('Invalid clipboard text');
  clipboard.writeText(text);
});

ipcMain.handle('l2d:evaluate-frame', (_, projectJson: string, parameters: Record<string, number>) => {
  if (!evaluatedModel || projectJson !== evaluatedProjectJson) {
    const nextModel = new nodeWasm.WasmModel(projectJson);
    evaluatedModel?.free();
    evaluatedModel = nextModel;
    evaluatedProjectJson = projectJson;
    parameterDefaults = Object.fromEntries(JSON.parse(projectJson).parameters.map((p: { id: string; default: number }) => [p.id, p.default]));
    previousParameterKeys = [];
  }
  for (const key of previousParameterKeys) evaluatedModel.setParameter(key, 0);
  for (const [key, value] of Object.entries(parameterDefaults)) evaluatedModel.setParameter(key, value);
  for (const [key, value] of Object.entries(parameters)) evaluatedModel.setParameter(key, value);
  previousParameterKeys = Object.keys(parameters);
  return evaluatedModel.evaluate();
});

ipcMain.handle('l2d:read-texture', async (_, projectPath: string, texturePath: string) => {
  const fullPath = path.isAbsolute(texturePath) ? texturePath : path.resolve(path.dirname(projectPath), texturePath);
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  };
  const mimeType = mimeTypes[path.extname(fullPath).toLowerCase()];
  if (!mimeType) throw new Error('Unsupported texture format');
  const buffer = await fs.promises.readFile(fullPath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
});

ipcMain.handle('l2d:open-project-dialog', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open L2DEditor Project',
    properties: ['openDirectory', 'openFile'],
    filters: [{ name: 'L2D Project', extensions: ['json', 'l2dproj'] }],
  });
  if (canceled || filePaths.length === 0) return null;

  let target = filePaths[0];
  if (fs.statSync(target).isDirectory()) {
    target = path.join(target, 'project.json');
  }
  if (fs.existsSync(target)) {
    const content = fs.readFileSync(target, 'utf-8');
    return { path: target, content };
  }
  return null;
});

ipcMain.handle('l2d:save-project', async (_, filePath: string, content: string, sourcePath?: string) => {
  try {
    const saved = await saveProjectFile(filePath, content, sourcePath);
    return { path: filePath, content: saved, success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
});

ipcMain.handle('l2d:save-project-as-dialog', async (_, content: string, defaultName?: string, sourcePath?: string) => {
  if (!mainWindow) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project As',
    defaultPath: defaultName || 'project.json',
    filters: [
      { name: 'L2D Project JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return null;

  try {
    const saved = await saveProjectFile(filePath, content, sourcePath);
    return { path: filePath, content: saved, success: true };
  } catch (err: any) {
    console.error('Failed to save project:', err);
    return { error: err.message || String(err), success: false };
  }
});

ipcMain.handle('l2d:import-psd-dialog', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Photoshop (.psd) File',
    filters: [{ name: 'Photoshop Document', extensions: ['psd'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return null;

  const psdPath = filePaths[0];
  const outDir = path.join(path.dirname(psdPath), `${path.basename(psdPath, '.psd')}.l2dproj`);

  try {
    const buf = fs.readFileSync(psdPath);
    const { project, extractedTextures } = await importPsdBuffer(buf, { meshDensity: 2 });

    fs.mkdirSync(outDir, { recursive: true });
    const texDir = path.join(outDir, 'textures');
    fs.mkdirSync(texDir, { recursive: true });

    for (const t of extractedTextures) {
      fs.writeFileSync(path.join(texDir, t.filename), t.buffer);
    }

    const projPath = path.join(outDir, 'project.json');
    const projectContent = JSON.stringify(project, null, 2);
    fs.writeFileSync(projPath, projectContent, 'utf-8');

    return { outputPath: projPath, projectContent };
  } catch (err) {
    console.error('Failed to import PSD:', err);
    return null;
  }
});

ipcMain.handle('l2d:generate-atlas', async (_, project: any, atlasSize: number, padding: number) => {
  try {
    const textureResolver = (textureId: string): Buffer | null => {
      const meta = project.textures?.find((t: any) => t.id === textureId);
      if (!meta) return null;
      if (fs.existsSync(meta.path)) {
        return fs.readFileSync(meta.path);
      }
      return null;
    };

    const res = await generateTextureAtlas(project, textureResolver, atlasSize, padding);
    const atlasList = res.atlasPngBuffers.map((b) => ({
      id: b.id,
      filename: b.filename,
      base64: b.buffer.toString('base64'),
    }));

    return {
      updatedProject: res.updatedProject,
      atlasList,
    };
  } catch (err) {
    console.error('Failed to generate texture atlas:', err);
    return null;
  }
});
