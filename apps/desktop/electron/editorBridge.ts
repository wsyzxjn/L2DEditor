import { ipcMain, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Project } from '@l2d/schema';
import { startCubismWebSocketServer } from '@l2d/mcp-server/websocket';
import type { EditorRequest, RendererEditorRequest, EditorResponseMessage } from '@l2d/mcp-server/editor-protocol';

export function startEditorBridge(window: BrowserWindow, validateProject: (json: string) => void): void {
  let project: Project | null = null;
  let parameters: Record<string, number> = {};
  const pending = new Map<string, { resolve: (result: Record<string, unknown>) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const requestRenderer = (request: RendererEditorRequest): Promise<Record<string, unknown>> => new Promise((resolve, reject) => {
    if (window.isDestroyed()) { reject(new Error('The editor window is closed')); return; }
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('The desktop UI did not respond. Open the main editor window and try again.'));
    }, 10000);
    pending.set(id, { resolve, reject, timer });
    window.webContents.send('l2d:editor-request', { id, request });
  });

  const onResponse = (event: Electron.IpcMainEvent, response: EditorResponseMessage) => {
    if (event.sender !== window.webContents) return;
    const entry = pending.get(response.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(response.id);
    if (response.error) entry.reject(new Error(response.error));
    else entry.resolve(response.result ?? {});
  };
  const onState = (event: Electron.IpcMainEvent, state: { project?: Project; parameters?: Record<string, number> }) => {
    if (event.sender !== window.webContents) return;
    if (state.project) { project = state.project; parameters = {}; }
    if (state.parameters) parameters = state.parameters;
  };
  ipcMain.on('l2d:editor-response', onResponse);
  ipcMain.on('l2d:editor-state', onState);

  const handleRequest = async (request: EditorRequest): Promise<Record<string, unknown>> => {
    if (request.action === 'open_project') {
      let target = path.resolve(request.path);
      if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'project.json');
      const content = await fs.readFile(target, 'utf8');
      // The same Rust parser used for viewport evaluation validates before replacing the document.
      validateProject(content);
      const loaded: Project = JSON.parse(content);
      return requestRenderer({ action: 'load_project', path: target, project: loaded });
    }
    if (request.action === 'screenshot') {
      if (request.target === 'model') return requestRenderer({ action: 'capture_model', scale: request.scale });
      await requestRenderer({ action: 'wait_for_preview' });
      const image = await window.webContents.capturePage();
      return { mimeType: 'image/png', data: image.toPNG().toString('base64'), ...image.getSize() };
    }
    if (request.action === 'save' && request.path) return requestRenderer({ ...request, path: path.resolve(request.path) });
    return requestRenderer(request);
  };
  // Requests from different clients still share one document and one undo stack.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = (request: EditorRequest) => {
    const task = queue.then(() => handleRequest(request));
    queue = task.catch(() => {});
    return task;
  };
  const port = Number(process.env.L2D_EDITOR_PORT ?? 22033);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid L2D_EDITOR_PORT');
  const server = startCubismWebSocketServer({
    port,
    getProject: () => { if (!project) throw new Error('Desktop UI is not ready'); return project; },
    getParameterValues: () => parameters,
    setParameterValues: async values => { await enqueue({ action: 'set_parameters', values }); },
    handleEditorRequest: enqueue,
  });
  window.once('closed', () => {
    ipcMain.removeListener('l2d:editor-response', onResponse);
    ipcMain.removeListener('l2d:editor-state', onState);
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('The editor window closed')); }
    pending.clear();
    for (const client of server.clients) client.terminate();
    server.close();
  });
}
