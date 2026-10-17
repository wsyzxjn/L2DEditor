import React from 'react';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { ScrubInput } from './ScrubInput.js';
import { Info, Sparkles, Layers, Key, Copy, FlipHorizontal, Grid, RotateCcw, Wind, Trash2, PenTool } from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const { t } = useI18n();
  const { project, selectedNodeId, executeCommand, notify } = useEditor();
  const selectedNode = project.nodes.find((n) => n.id === selectedNodeId);
  const [copiedShape, setCopiedShape] = React.useState<any>(null);

  if (!selectedNode) {
    // Canvas Inspector
    return (
      <div className="flex flex-col h-full bg-dcc-panel border-t border-dcc-border p-2 space-y-3">
        <div className="flex items-center space-x-1.5 text-dcc font-semibold text-dcc-muted border-b border-dcc-border pb-1">
          <Layers className="w-3.5 h-3.5" />
          <span>{t('inspector.canvas_props')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-dcc-sm text-dcc-muted">{t('inspector.width')}</label>
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
            <label className="text-dcc-sm text-dcc-muted">{t('inspector.height')}</label>
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
      <div className="flex items-center justify-between gap-2 border-b border-dcc-border pb-1">
        <div className="flex min-w-0 items-center space-x-1.5 text-dcc font-semibold text-dcc-text">
          <Info className="w-3.5 h-3.5 shrink-0 text-dcc-muted" />
          <span className="truncate" title={selectedNode.name || selectedNode.id}>{selectedNode.name || selectedNode.id}</span>
        </div>
        <span className="shrink-0 text-dcc-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
          {kind.type}
        </span>
      </div>

      {/* Basic Node Info */}
      <div className="space-y-1.5">
        <div>
          <label className="text-dcc-sm text-dcc-muted">{t('inspector.node_id')}</label>
          <div className="text-dcc font-mono text-zinc-300 select-all">{selectedNode.id}</div>
        </div>
        <div>
          <label className="text-dcc-sm text-dcc-muted">{t('inspector.node_name')}</label>
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
        <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">{t('inspector.quick_setup')}</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className="btn btn-secondary btn-wrap"
            onClick={() => {
              const firstParam = project.parameters[0];
              if (firstParam) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.setup_points',
                  params: { target_node_id: selectedNode.id, param_id: firstParam.id, point_count: 2 },
                });
                notify(t('notify.keys_added', { count: 2, param: firstParam.id }), 'success');
              }
            }}
          >
            <Key className="w-3 h-3 mr-1 text-dcc-muted" /> {t('inspector.key2')}
          </button>
          <button
            className="btn btn-secondary btn-wrap"
            onClick={() => {
              const firstParam = project.parameters[0];
              if (firstParam) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.setup_points',
                  params: { target_node_id: selectedNode.id, param_id: firstParam.id, point_count: 3 },
                });
                notify(t('notify.keys_added', { count: 3, param: firstParam.id }), 'success');
              }
            }}
          >
            <Key className="w-3 h-3 mr-1 text-dcc-muted" /> {t('inspector.key3')}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            className="btn btn-secondary btn-wrap"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'keyform.synthesize_corners',
                params: { target_node_id: selectedNode.id },
              });
              notify(t('notify.synthesized_corners'), 'success');
            }}
            title={t('inspector.synthesize_corners')}
          >
            <Grid className="w-3 h-3 mr-1" /> {t('inspector.synthesize_corners')}
          </button>
          <button
            className="btn btn-secondary btn-wrap"
            onClick={() => {
              const binding = project.keyforms.find((k) => k.target_node_id === selectedNode.id);
              if (binding && binding.keyforms.length > 0) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.restore_original_shape',
                  params: { target_node_id: selectedNode.id, coordinates: binding.keyforms[0].coordinates },
                });
                notify(t('notify.shape_restored'), 'info');
              }
            }}
            title={t('inspector.restore_shape')}
          >
            <RotateCcw className="w-3 h-3 mr-1" /> {t('inspector.restore_shape')}
          </button>
        </div>
      </div>

      {/* Shape Copy & Paste */}
      <div className="pt-2 border-t border-dcc-border/60 space-y-1.5">
        <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">{t('inspector.shape_copy_paste')}</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className="btn btn-secondary btn-wrap"
            onClick={() => {
              const binding = project.keyforms.find((k) => k.target_node_id === selectedNode.id);
              if (binding && binding.keyforms.length > 0) {
                setCopiedShape(JSON.parse(JSON.stringify(binding.keyforms[0])));
                notify(t('notify.shape_copied'), 'info');
              } else {
                notify(t('notify.no_keyforms'), 'error');
              }
            }}
          >
            <Copy className="w-3 h-3 mr-1" /> {t('inspector.copy_shape')}
          </button>
          <button
            className="btn btn-secondary btn-wrap disabled:opacity-40"
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
                notify(t('notify.shape_mirrored'), 'success');
              }
            }}
          >
            <FlipHorizontal className="w-3 h-3 mr-1 text-dcc-muted" /> {t('inspector.paste_mirrored')}
          </button>
        </div>
      </div>
      
      {/* Part Properties */}
      {kind.type === 'Part' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">{t('inspector.part_folder')}</span>
          <div>
            <label className="text-dcc-sm text-dcc-muted">{t('inspector.folder_opacity')}</label>
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
          <span className="text-dcc font-semibold text-dcc-muted uppercase">{t('inspector.warp_grid')}</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-dcc-sm text-dcc-muted">{t('inspector.cols')}</label>
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
              <label className="text-dcc-sm text-dcc-muted">{t('inspector.rows')}</label>
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

          <div className="grid grid-cols-4 gap-1 pt-1">
            {(
              [
                ['twice_rows', '2x Row'],
                ['half_rows', '½ Row'],
                ['twice_cols', '2x Col'],
                ['half_cols', '½ Col'],
              ] as const
            ).map(([op, label]) => (
              <button
                key={op}
                className="btn btn-secondary btn-wrap text-[10px] font-mono"
                onClick={() => {
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'warp.change_topology',
                    params: { node_id: selectedNode.id, op },
                  });
                  notify(t('notify.warp_resampled', { label }), 'info');
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary btn-wrap w-full mt-2"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'macro.setup_turn_xy',
                params: { target_node_id: selectedNode.id },
              });
              notify(t('notify.turn_xy_on', { name: selectedNode.name || selectedNode.id }), 'success');
            }}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" /> {t('inspector.auto_turn_xy')}
          </button>

          <button
            className="btn btn-secondary btn-wrap w-full mt-1.5"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'macro.auto_sway',
                params: { target_node_id: selectedNode.id },
              });
              notify(t('notify.auto_sway_on', { name: selectedNode.name || selectedNode.id }), 'success');
            }}
          >
            <Wind className="w-3.5 h-3.5 mr-1" /> {t('inspector.auto_sway')}
          </button>

          <button
            className="btn btn-secondary btn-wrap btn-danger w-full mt-1.5"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'deformer.delete_and_bake_to_children',
                params: { deformer_id: selectedNode.id },
              });
              notify(t('notify.deformer_baked'), 'info');
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" /> {t('inspector.delete_bake')}
          </button>
        </div>
      )}

      {/* Rotation Deformer Properties */}
      {kind.type === 'RotationDeformer' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc font-semibold text-dcc-muted uppercase">{t('inspector.rot_deformer')}</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-dcc-sm text-dcc-muted">{t('inspector.origin_x')}</label>
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
              <label className="text-dcc-sm text-dcc-muted">{t('inspector.origin_y')}</label>
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
            <label className="text-dcc-sm text-dcc-muted">{t('inspector.angle')}</label>
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
          <span className="text-dcc font-semibold text-dcc-muted uppercase">{t('inspector.mesh_geo')}</span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-dcc-sm text-dcc-muted">{t('inspector.vertices')}</label>
              <div className="text-dcc font-mono">{kind.vertices.length}</div>
            </div>
            <div>
              <label className="text-dcc-sm text-dcc-muted">{t('inspector.triangles')}</label>
              <div className="text-dcc font-mono">{kind.indices.length / 3}</div>
            </div>
          </div>
          <div>
            <label className="text-dcc-sm text-dcc-muted">{t('inspector.opacity')}</label>
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
              <label className="text-dcc-sm text-dcc-muted">{t('inspector.hit_area')}</label>
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
              <label className="text-dcc-sm text-dcc-muted">{t('inspector.user_data')}</label>
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
              <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">{t('inspector.morph_targets')}</span>
              <button
                className="btn btn-secondary btn-wrap"
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
                  notify(t('notify.morph_added'), 'success');
                }}
              >
                {t('inspector.add_morph')}
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
            className="btn btn-secondary btn-wrap w-full mt-2"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'mesh.reverse_winding',
                params: { mesh_id: selectedNode.id },
              });
              notify(t('notify.winding_flipped'), 'info');
            }}
          >
            {t('inspector.reverse_winding')}
          </button>

          <button
            className="btn btn-secondary btn-wrap w-full mt-1.5"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'warp.create_enclosing_mesh',
                params: { mesh_id: selectedNode.id },
              });
              notify(t('notify.warp_enclosed', { name: selectedNode.name || selectedNode.id }), 'success');
            }}
          >
            {t('inspector.create_enclosing_warp')}
          </button>

          <button
            className="btn btn-secondary btn-wrap w-full mt-1.5"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'art_path.fit_mesh_contour',
                params: { mesh_id: selectedNode.id },
              });
              notify(t('notify.contour_path', { name: selectedNode.name || selectedNode.id }), 'success');
            }}
          >
            <PenTool className="w-3 h-3 mr-1" /> {t('inspector.fit_contour_path')}
          </button>
</div>
      )}

      {/* ArtPath Properties */}
      {kind.type === 'ArtPath' && (
        <div className="space-y-2 pt-2 border-t border-dcc-border">
          <span className="text-dcc font-semibold text-dcc-muted uppercase">{t('inspector.artpath_stroke')}</span>
          <div className="text-dcc-sm text-zinc-400 font-mono">
            {t('inspector.control_points')}: {kind.points.length} ({kind.closed ? t('inspector.closed') : t('inspector.open')})
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              className="btn btn-secondary btn-wrap"
              onClick={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'art_path.adjust_width',
                  params: { node_id: selectedNode.id, delta: 1.5 },
                });
                notify(t('notify.stroke_wider'), 'info');
              }}
            >
              {t('inspector.thicken')}
            </button>
            <button
              className="btn btn-secondary btn-wrap"
              onClick={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'art_path.adjust_width',
                  params: { node_id: selectedNode.id, delta: -1.5 },
                });
                notify(t('notify.stroke_thinner'), 'info');
              }}
            >
              {t('inspector.thin')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
