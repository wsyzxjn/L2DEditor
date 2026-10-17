import { WebSocketServer, WebSocket, type VerifyClientCallbackSync } from 'ws';
import type { Project } from '@l2d/schema';
import { editorRequestSchema, type EditorRequest } from './editor-protocol.js';

export interface CubismWebSocketServerOptions {
  port?: number;
  getProject: () => Project;
  getParameterValues: () => Record<string, number>;
  setParameterValues: (values: Record<string, number>) => void | Promise<void>;
  handleEditorRequest?: (request: EditorRequest) => Promise<Record<string, unknown>>;
}

/**
 * Live2D Cubism Editor 5.1+ compatible WebSocket Server.
 * Runs on port 22033 by default and responds to official JSON-RPC commands.
 */
export function startCubismWebSocketServer(options: CubismWebSocketServerOptions): WebSocketServer {
  const port = options.port ?? 22033;
  const verifyClient: VerifyClientCallbackSync = info => !options.handleEditorRequest || !info.origin;
  const wss = new WebSocketServer({ port, host: '127.0.0.1', verifyClient });

  wss.on('error', (err) => {
    console.warn(`[CubismWebSocketServer] Server error on port ${port}:`, err.message);
  });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', async (message: string | Buffer) => {
      let rpcId: string | number | null = null;
      let isRpc = false;
      try {
        const payload = JSON.parse(message.toString());
        if (payload.jsonrpc === '2.0') {
          isRpc = true;
          rpcId = payload.id ?? null;
          if (payload.method !== 'l2d.editor') throw new Error(`Unknown method '${payload.method}'`);
          if (!options.handleEditorRequest) throw new Error('This endpoint is not connected to a desktop window');
          const result = await options.handleEditorRequest(editorRequestSchema.parse(payload.params));
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: rpcId, result }));
          return;
        }
        const type = payload.Type || payload.type;
        const data = payload.Data || payload.data || {};

        const project = options.getProject();
        const paramVals = options.getParameterValues();

        let response: any = null;

        switch (type) {
          case 'GetAPIVersion':
            response = {
              Type: 'GetAPIVersionResponse',
              Data: {
                Version: '0.1.0',
                CubismEditorVersion: '5.3.00',
              },
            };
            break;

          case 'GetCurrentModelUID':
            response = {
              Type: 'GetCurrentModelUIDResponse',
              Data: {
                ModelUID: 'model_current_uid',
              },
            };
            break;

          case 'GetCurrentEditMode':
            response = {
              Type: 'GetCurrentEditModeResponse',
              Data: {
                EditMode: 'Modeler',
              },
            };
            break;

          case 'GetParameters':
            response = {
              Type: 'GetParametersResponse',
              Data: {
                Parameters: project.parameters.map((p) => ({
                  Id: p.id,
                  Name: p.name || p.id,
                  Min: p.min,
                  Max: p.max,
                  Default: p.default,
                })),
              },
            };
            break;

          case 'GetParameterValues':
            response = {
              Type: 'GetParameterValuesResponse',
              Data: {
                Parameters: project.parameters.map((p) => ({
                  Id: p.id,
                  Value: paramVals[p.id] ?? p.default,
                })),
              },
            };
            break;

          case 'SetParameterValues': {
            const incoming = data.Parameters || [];
            const updates: Record<string, number> = {};
            for (const item of incoming) {
              if (item.Id && typeof item.Value === 'number') {
                updates[item.Id] = item.Value;
              }
            }
            await options.setParameterValues(updates);
            response = {
              Type: 'SetParameterValuesResponse',
              Data: {
                Success: true,
              },
            };
            break;
          }

          case 'GetParameterGroups':
            response = {
              Type: 'GetParameterGroupsResponse',
              Data: {
                ParameterGroups: (project.parameter_groups || []).map((g) => ({
                  Id: g.id,
                  Name: g.name || g.id,
                })),
              },
            };
            break;

          case 'GetPhysicsInfo':
            response = {
              Type: 'GetPhysicsInfoResponse',
              Data: {
                PhysicsGroups: (project.physics || []).map((g) => ({
                  Id: g.id,
                  Name: g.name || g.id,
                })),
              },
            };
            break;

          default:
            response = {
              Type: 'ErrorResponse',
              Data: {
                Error: `Unknown request type '${type}'`,
              },
            };
            break;
        }

        if (response) {
          ws.send(JSON.stringify(response));
        }
      } catch (err: any) {
        if (isRpc) {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: rpcId, error: { code: -32000, message: err?.message || String(err) } }));
          return;
        }
        ws.send(
          JSON.stringify({
            Type: 'ErrorResponse',
            Data: { Error: err?.message || String(err) },
          })
        );
      }
    });
  });

  return wss;
}
