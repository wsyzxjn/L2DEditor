import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { importPsdBuffer } from '@l2d/psd';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#141416',
    title: 'L2DEditor',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

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
  });
}

app.whenReady().then(() => {
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

ipcMain.handle('l2d:save-project', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save project:', err);
    return false;
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
