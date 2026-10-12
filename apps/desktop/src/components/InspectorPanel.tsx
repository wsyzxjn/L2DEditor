import React from 'react';
import { useEditor } from '../context/EditorContext.js';
import { ScrubInput } from './ScrubInput.js';
import { Info, Sparkles, Layers } from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const { project, selectedNodeId, executeCommand, notify } = useEditor();
  const selectedNode = project.nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    // Canvas Inspector
    return (
      <div className="flex flex-col h-full bg-dcc-panel border-t border-dcc-border p-2 space-y-3">
        <div className="flex items-center space-x-1.5 text-dcc font-semibold uppercase tracking-wider text-dcc-muted border-b border-dcc-border pb-1">
          <Layers className="w-3.5 h-3.5" />
          <span>Canvas Properties</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-dcc-sm text-dcc-muted">Width</label>
            <ScrubInput
              value={project.canvas.width}
              onChange={(v) =>
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'canvas.update',
                  params: { width: v },
                })
              }
              step={10}
              min={100}
            />
          </div>
          <div>
            <label className="text-dcc-sm text-dcc-muted">Height</label>
            <ScrubInput
              value={project.canvas.height}
              onChange={(v) =>
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'canvas.update',
                  params: { height: v },
                })
              }
              step={10}
              min={100}
            />
          </div>
        </div>
      </div>
    );
  }

  const kind = selectedNode.kind;

  return (
    <div className="flex flex-col h-full bg-dcc-panel border-t border-dcc-border p-2 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-dcc-border pb-1">
        <div className="flex items-center space-x-1.5 text-dcc font-semibold uppercase tracking-wider text-dcc-muted">
          <Info className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </div>
        <span className="text-dcc-sm px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
          {kind.type}
        </span>
      </div>

      {/* Basic Node Info */}
      <div className="space-y-1.5">
        <div>
          <label className="text-dcc-sm text-dcc-muted">ID</label>
          <div className="text-dcc font-mono text-zinc-300 select-all">{selectedNode.id}</div>
        </div>
        <div>
          <label className="text-dcc-sm text-dcc-muted">Name</label>
          <input
            type="text"
            className="w-full h-6 px-1.5 text-dcc bg-dcc-bg border border-dcc-border rounded text-dcc-text outline-none focus:border-dcc-accent"
            value={selectedNode.name}
            onChange={(e) =>
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'node.update',
                params: { id: selectedNode.id, changes: { name: e.target.value } },
              })
            }
          />
        </div>
      </div>

      {/* Warp Deformer Properties */}
      {kind.type === 'WarpDeformer' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc font-semibold text-dcc-muted uppercase">Warp Grid</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-dcc-sm text-dcc-muted">Columns</label>
              <div className="text-dcc font-mono">{kind.cols}</div>
            </div>
            <div>
              <label className="text-dcc-sm text-dcc-muted">Rows</label>
              <div className="text-dcc font-mono">{kind.rows}</div>
            </div>
          </div>

          <button
            className="w-full mt-2 flex items-center justify-center px-2 py-1.5 text-dcc bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded font-medium transition-colors"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'macro.setup_turn_xy',
                params: { target_node_id: selectedNode.id },
              });
              notify(`Setup 3x3 Turn XY on ${selectedNode.name || selectedNode.id}`, 'success');
            }}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Auto Setup Turn XY (3x3)
          </button>
        </div>
      )}

      {/* Rotation Deformer Properties */}
      {kind.type === 'RotationDeformer' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc font-semibold text-dcc-muted uppercase">Rotation Deformer</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-dcc-sm text-dcc-muted">Origin X</label>
              <ScrubInput
                value={kind.origin[0]}
                onChange={(v) =>
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'node.update',
                    params: {
                      id: selectedNode.id,
                      changes: { kind: { ...kind, origin: [v, kind.origin[1]] } },
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="text-dcc-sm text-dcc-muted">Origin Y</label>
              <ScrubInput
                value={kind.origin[1]}
                onChange={(v) =>
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'node.update',
                    params: {
                      id: selectedNode.id,
                      changes: { kind: { ...kind, origin: [kind.origin[0], v] } },
                    },
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="text-dcc-sm text-dcc-muted">Angle (deg)</label>
            <ScrubInput
              value={kind.angle_deg}
              onChange={(v) =>
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'node.update',
                  params: {
                    id: selectedNode.id,
                    changes: { kind: { ...kind, angle_deg: v } },
                  },
                })
              }
              step={1}
            />
          </div>
        </div>
      )}

      {/* ArtMesh Properties */}
      {kind.type === 'ArtMesh' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc font-semibold text-dcc-muted uppercase">Mesh Geometry</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-dcc-sm text-dcc-muted">Vertices</label>
              <div className="text-dcc font-mono">{kind.vertices.length}</div>
            </div>
            <div>
              <label className="text-dcc-sm text-dcc-muted">Triangles</label>
              <div className="text-dcc font-mono">{kind.indices.length / 3}</div>
            </div>
          </div>
          <div>
            <label className="text-dcc-sm text-dcc-muted">Opacity</label>
            <ScrubInput
              value={kind.opacity}
              onChange={(v) =>
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'node.update',
                  params: {
                    id: selectedNode.id,
                    changes: { kind: { ...kind, opacity: v } },
                  },
                })
              }
              step={0.05}
              min={0}
              max={1}
            />
          </div>
        </div>
      )}
    </div>
  );
};
