import { contextBridge as r, ipcRenderer as o } from "electron";
const a = {
  openProjectDialog: () => o.invoke("l2d:open-project-dialog"),
  saveProject: (e, i) => o.invoke("l2d:save-project", e, i),
  saveProjectAsDialog: (e, i) => o.invoke("l2d:save-project-as-dialog", e, i),
  importPsdDialog: () => o.invoke("l2d:import-psd-dialog")
};
r.exposeInMainWorld("l2dApi", a);
