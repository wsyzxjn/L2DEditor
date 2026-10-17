import { contextBridge, ipcRenderer } from 'electron';
import type { EvaluatedFrameJs, Project } from '@l2d/schema';
import type { EditorRequestMessage, EditorResponseMessage } from '@l2d/mcp-server/editor-protocol';

export interface SaveProjectResult {
  path?: string;
  content?: string;
  success: boolean;
  error?: string;
}

export interface AgentSkillInfo {
  id: 'l2deditor-mcp' | 'live2d-model-building';
  path: string;
  required: boolean;
}

export interface AgentSetupInfo {
  repoRoot: string;
  mcpServerPath: string;
  mcpServerBuilt: boolean;
  editorUrl: string;
  skills: AgentSkillInfo[];
}

export interface L2DApi {
  onEditorRequest: (handler: (message: EditorRequestMessage) => void) => () => void;
  respondToEditor: (message: EditorResponseMessage) => void;
  syncEditorState: (state: { project?: Project; parameters?: Record<string, number> }) => void;
  getSystemLocale: () => Promise<string>;
  getAgentSetupInfo: () => Promise<AgentSetupInfo>;
  copyText: (text: string) => Promise<void>;
  readTexture: (projectPath: string, texturePath: string) => Promise<string>;
  evaluateFrame: (projectJson: string, parameters: Record<string, number>) => Promise<EvaluatedFrameJs>;
  openProjectDialog: () => Promise<{ path: string; content: string } | null>;
  saveProject: (filePath: string, content: string, sourcePath?: string) => Promise<SaveProjectResult>;
  saveProjectAsDialog: (content: string, defaultName?: string, sourcePath?: string) => Promise<SaveProjectResult | null>;
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
  getAgentSetupInfo: () => ipcRenderer.invoke('l2d:get-agent-setup-info'),
  copyText: text => ipcRenderer.invoke('l2d:copy-text', text),
  readTexture: (projectPath, texturePath) => ipcRenderer.invoke('l2d:read-texture', projectPath, texturePath),
  evaluateFrame: (projectJson, parameters) => ipcRenderer.invoke('l2d:evaluate-frame', projectJson, parameters),
  openProjectDialog: () => ipcRenderer.invoke('l2d:open-project-dialog'),
  saveProject: (filePath, content, sourcePath) => ipcRenderer.invoke('l2d:save-project', filePath, content, sourcePath),
  saveProjectAsDialog: (content, defaultName, sourcePath) => ipcRenderer.invoke('l2d:save-project-as-dialog', content, defaultName, sourcePath),
  importPsdDialog: () => ipcRenderer.invoke('l2d:import-psd-dialog'),
};

contextBridge.exposeInMainWorld('l2dApi', api);
