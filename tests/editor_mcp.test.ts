import { describe, it, expect } from 'vitest';
import { Client } from '../packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { InMemoryTransport } from '../packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';
import { createMcpServer, startCubismWebSocketServer, WebSocket } from '../packages/mcp-server/dist/index.js';
import { callDesktopEditor } from '../packages/mcp-server/dist/editor-tools.js';
import type { Project } from '../packages/schema/dist/index.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('desktop MCP bridge', () => {
  it('discovers GUI tools, dispatches through WebSocket and reports validation errors without dispatch', async () => {
    const project: Project = { format_version: 1, canvas: { width: 100, height: 100, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' }, nodes: [], keyforms: [], parameters: [], textures: [] };
    const requests: unknown[] = [];
    const websocket = startCubismWebSocketServer({ port: 0, getProject: () => project, getParameterValues: () => ({}), setParameterValues: () => {}, handleEditorRequest: async request => { requests.push(request); return { action: request.action, selectedNodeIds: [] }; } });
    await new Promise<void>((resolve, reject) => { websocket.once('listening', resolve); websocket.once('error', reject); });
    const address = websocket.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    const url = `ws://127.0.0.1:${address.port}`;
    const server = createMcpServer({ editorUrl: url });
    const client = new Client({ name: 'gui-regression', version: '1.0.0' });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const tools = await client.listTools();
      expect(tools.tools.filter(tool => tool.name.startsWith('l2d_gui_'))).toHaveLength(12);
      expect(tools.tools.some(tool => tool.name === 'l2d_exec_command')).toBe(true);
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'l2d-mcp-legacy-'));
      const projectPath = path.join(directory, 'project.json');
      fs.writeFileSync(projectPath, JSON.stringify(project));
      try {
        const edit = await client.callTool({ name: 'l2d_exec_command', arguments: { projectPath, command: { id: 'parameter-create', name: 'parameter.add', params: { id: 'ParamTest', min: 0, max: 1, default: 0 } }, dryRun: true } });
        expect(edit.isError).not.toBe(true);
        const block = edit.content as { type: string; text?: string }[];
        const preview = JSON.parse(block.find(item => item.type === 'text')?.text ?? '{}');
        expect(preview.success).toBe(true);
        expect(preview.patches[0].value.id).toBe('ParamTest');
        expect(JSON.parse(fs.readFileSync(projectPath, 'utf8')).parameters).toEqual([]);
        const outputDirectory = path.join(directory, 'acceptance');
        const acceptance = await client.callTool({ name: 'l2d_acceptance', arguments: { projectPath, outputDirectory, plan: { cases: [{ id: 'neutral' }] } } });
        expect(acceptance.isError).not.toBe(true);
        const reportPath = path.join(outputDirectory, 'report.json');
        expect(JSON.parse(fs.readFileSync(reportPath, 'utf8')).completeModelAccepted).toBe(false);
        const current = await client.callTool({ name: 'l2d_check_acceptance', arguments: { projectPath, reportPath } });
        expect(current.isError).not.toBe(true);
        fs.writeFileSync(projectPath, JSON.stringify({ ...project, canvas: { ...project.canvas, width: 101 } }));
        const stale = await client.callTool({ name: 'l2d_check_acceptance', arguments: { projectPath, reportPath } });
        expect(stale.isError).toBe(true);
      } finally { fs.rmSync(directory, { recursive: true, force: true }); }
      const result = await client.callTool({ name: 'l2d_gui_select', arguments: { nodeIds: ['face'] } });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual({ action: 'select', selectedNodeIds: [] });
      expect(requests).toEqual([{ action: 'select', nodeIds: ['face'] }]);
      const invalid = await client.callTool({ name: 'l2d_gui_viewport', arguments: { zoom: -5 } });
      expect(invalid.isError).toBe(true);
      expect(requests).toHaveLength(1);
      const state = await client.callTool({ name: 'l2d_gui_state', arguments: {} });
      expect(state.isError).not.toBe(true);
      expect(requests[1]).toEqual({ action: 'state', nodeOffset: 0, nodeLimit: 50 });
      expect(() => callDesktopEditor({ action: 'state', nodeOffset: 0, nodeLimit: 1 }, 'ws://example.com:22033')).toThrow('loopback');
      const browser = new WebSocket(url, { origin: 'https://example.com' });
      await new Promise<void>(resolve => { browser.once('error', error => { expect(error.message).toContain('401'); resolve(); }); });
    } finally {
      await client.close();
      await server.close();
      for (const socket of websocket.clients) socket.terminate();
      await new Promise<void>(resolve => websocket.close(() => resolve()));
    }
  });
});
