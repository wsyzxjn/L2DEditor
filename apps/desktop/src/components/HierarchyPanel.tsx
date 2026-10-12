import React from 'react';
import type { Node, Project } from '@l2d/schema';
import { Eye, EyeOff, Lock, Unlock, Grid, RotateCw, Image, Folder, Plus } from 'lucide-react';

interface HierarchyPanelProps {
  project: Project;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onExecuteCommand: (cmd: any) => void;
}

export const HierarchyPanel: React.FC<HierarchyPanelProps> = ({
  project,
  selectedNodeId,
  onSelectNode,
  onExecuteCommand,
}) => {
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

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          className={`flex items-center h-6 px-2 text-dcc hover:bg-dcc-hover cursor-pointer ${
            isSelected ? 'bg-dcc-accent/20 text-blue-300 font-medium' : 'text-dcc-text'
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onSelectNode(node.id)}
        >
          {/* Kind icon */}
          <KindIcon className="w-3.5 h-3.5 mr-1.5 text-dcc-muted shrink-0" />
          {/* Name */}
          <span className="truncate flex-1">{node.name || node.id}</span>

          {/* Visibility toggle */}
          <button
            className="p-1 hover:text-white text-dcc-muted"
            onClick={(e) => {
              e.stopPropagation();
              onExecuteCommand({
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
            onClick={(e) => {
              e.stopPropagation();
              onExecuteCommand({
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
    onExecuteCommand({
      id: `cmd_${Date.now()}`,
      name: 'node.add',
      params: {
        id,
        name: `Warp ${project.nodes.length + 1}`,
        parent_id: selectedNodeId,
        visible: true,
        locked: false,
        kind: {
          type: 'WarpDeformer',
          cols: 4,
          rows: 4,
          bounds: [600, 300, 400, 400],
          control_points: generateDefaultPoints(4, 4, [600, 300, 400, 400]),
        },
      },
    });
    onSelectNode(id);
  };

  return (
    <div className="flex flex-col h-full bg-dcc-panel border-r border-dcc-border">
      {/* Header bar */}
      <div className="flex items-center justify-between h-7 px-2 border-b border-dcc-border bg-dcc-header">
        <span className="text-dcc font-semibold uppercase tracking-wider text-dcc-muted">Hierarchy</span>
        <div className="flex items-center space-x-1">
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded"
            onClick={handleAddWarp}
            title="Add Warp Deformer"
          >
            <Plus className="w-3 h-3 mr-0.5" /> Warp
          </button>
        </div>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto py-1">
        {rootNodes.length === 0 ? (
          <div className="p-4 text-center text-dcc text-dcc-muted">No nodes. Import PSD to begin.</div>
        ) : (
          rootNodes.map((n) => renderNode(n, 0))
        )}
      </div>
    </div>
  );
};

function generateDefaultPoints(cols: number, rows: number, bounds: [number, number, number, number]) {
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
