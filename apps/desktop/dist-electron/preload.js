import { contextBridge as p, ipcRenderer as o } from "electron";
const r = {
  openProjectDialog: () => o.invoke("l2d:open-project-dialog"),
  saveProject: (e, i) => o.invoke("l2d:save-project", e, i),
  importPsdDialog: () => o.invoke("l2d:import-psd-dialog")
};
p.exposeInMainWorld("l2dApi", r);
