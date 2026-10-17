import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { editorRequestSchema, editorRequestSchemas, type EditorRequest } from './editor-protocol.js';

const definitions: { name: string; action: EditorRequest['action']; description: string; readOnly?: boolean; idempotent?: boolean }[] = [
  { name: 'l2d_gui_state', action: 'state', description: 'Inspect the running desktop editor: current file, node page, parameters, selection, viewport, timeline and undo stack. Start here before GUI operations.', readOnly: true },
  { name: 'l2d_gui_open_project', action: 'open_project', description: 'Open a project.json or .l2dproj directory in the running desktop window. Replaces the current document, as the GUI Open operation does.', idempotent: true },
  { name: 'l2d_gui_select', action: 'select', description: 'Select existing node IDs in the GUI hierarchy and inspector. Pass an empty array to clear selection.', idempotent: true },
  { name: 'l2d_gui_set_parameters', action: 'set_parameters', description: 'Set live preview parameter values in the GUI. Validates IDs and ranges atomically; does not change keyforms or save the document.', idempotent: true },
  { name: 'l2d_gui_viewport', action: 'viewport', description: 'Fit, zoom, pan or flip the live viewport; set solo, mesh editing, physics, auto idle and grid snapping using the GUI controls.', idempotent: true },
  { name: 'l2d_gui_playback', action: 'playback', description: 'Choose an existing animation, seek to a frame, play or pause the GUI timeline. Seeking evaluates its parameter tracks.', idempotent: true },
  { name: 'l2d_gui_expression', action: 'expression', description: 'Preview a named expression using the model evaluator. Pass expressionId:null to clear it. Use GUI state to list available expressions.', idempotent: true },
  { name: 'l2d_gui_show_panel', action: 'show_panel', description: 'Activate a desktop panel tab (parameters, hierarchy, viewport, inspector, timeline, physics or history).', idempotent: true },
  { name: 'l2d_gui_exec', action: 'exec', description: 'Execute an existing Command Bus command on the document open in the GUI, using the same undo stack as mouse edits. Supports dryRun without changes.' },
  { name: 'l2d_gui_history', action: 'history', description: 'Undo, redo or jump to an undo-stack index in the running GUI. Use l2d_gui_state to inspect the stack first.' },
  { name: 'l2d_gui_save', action: 'save', description: 'Save the open GUI document to its current path, or an explicit JSON path. Does not copy relative texture assets to a new directory.', idempotent: true },
  { name: 'l2d_gui_screenshot', action: 'screenshot', description: 'Capture a PNG after preview rendering is ready. target:window includes GUI controls; target:model exports the clean model canvas from Pixi at the requested scale.', readOnly: true },
];

export function registerEditorTools(server: McpServer, url?: string): void {
  for (const definition of definitions) {
    const schema = editorRequestSchemas[definition.action] as z.ZodObject;
    server.registerTool(definition.name, {
      description: definition.description,
      inputSchema: schema.omit({ action: true }),
      annotations: { readOnlyHint: definition.readOnly ?? false, destructiveHint: definition.action === 'open_project' || definition.action === 'save', idempotentHint: definition.idempotent ?? definition.readOnly ?? false, openWorldHint: false },
    }, async (args: Record<string, unknown>) => {
      try {
        const result = await callEditorTool(definition.name, args, url);
        if (!result) throw new Error('Unknown GUI tool');
        return result;
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] };
      }
    });
  }
}

/** Reuse the editor's loopback WebSocket endpoint; no second server or edit engine. */
export function callDesktopEditor(request: EditorRequest, url = process.env.L2D_EDITOR_URL ?? 'ws://127.0.0.1:22033'): Promise<Record<string, unknown>> {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
    throw new Error('L2D_EDITOR_URL must be a loopback ws:// URL');
  }
  const parsed = editorRequestSchema.parse(request);
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const socket = new WebSocket(url);
    const timer = setTimeout(() => finish(new Error('Desktop request timed out. Open L2DEditor and try again.')), 15000);
    let finished = false;
    function finish(error?: Error, result?: Record<string, unknown>) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (socket.readyState === WebSocket.CONNECTING) socket.terminate();
      else socket.close();
      if (error) reject(error);
      else resolve(result ?? {});
    }
    socket.once('open', () => socket.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'l2d.editor', params: parsed })));
    socket.on('message', data => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id !== id) return;
        if (response.error) finish(new Error(response.error.message));
        else if (!response.result || typeof response.result !== 'object' || Array.isArray(response.result)) finish(new Error('Invalid desktop response'));
        else finish(undefined, response.result);
      } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    });
    socket.once('error', () => finish(new Error(`Cannot connect to the desktop editor at ${url}. Start L2DEditor; its default port is 22033.`)));
    socket.once('close', () => { if (!finished) finish(new Error('Desktop connection closed before responding')); });
  });
}

export async function callEditorTool(name: string, args: Record<string, unknown> | undefined, url?: string): Promise<CallToolResult | null> {
  const definition = definitions.find(tool => tool.name === name);
  if (!definition) return null;
  const request = editorRequestSchema.parse({ ...args, action: definition.action });
  const result = await callDesktopEditor(request, url);
  if (definition.action === 'screenshot') {
    if (typeof result.data !== 'string') throw new Error('Desktop screenshot is unavailable');
    return { content: [{ type: 'image', mimeType: 'image/png', data: result.data }] };
  }
  return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
}
