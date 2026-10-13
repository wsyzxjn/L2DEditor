import React, { useState } from 'react';
import type { Node } from '@l2d/schema';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { Eye, EyeOff, Lock, Unlock, Grid, RotateCw, Image, Folder, Plus, PenTool, Sparkles, Search } from 'lucide-react';

export const HierarchyPanel: React.FC = () => {
  const { t } = useI18n();
  const { project, selectedNodeId, setSelectedNodeId, executeCommand, notify } = useEditor();
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

  const renderNode = (node: Node, depth: number) => {
    const isSelected = selectedNodeId === node.id;
    const children = childrenMap.get(node.id) || [];

    let KindIcon = Image;
    if (node.kind.type === 'WarpDeformer') KindIcon = Grid;
    else if (node.kind.type === 'RotationDeformer') KindIcon = RotateCw;
    else if (node.kind.type === 'Part') KindIcon = Folder;
    else if (node.kind.type === 'ArtPath') KindIcon = PenTool;

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          className={`flex items-center h-6 px-2 text-dcc hover:bg-dcc-hover cursor-pointer ${
            isSelected ? 'bg-dcc-accent/20 text-blue-300 font-medium' : 'text-dcc-text'
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => setSelectedNodeId(node.id)}
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

        {children.map((child) => renderNode(child, depth + 1))}
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
    <div className="flex flex-col h-full bg-dcc-panel border-r border-dcc-border">
      {/* Header bar */}
      <div className="flex items-center justify-between h-7 px-2 border-b border-dcc-border bg-dcc-header">
        <span className="text-dcc font-semibold uppercase tracking-wider text-dcc-muted">{t('hierarchy.title')}</span>
        <div className="flex items-center space-x-1">
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded transition-colors"
            onClick={handleAddWarp}
            title={t('hierarchy.warp')}
          >
            <Plus className="w-3 h-3 mr-0.5" /> {t('hierarchy.warp')}
          </button>
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded transition-colors"
            onClick={handleAddRotation}
            title={t('hierarchy.rot')}
          >
            <Plus className="w-3 h-3 mr-0.5" /> {t('hierarchy.rot')}
          </button>
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded transition-colors"
            onClick={handleAddPart}
            title={t('hierarchy.part')}
          >
            <Plus className="w-3 h-3 mr-0.5" /> {t('hierarchy.part')}
          </button>
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded border border-purple-500/30 transition-colors"
            onClick={handleAddArtPath}
            title={t('hierarchy.path')}
          >
            <PenTool className="w-3 h-3 mr-0.5" /> {t('hierarchy.path')}
          </button>
          <button
            className="p-1 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-zinc-400 hover:text-emerald-300 rounded transition-colors"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'project.cleanup_empty',
                params: {},
              });
              notify(t('notify.cleaned_empty'), 'success');
            }}
            title={t('hierarchy.cleanup')}
          >
            <Sparkles className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Node list */}
      <div className="px-2 py-1 border-b border-dcc-border bg-dcc-bg/40 flex items-center space-x-1.5">
        <Search className="w-3 h-3 text-zinc-500 shrink-0" />
        <input
          type="text"
          placeholder={t('hierarchy.filter_placeholder')}
          className="w-full h-5 bg-transparent text-dcc-sm text-dcc-text outline-none placeholder:text-zinc-600"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {project.nodes.length === 0 ? (
          <div className="p-4 text-center text-dcc text-dcc-muted">
            <p>{t('hierarchy.no_nodes')}</p>
            <p className="mt-1 text-dcc-sm text-zinc-500">{t('hierarchy.click_add')}</p>
          </div>
        ) : searchQuery.trim() ? (
          project.nodes
            .filter((n) => `${n.name} ${n.id}`.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((n) => renderNode(n, 0))
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
