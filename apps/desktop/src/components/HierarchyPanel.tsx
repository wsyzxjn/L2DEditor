import React, { useState } from 'react';
import type { Node } from '@l2d/schema';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { OverflowMenu, OverflowMenuItem } from './OverflowMenu.js';
import { Eye, EyeOff, Lock, Unlock, Grid, RotateCw, Image, Folder, Plus, PenTool, Sparkles, Search, Trash2, FolderTree, X } from 'lucide-react';

export const HierarchyPanel: React.FC = () => {
  const { t } = useI18n();
  const { project, selectedNodeId, selectedNodeIds, setSelectedNodeId, toggleSelectNodeId, executeCommand, notify } = useEditor();
  const [searchQuery, setSearchQuery] = useState('');

  // Group nodes by parent_id
  const childrenMap = new Map<string | null, Node[]>();
  for (const node of project.nodes) {
    const pid = node.parent_id || null;
    if (!childrenMap.has(pid)) {
      childrenMap.set(pid, []);
    }
    childrenMap.get(pid)!.push(node);
  }

  const query = searchQuery.trim().toLowerCase();
  const filteredNodes = project.nodes.filter((node) => `${node.name} ${node.id}`.toLowerCase().includes(query));

  const renderNode = (node: Node, depth: number, includeChildren = true) => {
    const isSelected = selectedNodeIds.includes(node.id) || selectedNodeId === node.id;
    const children = childrenMap.get(node.id) || [];

    let KindIcon = Image;
    if (node.kind.type === 'WarpDeformer') KindIcon = Grid;
    else if (node.kind.type === 'RotationDeformer') KindIcon = RotateCw;
    else if (node.kind.type === 'Part') KindIcon = Folder;
    else if (node.kind.type === 'ArtPath') KindIcon = PenTool;

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          className={`flex items-center h-6 px-2 text-dcc cursor-pointer ${
            isSelected ? 'list-item-selected font-medium' : 'text-dcc-text hover:bg-dcc-hover'
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={(e) => toggleSelectNodeId(node.id, e.shiftKey || e.metaKey || e.ctrlKey)}
        >
          {/* Kind icon */}
          <KindIcon className="w-3.5 h-3.5 mr-1.5 text-dcc-muted shrink-0" />
          {/* Name */}
          <span className="truncate flex-1">{node.name || node.id}</span>

          {/* Visibility toggle */}
          <button
            className="p-1 hover:text-white text-dcc-muted"
            title={node.visible ? t('hierarchy.visible_on') : t('hierarchy.visible_off')}
            onClick={(e) => {
              e.stopPropagation();
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'node.update',
                params: { id: node.id, changes: { visible: !node.visible } },
              });
            }}
          >
            {node.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-zinc-600" />}
          </button>

          {/* Lock toggle */}
          <button
            className="p-1 hover:text-white text-dcc-muted ml-0.5"
            title={node.locked ? t('hierarchy.lock_on') : t('hierarchy.lock_off')}
            onClick={(e) => {
              e.stopPropagation();
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'node.update',
                params: { id: node.id, changes: { locked: !node.locked } },
              });
            }}
          >
            {node.locked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3 text-zinc-600" />}
          </button>
        </div>

        {includeChildren && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const rootNodes = childrenMap.get(null) || [];

  const handleAddWarp = () => {
    const id = `warp_${Date.now()}`;
    const name = `Warp ${project.nodes.filter((n) => n.kind.type === 'WarpDeformer').length + 1}`;
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'node.add',
      params: {
        id,
        name,
        parent_id: selectedNodeId,
        visible: true,
        locked: false,
        kind: {
          type: 'WarpDeformer',
          cols: 4,
          rows: 4,
          bounds: [760, 340, 400, 400],
          control_points: generateDefaultPoints(4, 4, [760, 340, 400, 400]),
        },
      },
    });
    setSelectedNodeId(id);
    notify(`${t('hierarchy.warp')}: ${name}`, 'success');
  };

  const handleAddRotation = () => {
    const id = `rot_${Date.now()}`;
    const name = `Rotation ${project.nodes.filter((n) => n.kind.type === 'RotationDeformer').length + 1}`;
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'node.add',
      params: {
        id,
        name,
        parent_id: selectedNodeId,
        visible: true,
        locked: false,
        kind: {
          type: 'RotationDeformer',
          origin: [960, 540],
          angle_deg: 0,
          scale: [1, 1],
        },
      },
    });
    setSelectedNodeId(id);
    notify(`${t('hierarchy.rot')}: ${name}`, 'success');
  };

  const handleAddPart = () => {
    const id = `part_${Date.now()}`;
    const name = `Part ${project.nodes.filter((n) => n.kind.type === 'Part').length + 1}`;
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'node.add',
      params: {
        id,
        name,
        parent_id: selectedNodeId,
        visible: true,
        locked: false,
        kind: {
          type: 'Part',
          collapsed: false,
        },
      },
    });
    setSelectedNodeId(id);
    notify(`${t('hierarchy.part')}: ${name}`, 'success');
  };

  const handleAddArtPath = () => {
    const id = `artpath_${Date.now()}`;
    const name = `ArtPath ${project.nodes.filter((n) => n.kind.type === 'ArtPath').length + 1}`;
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'art_path.create',
      params: {
        id,
        name,
        parent_id: selectedNodeId,
        points: [
          { pos: [800, 480], width: 6, opacity: 1 },
          { pos: [960, 440], width: 8, opacity: 1 },
          { pos: [1120, 480], width: 6, opacity: 1 },
        ],
        closed: false,
      },
    });
    setSelectedNodeId(id);
    notify(`${t('hierarchy.path')}: ${name}`, 'success');
  };

  return (
    <div className="panel-root flex flex-col h-full bg-dcc-panel border-r border-dcc-border">
      {/* Create menu, filter and cleanup */}
      <div className="flex shrink-0 items-center gap-1 h-8 px-2 border-b border-dcc-border bg-dcc-header">
        <OverflowMenu label={t('hierarchy.add')} icon={Plus}>
          <OverflowMenuItem icon={Grid} label={t('hierarchy.warp')} onSelect={handleAddWarp} />
          <OverflowMenuItem icon={RotateCw} label={t('hierarchy.rot')} onSelect={handleAddRotation} />
          <OverflowMenuItem icon={Folder} label={t('hierarchy.part')} onSelect={handleAddPart} />
          <OverflowMenuItem icon={PenTool} label={t('hierarchy.path')} onSelect={handleAddArtPath} />
        </OverflowMenu>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 h-6 px-1.5 rounded bg-dcc-bg/60 border border-dcc-border focus-within:border-blue-500">
          <Search className="w-3 h-3 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder={t('hierarchy.filter_placeholder')}
            aria-label={t('hierarchy.filter_placeholder')}
            className="min-w-0 flex-1 h-5 bg-transparent text-dcc-sm text-dcc-text outline-none placeholder:text-zinc-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="shrink-0 text-dcc-xs font-mono text-zinc-500" title={`${project.nodes.length}`}>
            {query ? `${filteredNodes.length}/${project.nodes.length}` : project.nodes.length}
          </span>
          {searchQuery && (
            <button className="p-0.5 rounded text-dcc-muted hover:text-white" onClick={() => setSearchQuery('')} aria-label={t('hierarchy.clear_search')} title={t('hierarchy.clear_search')}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          className="btn btn-icon"
          onClick={() => {
            executeCommand({
              id: `cmd_${Date.now()}`,
              name: 'project.cleanup_empty',
              params: {},
            });
            notify(t('notify.cleaned_empty'), 'success');
          }}
          title={t('hierarchy.cleanup')}
          aria-label={t('hierarchy.cleanup')}
        >
          <Sparkles className="w-3 h-3" />
        </button>
      </div>

      {/* Multi-Selection Batch Actions Bar */}
      {selectedNodeIds.length > 1 && (
        <div className="flex items-center justify-between px-2 py-1 bg-blue-950/40 border-b border-blue-900/50 text-dcc-sm">
          <span className="text-blue-300 font-mono text-[11px]">
            {t('hierarchy.batch_count', { count: selectedNodeIds.length })}
          </span>
          <div className="flex items-center space-x-1">
            <button
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-blue-900/40"
              onClick={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'node.batch_update',
                  params: { node_ids: selectedNodeIds, changes: { visible: true } },
                });
                notify(t('notify.nodes_shown'), 'info');
              }}
              title={t('hierarchy.batch_show')}
              aria-label={t('hierarchy.batch_show')}
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-blue-900/40"
              onClick={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'node.batch_update',
                  params: { node_ids: selectedNodeIds, changes: { visible: false } },
                });
                notify(t('notify.nodes_hidden'), 'info');
              }}
              title={t('hierarchy.batch_hide')}
              aria-label={t('hierarchy.batch_hide')}
            >
              <EyeOff className="w-3 h-3" />
            </button>
            <button
              className="p-1 text-rose-400 hover:text-rose-200 rounded hover:bg-rose-950/40"
              onClick={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'node.batch_delete',
                  params: { node_ids: selectedNodeIds },
                });
                notify(t('notify.nodes_deleted', { count: selectedNodeIds.length }), 'info');
              }}
              title={t('hierarchy.batch_delete')}
              aria-label={t('hierarchy.batch_delete')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {project.nodes.length === 0 ? (
          <div className="p-4 text-center text-dcc text-dcc-muted">
            <FolderTree className="w-7 h-7 mx-auto mb-3 text-zinc-600" />
            <p>{t('hierarchy.no_nodes')}</p>
            <p className="mt-1 text-dcc-sm text-zinc-500">{t('hierarchy.click_add')}</p>
          </div>
        ) : query ? (
          filteredNodes.length ? filteredNodes.map((node) => renderNode(node, 0, false)) : (
            <div className="p-4 text-center text-dcc text-dcc-muted">
              <Search className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
              <p>{t('hierarchy.no_results')}</p>
            </div>
          )
        ) : (
          rootNodes.map((n) => renderNode(n, 0))
        )}
      </div>
    </div>
  );
};

function generateDefaultPoints(cols: number, rows: number, bounds: [number, number, number, number]): [number, number][] {
  const [minX, minY, w, h] = bounds;
  const pts: [number, number][] = [];
  for (let r = 0; r <= rows; r++) {
    const y = minY + (h * r) / rows;
    for (let c = 0; c <= cols; c++) {
      const x = minX + (w * c) / cols;
      pts.push([x, y]);
    }
  }
  return pts;
}
