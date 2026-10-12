import { contextBridge, ipcRenderer } from "electron";
const api = {
  openProjectDialog: () => ipcRenderer.invoke("l2d:open-project-dialog"),
  saveProject: (filePath, content) => ipcRenderer.invoke("l2d:save-project", filePath, content),
  importPsdDialog: () => ipcRenderer.invoke("l2d:import-psd-dialog")
};
contextBridge.exposeInMainWorld("l2dApi", api);
