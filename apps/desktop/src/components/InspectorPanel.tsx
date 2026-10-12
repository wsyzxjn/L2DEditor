import React from 'react';
import { useEditor } from '../context/EditorContext.js';
import { ScrubInput } from './ScrubInput.js';
import { Info, Sparkles, Layers, Key, Copy, FlipHorizontal, Grid, RotateCcw, Wind, Trash2, PenTool } from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const { project, selectedNodeId, executeCommand, notify } = useEditor();
  const selectedNode = project.nodes.find((n) => n.id === selectedNodeId);
  const [copiedShape, setCopiedShape] = React.useState<any>(null);

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

      {/* Quick Keyform Generation */}
      <div className="pt-2 border-t border-dcc-border space-y-1.5">
        <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">Keyform Quick Setup</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className="flex items-center justify-center px-2 py-1 text-dcc-sm bg-dcc-bg hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border transition-colors"
            onClick={() => {
              const firstParam = project.parameters[0];
              if (firstParam) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.setup_points',
                  params: { target_node_id: selectedNode.id, param_id: firstParam.id, point_count: 2 },
                });
                notify(`Generated 2-point keys on ${firstParam.id}`, 'success');
              }
            }}
          >
            <Key className="w-3 h-3 mr-1 text-emerald-400" /> + 2 Keys (0, 1)
          </button>
          <button
            className="flex items-center justify-center px-2 py-1 text-dcc-sm bg-dcc-bg hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border transition-colors"
            onClick={() => {
              const firstParam = project.parameters[0];
              if (firstParam) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.setup_points',
                  params: { target_node_id: selectedNode.id, param_id: firstParam.id, point_count: 3 },
                });
                notify(`Generated 3-point keys on ${firstParam.id}`, 'success');
              }
            }}
          >
            <Key className="w-3 h-3 mr-1 text-amber-400" /> + 3 Keys (-30, 0, 30)
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            className="flex items-center justify-center px-2 py-1 text-dcc-sm bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded border border-purple-500/30 transition-colors"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'keyform.synthesize_corners',
                params: { target_node_id: selectedNode.id },
              });
              notify('Synthesized 4-Corner Keyforms (Ctrl+4)', 'success');
            }}
            title="Synthesize 4 Corners from axial keyforms (四角自动合成 Ctrl+4)"
          >
            <Grid className="w-3 h-3 mr-1" /> 4-Corner Blend
          </button>
          <button
            className="flex items-center justify-center px-2 py-1 text-dcc-sm bg-dcc-bg hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border transition-colors"
            onClick={() => {
              const binding = project.keyforms.find((k) => k.target_node_id === selectedNode.id);
              if (binding && binding.keyforms.length > 0) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.restore_original_shape',
                  params: { target_node_id: selectedNode.id, coordinates: binding.keyforms[0].coordinates },
                });
                notify('Restored original rest shape on keyform', 'info');
              }
            }}
            title="Restore Original Shape (还原原始形状)"
          >
            <RotateCcw className="w-3 h-3 mr-1" /> Restore Shape
          </button>
        </div>
      </div>

      {/* Shape Copy & Paste */}
      <div className="pt-2 border-t border-dcc-border/60 space-y-1.5">
        <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">Keyform Shape Copy/Paste</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className="flex items-center justify-center px-2 py-1 text-dcc-sm bg-dcc-bg hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border transition-colors"
            onClick={() => {
              const binding = project.keyforms.find((k) => k.target_node_id === selectedNode.id);
              if (binding && binding.keyforms.length > 0) {
                setCopiedShape(JSON.parse(JSON.stringify(binding.keyforms[0])));
                notify('Copied keyform shape to clipboard', 'info');
              } else {
                notify('No keyforms on this node to copy', 'error');
              }
            }}
          >
            <Copy className="w-3 h-3 mr-1" /> Copy Shape
          </button>
          <button
            className="flex items-center justify-center px-2 py-1 text-dcc-sm bg-dcc-bg hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border transition-colors disabled:opacity-40"
            disabled={!copiedShape}
            onClick={() => {
              if (copiedShape) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.copy_paste',
                  params: {
                    target_node_id: selectedNode.id,
                    source_coords: copiedShape.coordinates,
                    dest_coords: copiedShape.coordinates.map((c: number) => -c),
                    mirror_x: true,
                  },
                });
                notify('Pasted mirrored shape to opposite key', 'success');
              }
            }}
          >
            <FlipHorizontal className="w-3 h-3 mr-1 text-amber-400" /> Paste Mirrored
          </button>
        </div>
      </div>
      
      {/* Part Properties */}
      {kind.type === 'Part' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">Part Folder</span>
          <div>
            <label className="text-dcc-sm text-dcc-muted">Folder Opacity (Cascading)</label>
            <ScrubInput
              value={kind.opacity ?? 1.0}
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

      {/* Warp Deformer Properties */}
      {kind.type === 'WarpDeformer' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc font-semibold text-dcc-muted uppercase">Warp Grid</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-dcc-sm text-dcc-muted">Columns</label>
              <ScrubInput
                value={kind.cols}
                onChange={(c) =>
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'warp.set_divisions',
                    params: { node_id: selectedNode.id, cols: Math.max(1, Math.round(c)), rows: kind.rows },
                  })
                }
                step={1}
                min={1}
                max={16}
              />
            </div>
            <div>
              <label className="text-dcc-sm text-dcc-muted">Rows</label>
              <ScrubInput
                value={kind.rows}
                onChange={(r) =>
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'warp.set_divisions',
                    params: { node_id: selectedNode.id, cols: kind.cols, rows: Math.max(1, Math.round(r)) },
                  })
                }
                step={1}
                min={1}
                max={16}
              />
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

          <button
            className="w-full mt-1.5 flex items-center justify-center px-2 py-1.5 text-dcc bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded font-medium transition-colors"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'macro.auto_sway',
                params: { target_node_id: selectedNode.id },
              });
              notify(`Generated Auto Sway & Physics on ${selectedNode.name || selectedNode.id}`, 'success');
            }}
          >
            <Wind className="w-3.5 h-3.5 mr-1" /> Auto Sway (AI 揺れ生成)
          </button>

          <button
            className="w-full mt-1.5 flex items-center justify-center px-2 py-1 text-dcc-sm bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded transition-colors"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'deformer.delete_and_bake_to_children',
                params: { deformer_id: selectedNode.id },
              });
              notify('Deleted deformer and baked deformation into children', 'info');
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Delete & Bake to Children
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
        
          {/* Hit Area & User Data */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dcc-border/60">
            <div>
              <label className="text-dcc-sm text-dcc-muted">Hit Area Tag</label>
              <input
                type="text"
                placeholder="e.g. Head"
                className="w-full h-6 px-1.5 text-dcc-sm bg-dcc-bg border border-dcc-border rounded text-dcc-text outline-none"
                value={kind.hit_area_name || ''}
                onChange={(e) =>
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'mesh.set_hit_area',
                    params: { mesh_id: selectedNode.id, hit_area_name: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-dcc-sm text-dcc-muted">User Data</label>
              <input
                type="text"
                placeholder="Custom metadata"
                className="w-full h-6 px-1.5 text-dcc-sm bg-dcc-bg border border-dcc-border rounded text-dcc-text outline-none"
                value={kind.user_data || ''}
                onChange={(e) =>
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'mesh.set_user_data',
                    params: { mesh_id: selectedNode.id, user_data: e.target.value },
                  })
                }
              />
            </div>
          </div>

          {/* Morph Targets (BlendShapes) */}
          <div className="pt-2 border-t border-dcc-border/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">Morph Targets (BlendShapes)</span>
              <button
                className="text-dcc-sm px-1.5 py-0.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded"
                onClick={() => {
                  const param = project.parameters[0]?.id || 'ParamEyeLOpen';
                  const morphId = `morph_${Date.now()}`;
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'mesh.add_morph_target',
                    params: {
                      mesh_id: selectedNode.id,
                      morph: {
                        id: morphId,
                        name: 'Smile Shape',
                        param_id: param,
                        vertex_offsets: kind.vertices.map(() => [0, -5]),
                      },
                    },
                  });
                  notify('Added Morph Target (BlendShape)', 'success');
                }}
              >
                + Morph
              </button>
            </div>
            {(kind.morph_targets || []).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between h-6 px-1.5 bg-dcc-bg/60 rounded border border-dcc-border/40 text-dcc-sm">
                <span className="truncate text-dcc-text">{m.name}</span>
                <span className="font-mono text-[10px] text-zinc-500">{m.param_id}</span>
              </div>
            ))}
          </div>

          <button
            className="w-full mt-2 py-1 text-dcc-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'mesh.reverse_winding',
                params: { mesh_id: selectedNode.id },
              });
              notify('Reversed triangle normal winding', 'info');
            }}
          >
            Reverse Triangle Winding
          </button>

          <button
            className="w-full mt-1.5 py-1 text-dcc-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded border border-blue-500/30 font-medium"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'warp.create_enclosing_mesh',
                params: { mesh_id: selectedNode.id },
              });
              notify(`Created enclosing Warp Deformer for ${selectedNode.name || selectedNode.id}`, 'success');
            }}
          >
            Create Enclosing Warp Deformer
          </button>

          <button
            className="w-full mt-1.5 flex items-center justify-center py-1 text-dcc-sm bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded border border-purple-500/30 font-medium"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'art_path.fit_mesh_contour',
                params: { mesh_id: selectedNode.id },
              });
              notify(`Generated contour ArtPath for ${selectedNode.name || selectedNode.id}`, 'success');
            }}
          >
            <PenTool className="w-3 h-3 mr-1" /> Fit Contour ArtPath
          </button>
</div>
      )}

      {/* ArtPath Properties */}
      {kind.type === 'ArtPath' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc font-semibold text-dcc-muted uppercase">ArtPath Stroke</span>
          <div className="text-dcc-sm text-zinc-400 font-mono">
            Control Points: {kind.points.length} ({kind.closed ? 'Closed' : 'Open'})
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              className="px-2 py-1 text-dcc-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-dcc-border"
              onClick={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'art_path.adjust_width',
                  params: { node_id: selectedNode.id, delta: 1.5 },
                });
                notify('Increased ArtPath stroke width', 'info');
              }}
            >
              + Thicken Stroke
            </button>
            <button
              className="px-2 py-1 text-dcc-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-dcc-border"
              onClick={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'art_path.adjust_width',
                  params: { node_id: selectedNode.id, delta: -1.5 },
                });
                notify('Reduced ArtPath stroke width', 'info');
              }}
            >
              - Thin Stroke
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
