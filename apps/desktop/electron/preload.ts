import { contextBridge, ipcRenderer } from 'electron';

export interface L2DApi {
  getSystemLocale: () => Promise<string>;
  openProjectDialog: () => Promise<{ path: string; content: string } | null>;
  saveProject: (filePath: string, content: string) => Promise<boolean>;
  saveProjectAsDialog: (content: string, defaultName?: string) => Promise<{ path?: string; success: boolean; error?: string } | null>;
  importPsdDialog: () => Promise<{ outputPath: string; projectContent: string } | null>;
}

const api: L2DApi = {
  getSystemLocale: () => ipcRenderer.invoke('l2d:get-system-locale'),
  openProjectDialog: () => ipcRenderer.invoke('l2d:open-project-dialog'),
  saveProject: (filePath, content) => ipcRenderer.invoke('l2d:save-project', filePath, content),
  saveProjectAsDialog: (content, defaultName) => ipcRenderer.invoke('l2d:save-project-as-dialog', content, defaultName),
  importPsdDialog: () => ipcRenderer.invoke('l2d:import-psd-dialog'),
};

contextBridge.exposeInMainWorld('l2dApi', api);
