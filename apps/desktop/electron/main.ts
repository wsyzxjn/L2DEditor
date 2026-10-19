import { app, BrowserWindow, clipboard, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { importPsdBuffer } from '@l2d/psd';
import { generateTextureAtlas } from '@l2d/renderer';
import { createRequire } from 'node:module';
import type { WasmModel } from '@l2d/schema/wasm-node';
import { getEditorBridgeTokenPath, startEditorBridge } from './editorBridge.js';
import { saveProjectFile } from './project-files.js';
import { createDesktopUpdateService } from './update-service.js';

const nodeWasm = createRequire(import.meta.url)('@l2d/schema/wasm-node') as typeof import('@l2d/schema/wasm-node');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let evaluatedRevision = -1;
let evaluatedModel: WasmModel | null = null;
let parameterDefaults: Record<string, number> = {};
let previousParameterKeys: string[] = [];
const allowedExternalTextures = new Set<string>();
const desktopUpdates = createDesktopUpdateService(() => mainWindow);

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function isWithinDirectory(filePath: string, directory: string): boolean {
  const relative = path.relative(directory, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveTextureFile(projectPath: unknown, texturePath: unknown): Promise<string> {
  assertString(texturePath, 'Texture path');
  if (projectPath !== undefined) assertString(projectPath, 'Project path');
  if (!projectPath && !path.isAbsolute(texturePath)) {
    throw new Error('Relative texture paths require a saved project path');
  }

  const projectTarget = projectPath ? path.resolve(projectPath) : null;
  const projectStat = projectTarget ? await fs.promises.stat(projectTarget) : null;
  const baseDirectory = projectTarget && projectStat?.isDirectory()
    ? projectTarget
    : projectTarget
      ? path.dirname(projectTarget)
      : process.cwd();
  const baseReal = await fs.promises.realpath(baseDirectory);
  const requested = path.isAbsolute(texturePath)
    ? path.resolve(texturePath)
    : path.resolve(baseDirectory, texturePath);
  const resolved = await fs.promises.realpath(requested);
  if (!isWithinDirectory(resolved, baseReal) && !allowedExternalTextures.has(resolved)) {
    if (!mainWindow) throw new Error('Cannot confirm an external texture without an editor window');
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'External texture access',
      message: 'Allow this project to read an external texture?',
      detail: resolved,
      buttons: ['Allow', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (response.response !== 0) throw new Error(`External texture access denied: ${resolved}`);
    allowedExternalTextures.add(resolved);
  }
  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile()) throw new Error(`Texture is not a file: ${resolved}`);
  if (stat.size > 256 * 1024 * 1024) throw new Error(`Texture is too large: ${resolved}`);
  return resolved;
}

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

  void startEditorBridge(mainWindow, json => { const model = new nodeWasm.WasmModel(json); model.free(); });

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
    evaluatedRevision = -1;
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
    editorTokenPath: getEditorBridgeTokenPath(),
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
  desktopUpdates.start();

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

ipcMain.handle('l2d:update-get-state', () => desktopUpdates.getState());
ipcMain.handle('l2d:update-check', () => desktopUpdates.checkForUpdates());
ipcMain.handle('l2d:update-download', () => desktopUpdates.downloadUpdate());
ipcMain.on('l2d:update-install', () => desktopUpdates.installUpdate());

ipcMain.handle('l2d:copy-text', (_, text: unknown) => {
  if (typeof text !== 'string' || text.length > 100_000) throw new Error('Invalid clipboard text');
  clipboard.writeText(text);
});

// The project is uploaded once per revision; per-frame evaluation only sends parameters,
// so playback does not re-transfer (and re-compare) multi-megabyte project JSON every frame.
ipcMain.handle('l2d:set-evaluation-project', (_, projectJson: string, revision: number) => {
  const nextModel = new nodeWasm.WasmModel(projectJson);
  evaluatedModel?.free();
  evaluatedModel = nextModel;
  evaluatedRevision = revision;
  parameterDefaults = Object.fromEntries(JSON.parse(projectJson).parameters.map((p: { id: string; default: number }) => [p.id, p.default]));
  previousParameterKeys = [];
});

ipcMain.handle('l2d:evaluate-frame', (_, revision: number, parameters: Record<string, number>) => {
  if (!evaluatedModel || revision !== evaluatedRevision) throw new Error(`Evaluation project revision ${revision} is not loaded`);
  for (const key of previousParameterKeys) evaluatedModel.setParameter(key, 0);
  for (const [key, value] of Object.entries(parameterDefaults)) evaluatedModel.setParameter(key, value);
  for (const [key, value] of Object.entries(parameters)) evaluatedModel.setParameter(key, value);
  previousParameterKeys = Object.keys(parameters);
  return evaluatedModel.evaluate();
});

ipcMain.handle('l2d:read-texture', async (_, projectPath: string, texturePath: string) => {
  const fullPath = await resolveTextureFile(projectPath, texturePath);
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
    return { success: true, path: target, content };
  }
  return { success: false, error: `No project.json found in ${path.dirname(target)}` };
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

    return { success: true, outputPath: projPath, projectContent };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle('l2d:generate-atlas', async (
  _,
  project: any,
  atlasSize: unknown,
  padding: unknown,
  projectPath?: unknown,
) => {
  try {
    if (!project || !Array.isArray(project.textures) || !Array.isArray(project.nodes)) {
      throw new Error('Atlas generation requires a project with textures and nodes');
    }
    if (typeof atlasSize !== 'number' || !Number.isInteger(atlasSize) || atlasSize < 64 || atlasSize > 16384) {
      throw new Error('Atlas size must be an integer between 64 and 16384');
    }
    if (typeof padding !== 'number' || !Number.isInteger(padding) || padding < 0 || padding > 64) {
      throw new Error('Atlas padding must be an integer between 0 and 64');
    }
    const textureBuffers = new Map<string, Buffer>();
    for (const meta of project.textures) {
      if (typeof meta?.id !== 'string' || typeof meta?.path !== 'string') {
        throw new Error('Project contains an invalid texture entry');
      }
      textureBuffers.set(meta.id, await fs.promises.readFile(await resolveTextureFile(projectPath, meta.path)));
    }
    const textureResolver = (textureId: string): Buffer | null => textureBuffers.get(textureId) ?? null;

    const res = await generateTextureAtlas(project, textureResolver, atlasSize, padding);
    const atlasList = res.atlasPngBuffers.map((b) => ({
      id: b.id,
      filename: b.filename,
      base64: b.buffer.toString('base64'),
    }));

    return {
      success: true,
      updatedProject: res.updatedProject,
      atlasList,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
});
