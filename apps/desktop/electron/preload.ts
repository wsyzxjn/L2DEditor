import { contextBridge, ipcRenderer } from 'electron';
import type { EvaluatedFrameJs, Project } from '@l2d/schema';
import type { EditorRequestMessage, EditorResponseMessage } from '@l2d/mcp-server/editor-protocol';

export interface L2DApi {
  onEditorRequest: (handler: (message: EditorRequestMessage) => void) => () => void;
  respondToEditor: (message: EditorResponseMessage) => void;
  syncEditorState: (state: { project?: Project; parameters?: Record<string, number> }) => void;
  getSystemLocale: () => Promise<string>;
  readTexture: (projectPath: string, texturePath: string) => Promise<string>;
  evaluateFrame: (projectJson: string, parameters: Record<string, number>) => Promise<EvaluatedFrameJs>;
  openProjectDialog: () => Promise<{ path: string; content: string } | null>;
  saveProject: (filePath: string, content: string) => Promise<boolean>;
  saveProjectAsDialog: (content: string, defaultName?: string) => Promise<{ path?: string; success: boolean; error?: string } | null>;
  importPsdDialog: () => Promise<{ outputPath: string; projectContent: string } | null>;
}

const api: L2DApi = {
  onEditorRequest: handler => {
    const listener = (_event: Electron.IpcRendererEvent, message: EditorRequestMessage) => handler(message);
    ipcRenderer.on('l2d:editor-request', listener);
    return () => { ipcRenderer.removeListener('l2d:editor-request', listener); };
  },
  respondToEditor: message => ipcRenderer.send('l2d:editor-response', message),
  syncEditorState: state => ipcRenderer.send('l2d:editor-state', state),
  getSystemLocale: () => ipcRenderer.invoke('l2d:get-system-locale'),
  readTexture: (projectPath, texturePath) => ipcRenderer.invoke('l2d:read-texture', projectPath, texturePath),
  evaluateFrame: (projectJson, parameters) => ipcRenderer.invoke('l2d:evaluate-frame', projectJson, parameters),
  openProjectDialog: () => ipcRenderer.invoke('l2d:open-project-dialog'),
  saveProject: (filePath, content) => ipcRenderer.invoke('l2d:save-project', filePath, content),
  saveProjectAsDialog: (content, defaultName) => ipcRenderer.invoke('l2d:save-project-as-dialog', content, defaultName),
  importPsdDialog: () => ipcRenderer.invoke('l2d:import-psd-dialog'),
};

contextBridge.exposeInMainWorld('l2dApi', api);
