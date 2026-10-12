import { contextBridge, ipcRenderer } from 'electron';

export interface L2DApi {
  openProjectDialog: () => Promise<{ path: string; content: string } | null>;
  saveProject: (filePath: string, content: string) => Promise<boolean>;
  importPsdDialog: () => Promise<{ outputPath: string; projectContent: string } | null>;
}

const api: L2DApi = {
  openProjectDialog: () => ipcRenderer.invoke('l2d:open-project-dialog'),
  saveProject: (filePath, content) => ipcRenderer.invoke('l2d:save-project', filePath, content),
  importPsdDialog: () => ipcRenderer.invoke('l2d:import-psd-dialog'),
};

contextBridge.exposeInMainWorld('l2dApi', api);
