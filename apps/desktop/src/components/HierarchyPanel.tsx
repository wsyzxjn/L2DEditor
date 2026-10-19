import React, { useEffect, useRef, useState } from 'react';
import type { Node } from '@l2d/schema';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { OverflowMenu, OverflowMenuItem } from './OverflowMenu.js';
import { Eye, EyeOff, Lock, Unlock, Grid, RotateCw, Image, Folder, Plus, PenTool, Sparkles, Search, Trash2, FolderTree, X, ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown, LocateFixed } from 'lucide-react';

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
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));

  // Tree expansion is view state only; it never touches the document or undo history.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement | null>(null);

  const rows: { node: Node; depth: number }[] = [];
  if (query) {
    for (const node of filteredNodes) rows.push({ node, depth: 0 });
  } else {
    const visit = (parentId: string | null, depth: number) => {
      for (const node of childrenMap.get(parentId) ?? []) {
        rows.push({ node, depth });
        if (!collapsed.has(node.id)) visit(node.id, depth + 1);
      }
    };
    visit(null, 0);
  }

  const setExpanded = (id: string, expanded: boolean) =>
    setCollapsed((previous) => {
      if (previous.has(id) === !expanded) return previous;
      const next = new Set(previous);
      if (expanded) next.delete(id);
      else next.add(id);
      return next;
    });

  const revealNode = (id: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      for (let parent = nodeById.get(id)?.parent_id; parent; parent = nodeById.get(parent)?.parent_id) next.delete(parent);
      return next.size === previous.size ? previous : next;
    });
    requestAnimationFrame(() => {
      treeRef.current?.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  };

  // Follow selections made elsewhere (viewport, MCP) so the selected row is always visible.
  useEffect(() => {
    if (selectedNodeId) revealNode(selectedNodeId);
  }, [selectedNodeId]);

  const renameNode = (id: string, name: string) => {
    setRenamingId(null);
    const trimmed = name.trim();
    if (!trimmed || trimmed === nodeById.get(id)?.name) return;
    executeCommand({ id: `cmd_${crypto.randomUUID()}`, name: 'node.update', params: { id, changes: { name: trimmed } } });
  };

  const deleteSelection = () => {
    const ids = selectedNodeIds.length ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];
    if (!ids.length) return;
    executeCommand(ids.length > 1
      ? { id: `cmd_${crypto.randomUUID()}`, name: 'node.batch_delete', params: { node_ids: ids } }
      : { id: `cmd_${crypto.randomUUID()}`, name: 'node.delete', params: { id: ids[0] } });
    setSelectedNodeId(null);
    notify(t('notify.nodes_deleted', { count: ids.length }), 'info');
  };

  const handleTreeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (renamingId || !rows.length) return;
    const index = rows.findIndex((row) => row.node.id === selectedNodeId);
    const current = rows[index]?.node;
    const select = (row?: { node: Node }) => {
      if (row) setSelectedNodeId(row.node.id);
    };
    const hasChildren = current ? (childrenMap.get(current.id)?.length ?? 0) > 0 : false;
    switch (event.key) {
      case 'ArrowDown': select(rows[index < 0 ? 0 : Math.min(index + 1, rows.length - 1)]); break;
      case 'ArrowUp': select(rows[index < 0 ? 0 : Math.max(index - 1, 0)]); break;
      case 'Home': select(rows[0]); break;
      case 'End': select(rows[rows.length - 1]); break;
      case 'ArrowRight':
        if (current && hasChildren && !query) {
          if (collapsed.has(current.id)) setExpanded(current.id, true);
          else select(rows[index + 1]);
        }
        break;
      case 'ArrowLeft':
        if (current && hasChildren && !query && !collapsed.has(current.id)) setExpanded(current.id, false);
        else if (current?.parent_id) setSelectedNodeId(current.parent_id);
        break;
      case 'F2':
      case 'Enter':
        if (current) setRenamingId(current.id);
        break;
      case 'Delete':
      case 'Backspace':
        deleteSelection();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const renderRow = ({ node, depth }: { node: Node; depth: number }) => {
    const isSelected = selectedNodeIds.includes(node.id) || selectedNodeId === node.id;
    const hasChildren = !query && (childrenMap.get(node.id)?.length ?? 0) > 0;
    const isExpanded = hasChildren && !collapsed.has(node.id);

    let KindIcon = Image;
    if (node.kind.type === 'WarpDeformer') KindIcon = Grid;
    else if (node.kind.type === 'RotationDeformer') KindIcon = RotateCw;
    else if (node.kind.type === 'Part') KindIcon = Folder;
    else if (node.kind.type === 'ArtPath') KindIcon = PenTool;

    return (
      <div
        key={node.id}
        data-node-id={node.id}
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        className={`group flex items-center h-6 pr-1 text-dcc cursor-pointer select-none ${
          isSelected ? 'list-item-selected font-medium' : 'text-dcc-text hover:bg-dcc-hover'
        }`}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
        onClick={(e) => toggleSelectNodeId(node.id, e.shiftKey || e.metaKey || e.ctrlKey)}
        onDoubleClick={() => setRenamingId(node.id)}
      >
        {hasChildren ? (
          <button
            tabIndex={-1}
            className="shrink-0 p-0.5 rounded text-dcc-subtle hover:text-zinc-200"
            aria-label={isExpanded ? t('hierarchy.collapse') : t('hierarchy.expand')}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(node.id, !isExpanded);
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <KindIcon className="w-3.5 h-3.5 mx-1 text-dcc-muted shrink-0" />
        {renamingId === node.id ? (
          <input
            autoFocus
            defaultValue={node.name}
            aria-label={t('hierarchy.rename')}
            className="min-w-0 flex-1 h-5 px-1 rounded bg-dcc-bg border border-blue-500 text-dcc outline-none"
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => renameNode(node.id, e.currentTarget.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') renameNode(node.id, e.currentTarget.value);
              else if (e.key === 'Escape') {
                setRenamingId(null);
                treeRef.current?.focus();
              }
            }}
          />
        ) : (
          <span className="truncate flex-1">{node.name || node.id}</span>
        )}

        {/* Visibility toggle */}
        <button
          tabIndex={-1}
          className="p-1 hover:text-white text-dcc-muted"
          title={node.visible ? t('hierarchy.visible_on') : t('hierarchy.visible_off')}
          aria-label={node.visible ? t('hierarchy.visible_on') : t('hierarchy.visible_off')}
          onClick={(e) => {
            e.stopPropagation();
            executeCommand({
              id: `cmd_${crypto.randomUUID()}`,
              name: 'node.update',
              params: { id: node.id, changes: { visible: !node.visible } },
            });
          }}
        >
          {node.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-zinc-600" />}
        </button>

        {/* Lock toggle */}
        <button
          tabIndex={-1}
          className="p-1 hover:text-white text-dcc-muted"
          title={node.locked ? t('hierarchy.lock_on') : t('hierarchy.lock_off')}
          aria-label={node.locked ? t('hierarchy.lock_on') : t('hierarchy.lock_off')}
          onClick={(e) => {
            e.stopPropagation();
            executeCommand({
              id: `cmd_${crypto.randomUUID()}`,
              name: 'node.update',
              params: { id: node.id, changes: { locked: !node.locked } },
            });
          }}
        >
          {node.locked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3 text-zinc-600" />}
        </button>
      </div>
    );
  };

  const handleAddWarp = () => {
    const id = `warp_${Date.now()}`;
    const name = `Warp ${project.nodes.filter((n) => n.kind.type === 'WarpDeformer').length + 1}`;
    executeCommand({
      id: `cmd_${crypto.randomUUID()}`,
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
      id: `cmd_${crypto.randomUUID()}`,
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
      id: `cmd_${crypto.randomUUID()}`,
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
      id: `cmd_${crypto.randomUUID()}`,
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
          <Search className="w-3 h-3 text-dcc-subtle shrink-0" />
          <input
            type="text"
            placeholder={t('hierarchy.filter_placeholder')}
            aria-label={t('hierarchy.filter_placeholder')}
            className="min-w-0 flex-1 h-5 bg-transparent text-dcc-sm text-dcc-text outline-none placeholder:text-zinc-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="shrink-0 text-dcc-xs font-mono text-dcc-subtle" title={`${project.nodes.length}`}>
            {query ? `${filteredNodes.length}/${project.nodes.length}` : project.nodes.length}
          </span>
          {searchQuery && (
            <button className="p-0.5 rounded text-dcc-muted hover:text-white" onClick={() => setSearchQuery('')} aria-label={t('hierarchy.clear_search')} title={t('hierarchy.clear_search')}>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <OverflowMenu label={t('common.more')}>
          <OverflowMenuItem icon={ChevronsUpDown} label={t('hierarchy.expand_all')} onSelect={() => setCollapsed(new Set())} />
          <OverflowMenuItem
            icon={ChevronsDownUp}
            label={t('hierarchy.collapse_all')}
            onSelect={() => setCollapsed(new Set(project.nodes.filter((node) => childrenMap.has(node.id)).map((node) => node.id)))}
          />
          <OverflowMenuItem
            icon={LocateFixed}
            label={t('hierarchy.reveal')}
            onSelect={() => {
              if (!selectedNodeId) return;
              revealNode(selectedNodeId);
              treeRef.current?.focus();
            }}
          />
          <div className="my-1 h-px bg-dcc-border" role="separator" />
          <OverflowMenuItem
            icon={Sparkles}
            label={t('hierarchy.cleanup')}
            onSelect={() => {
              executeCommand({
                id: `cmd_${crypto.randomUUID()}`,
                name: 'project.cleanup_empty',
                params: {},
              });
              notify(t('notify.cleaned_empty'), 'success');
            }}
          />
        </OverflowMenu>
      </div>

      {/* Multi-Selection Batch Actions Bar */}
      {selectedNodeIds.length > 1 && (
        <div className="flex items-center justify-between px-2 py-1 bg-blue-950/40 border-b border-blue-900/50 text-dcc-sm">
          <span className="text-blue-300 font-mono text-[11px]">
            {t('hierarchy.batch_count', { count: selectedNodeIds.length })}
          </span>
          <div className="flex items-center space-x-1">
            <button
              className="p-1 text-dcc-muted hover:text-white rounded hover:bg-blue-900/40"
              onClick={() => {
                executeCommand({
                  id: `cmd_${crypto.randomUUID()}`,
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
              className="p-1 text-dcc-muted hover:text-white rounded hover:bg-blue-900/40"
              onClick={() => {
                executeCommand({
                  id: `cmd_${crypto.randomUUID()}`,
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
                  id: `cmd_${crypto.randomUUID()}`,
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

      <div
        ref={treeRef}
        role="tree"
        aria-label={t('hierarchy.title')}
        aria-multiselectable
        tabIndex={0}
        className="flex-1 overflow-y-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500"
        onKeyDown={handleTreeKeyDown}
      >
        {project.nodes.length === 0 ? (
          <div className="p-4 text-center text-dcc text-dcc-muted">
            <FolderTree className="w-7 h-7 mx-auto mb-3 text-zinc-600" />
            <p>{t('hierarchy.no_nodes')}</p>
            <p className="mt-1 text-dcc-sm text-dcc-subtle">{t('hierarchy.click_add')}</p>
          </div>
        ) : rows.length ? (
          rows.map(renderRow)
        ) : (
          <div className="p-4 text-center text-dcc text-dcc-muted">
            <Search className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
            <p>{t('hierarchy.no_results')}</p>
          </div>
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
