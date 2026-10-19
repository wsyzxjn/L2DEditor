import { contextBridge, ipcRenderer } from 'electron';
import type { EvaluatedFrameJs, Project } from '@l2d/schema';
import type { EditorRequestMessage, EditorResponseMessage } from '@l2d/mcp-server/editor-protocol';
import type { AppUpdateState } from './update-service.js';

export type { AppUpdateState } from './update-service.js';

export interface SaveProjectResult {
  path?: string;
  content?: string;
  success: boolean;
  error?: string;
}

export type OpenProjectResult =
  | { success: true; path: string; content: string }
  | { success: false; error: string }
  | null;

export type ImportPsdResult =
  | { success: true; outputPath: string; projectContent: string }
  | { success: false; error: string }
  | null;

export interface AtlasTextureResult {
  id: string;
  filename: string;
  base64: string;
}

export type GenerateAtlasResult =
  | { success: true; updatedProject: Project; atlasList: AtlasTextureResult[] }
  | { success: false; error: string };

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
  editorTokenPath: string;
  skills: AgentSkillInfo[];
}

export interface L2DApi {
  onEditorRequest: (handler: (message: EditorRequestMessage) => void) => () => void;
  respondToEditor: (message: EditorResponseMessage) => void;
  syncEditorState: (state: {
    project?: Project;
    parameters?: Record<string, number>;
    dirty?: boolean;
  }) => void;
  getSystemLocale: () => Promise<string>;
  getAgentSetupInfo: () => Promise<AgentSetupInfo>;
  copyText: (text: string) => Promise<void>;
  readTexture: (projectPath: string, texturePath: string) => Promise<string>;
  setEvaluationProject: (projectJson: string, revision: number) => Promise<void>;
  evaluateFrame: (revision: number, parameters: Record<string, number>) => Promise<EvaluatedFrameJs>;
  openProjectDialog: () => Promise<OpenProjectResult>;
  saveProject: (filePath: string, content: string, sourcePath?: string) => Promise<SaveProjectResult>;
  saveProjectAsDialog: (content: string, defaultName?: string, sourcePath?: string) => Promise<SaveProjectResult | null>;
  importPsdDialog: () => Promise<ImportPsdResult>;
  generateAtlas: (
    project: Project,
    atlasSize: number,
    padding: number,
    projectPath?: string,
  ) => Promise<GenerateAtlasResult>;
  getUpdateState: () => Promise<AppUpdateState>;
  onUpdateState: (handler: (state: AppUpdateState) => void) => () => void;
  checkForUpdates: () => Promise<AppUpdateState>;
  downloadUpdate: () => Promise<AppUpdateState>;
  installUpdate: () => void;
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
  setEvaluationProject: (projectJson, revision) => ipcRenderer.invoke('l2d:set-evaluation-project', projectJson, revision),
  evaluateFrame: (revision, parameters) => ipcRenderer.invoke('l2d:evaluate-frame', revision, parameters),
  openProjectDialog: () => ipcRenderer.invoke('l2d:open-project-dialog'),
  saveProject: (filePath, content, sourcePath) => ipcRenderer.invoke('l2d:save-project', filePath, content, sourcePath),
  saveProjectAsDialog: (content, defaultName, sourcePath) => ipcRenderer.invoke('l2d:save-project-as-dialog', content, defaultName, sourcePath),
  importPsdDialog: () => ipcRenderer.invoke('l2d:import-psd-dialog'),
  generateAtlas: (project, atlasSize, padding, projectPath) =>
    ipcRenderer.invoke('l2d:generate-atlas', project, atlasSize, padding, projectPath),
  getUpdateState: () => ipcRenderer.invoke('l2d:update-get-state'),
  onUpdateState: handler => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppUpdateState) => handler(state);
    ipcRenderer.on('l2d:update-state', listener);
    return () => { ipcRenderer.removeListener('l2d:update-state', listener); };
  },
  checkForUpdates: () => ipcRenderer.invoke('l2d:update-check'),
  downloadUpdate: () => ipcRenderer.invoke('l2d:update-download'),
  installUpdate: () => ipcRenderer.send('l2d:update-install'),
};

contextBridge.exposeInMainWorld('l2dApi', api);
