import React, { useRef, useEffect, useState } from 'react';
import { useEditor } from '../context/EditorContext.js';
import { evaluateProjectJs } from '@l2d/schema';
import {
  MousePointer,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Zap,
  Smile,
  Paintbrush,
  Layers,
  Route,
  Camera,
  Eye,
  FlipHorizontal,
  Shuffle,
} from 'lucide-react';
import earcut from 'earcut';

export const ViewportPanel: React.FC = () => {
  const {
    project,
    frame,
    selectedNodeId,
    parameterValues,
    setParameterValue,
    executeCommand,
    isMeshEditMode,
    setIsMeshEditMode,
    meshEditTool,
    setMeshEditTool,
    selectedVertexIndex,
    setSelectedVertexIndex,
    isPhysicsEnabled,
    setIsPhysicsEnabled,
    isAutoIdleEnabled,
    setIsAutoIdleEnabled,
    isOnionSkinEnabled,
    setIsOnionSkinEnabled,
    isMotionPathEnabled,
    setIsMotionPathEnabled,
    notify,
  } = useEditor();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Dragging states
  const [draggingCpIndex, setDraggingCpIndex] = useState<number | null>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [isWarpBrushActive, setIsWarpBrushActive] = useState(false);
  const [cursorWorldPos, setCursorWorldPos] = useState<[number, number]>([0, 0]);
  // Temporary Snapshot Slots 0..3 (`CMD_SAVE_TEMP_SNAP_SHOT_0..3`, `CMD_SHOW_TEMP_SNAP_SHOT_0..3`)
  const [tempSnapshots, setTempSnapshots] = useState<(typeof frame)[]>([null, null, null, null]);
  const [activeSnapshotSlot, setActiveSnapshotSlot] = useState<number | null>(null);
  // Solo Mode (`CMD_SOLO`), Screen Horizontal Flip (`CMD_CAMERA_FLIP_HORIZONTALLY_SCREEN`), and Edit Level (`CMD_EDIT_LEVEL_1..3`)
  const [isSoloMode, setIsSoloMode] = useState(false);
  const [isFlipScreenX, setIsFlipScreenX] = useState(false);
  const [editLevel, setEditLevel] = useState<1 | 2 | 3>(2);

  const selectedNode = project.nodes.find((n) => n.id === selectedNodeId);
  const selectedWarp = selectedNode?.kind.type === 'WarpDeformer' ? selectedNode.kind : null;
  const selectedMesh = selectedNode?.kind.type === 'ArtMesh' ? selectedNode.kind : null;
  const selectedPath = selectedNode?.kind.type === 'DeformPath' ? selectedNode.kind : null;
  const selectedArtPath = selectedNode?.kind.type === 'ArtPath' ? selectedNode.kind : null;

  // Convert mouse screen coordinates to canvas world coordinates
  const screenToWorld = (clientX: number, clientY: number): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const w = canvas.width;
    const h = canvas.height;

    const wx = (sx - (w / 2 + pan.x)) / zoom + project.canvas.width / 2;
    const wy = (sy - (h / 2 + pan.y)) / zoom + project.canvas.height / 2;
    return [wx, wy];
  };

  // Render frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Center canvas origin + pan/zoom
    ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
    ctx.scale(isFlipScreenX ? -zoom : zoom, zoom);
    ctx.translate(-project.canvas.width / 2, -project.canvas.height / 2);

    // Draw canvas border
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(0, 0, project.canvas.width, project.canvas.height);

    // Draw background grid lines (every 50px)
    ctx.save();
    ctx.strokeStyle = '#27272a66';
    ctx.lineWidth = 1 / zoom;
    const gridStep = 50;
    for (let gx = 0; gx <= project.canvas.width; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, project.canvas.height);
      ctx.stroke();
    }
    for (let gy = 0; gy <= project.canvas.height; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(project.canvas.width, gy);
      ctx.stroke();
    }

    // Draw symmetry center axis lines (dashed)
    ctx.strokeStyle = '#38bdf888';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    const midX = project.canvas.width / 2;
    const midY = project.canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, project.canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(project.canvas.width, midY);
    ctx.stroke();
    ctx.restore();

    // Draw Temporary Snapshot Comparison Slot if active (`CMD_SHOW_TEMP_SNAP_SHOT_0..3`)
    if (activeSnapshotSlot !== null && tempSnapshots[activeSnapshotSlot]) {
      const snapFrame = tempSnapshots[activeSnapshotSlot]!;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#a855f7';
      ctx.fillStyle = '#a855f722';
      ctx.lineWidth = 1.2 / zoom;
      for (const sm of snapFrame.meshes) {
        const verts = sm.vertices;
        const inds = sm.indices;
        for (let i = 0; i < inds.length; i += 3) {
          const i0 = inds[i] * 2;
          const i1 = inds[i + 1] * 2;
          const i2 = inds[i + 2] * 2;
          ctx.beginPath();
          ctx.moveTo(verts[i0], verts[i0 + 1]);
          ctx.lineTo(verts[i1], verts[i1 + 1]);
          ctx.lineTo(verts[i2], verts[i2 + 1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Draw Onion Skin ghosts (previous/next parameter states) if enabled
    if (isOnionSkinEnabled && project.parameters.length > 0) {
      const primaryParam = project.parameters[0];
      const ghostOffsets = [primaryParam.min, primaryParam.max];
      ghostOffsets.forEach((ghostVal, gIdx) => {
        const ghostFrame = evaluateProjectJs(project, {
          ...parameterValues,
          [primaryParam.id]: ghostVal,
        });
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = gIdx === 0 ? '#38bdf8' : '#f43f5e';
        ctx.fillStyle = gIdx === 0 ? '#38bdf818' : '#f43f5e18';
        ctx.lineWidth = 1 / zoom;
        for (const gm of ghostFrame.meshes) {
          const verts = gm.vertices;
          const inds = gm.indices;
          for (let i = 0; i < inds.length; i += 3) {
            const i0 = inds[i] * 2;
            const i1 = inds[i + 1] * 2;
            const i2 = inds[i + 2] * 2;
            ctx.beginPath();
            ctx.moveTo(verts[i0], verts[i0 + 1]);
            ctx.lineTo(verts[i1], verts[i1 + 1]);
            ctx.lineTo(verts[i2], verts[i2 + 1]);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      });
    }

    // Draw evaluated meshes (wireframe or solid preview)
    if (frame) {
      for (const mesh of frame.meshes) {
        if (mesh.opacity <= 0.01) continue;
        if (isSoloMode && selectedNodeId && mesh.id !== selectedNodeId) {
          // Check if mesh is a descendant of selectedNodeId
          let isDescendant = false;
          let cur = project.nodes.find((n) => n.id === mesh.id)?.parent_id || null;
          while (cur) {
            if (cur === selectedNodeId) {
              isDescendant = true;
              break;
            }
            cur = project.nodes.find((n) => n.id === cur)?.parent_id || null;
          }
          if (!isDescendant) continue;
        }

        const isCurrentlyEdited = isMeshEditMode && selectedNodeId === mesh.id;
        const isArtPathMesh = mesh.texture_id === '__artpath_solid__';

        ctx.save();
        ctx.globalAlpha = mesh.opacity;
        if (isArtPathMesh) {
          const mc = mesh.multiply_color || [0.15, 0.15, 0.18, 1];
          ctx.fillStyle = `rgba(${Math.round(mc[0] * 255)}, ${Math.round(mc[1] * 255)}, ${Math.round(mc[2] * 255)}, ${mc[3] ?? 1})`;
          ctx.strokeStyle = '#38bdf8';
        } else {
          ctx.fillStyle = isCurrentlyEdited ? '#f43f5e22' : '#fbcfe8';
          ctx.strokeStyle = isCurrentlyEdited ? '#f43f5e' : '#ec4899';
        }
        ctx.lineWidth = 1 / zoom;

        const verts = mesh.vertices;
        const inds = mesh.indices;

        for (let i = 0; i < inds.length; i += 3) {
          const i0 = inds[i] * 2;
          const i1 = inds[i + 1] * 2;
          const i2 = inds[i + 2] * 2;

          ctx.beginPath();
          ctx.moveTo(verts[i0], verts[i0 + 1]);
          ctx.lineTo(verts[i1], verts[i1 + 1]);
          ctx.lineTo(verts[i2], verts[i2 + 1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Draw Motion Path trajectory if enabled
    if (isMotionPathEnabled && project.parameters.length > 0 && frame && frame.meshes.length > 0) {
      const primaryParam = project.parameters[0];
      const targetMeshId = selectedNodeId || frame.meshes[0].id;
      const sampleCount = 9;
      const trajectory: [number, number][] = [];
      for (let s = 0; s <= sampleCount; s++) {
        const v = primaryParam.min + ((primaryParam.max - primaryParam.min) * s) / sampleCount;
        const sf = evaluateProjectJs(project, { ...parameterValues, [primaryParam.id]: v });
        const m = sf.meshes.find((mm) => mm.id === targetMeshId) || sf.meshes[0];
        if (m && m.vertices.length >= 2) {
          let cx = 0, cy = 0;
          const nPts = m.vertices.length / 2;
          for (let i = 0; i < m.vertices.length; i += 2) {
            cx += m.vertices[i];
            cy += m.vertices[i + 1];
          }
          trajectory.push([cx / nPts, cy / nPts]);
        }
      }
      if (trajectory.length >= 2) {
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.beginPath();
        trajectory.forEach(([tx, ty], idx) => {
          if (idx === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        });
        ctx.stroke();
        trajectory.forEach(([tx, ty]) => {
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(tx, ty, 3 / zoom, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }
    }

    // In Mesh Edit Mode: draw all vertices as editable dots
    if (isMeshEditMode && selectedMesh) {
      ctx.save();
      for (let i = 0; i < selectedMesh.vertices.length; i++) {
        const [vx, vy] = selectedMesh.vertices[i];
        const isSelected = selectedVertexIndex === i || draggingVertexIndex === i;
        ctx.fillStyle = isSelected ? '#fbbf24' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(vx, vy, (isSelected ? 5 : 3.5) / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 / zoom;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Warp Gizmo if selected
    if (selectedWarp && !isMeshEditMode) {
      const cps = selectedWarp.control_points;
      const cols = selectedWarp.cols;
      const rows = selectedWarp.rows;
      const stride = cols + 1;

      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5 / zoom;

      // Grid horizontal lines
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
          const pt = cps[r * stride + c];
          if (c === 0) ctx.moveTo(pt[0], pt[1]);
          else ctx.lineTo(pt[0], pt[1]);
        }
        ctx.stroke();
      }

      // Grid vertical lines
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        for (let r = 0; r <= rows; r++) {
          const pt = cps[r * stride + c];
          if (r === 0) ctx.moveTo(pt[0], pt[1]);
          else ctx.lineTo(pt[0], pt[1]);
        }
        ctx.stroke();
      }

      // Control point dots
      for (let i = 0; i < cps.length; i++) {
        const [cx, cy] = cps[i];
        ctx.fillStyle = i === draggingCpIndex ? '#f43f5e' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 / zoom;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Deform Path if selected
    if (selectedPath) {
      const pts = selectedPath.control_points;
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5 / zoom;

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
        else ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();

      for (let i = 0; i < pts.length; i++) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(pts[i][0], pts[i][1], 5 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 / zoom;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw ArtPath control points if selected
    if (selectedArtPath) {
      const pts = selectedArtPath.points;
      ctx.save();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.pos[0], p.pos[1]);
        else ctx.lineTo(p.pos[0], p.pos[1]);
      });
      if (selectedArtPath.closed && pts.length > 2) ctx.closePath();
      ctx.stroke();
      pts.forEach((p) => {
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(p.pos[0], p.pos[1], Math.max(4, p.width * 0.5) / zoom, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    ctx.restore();
  }, [
    frame,
    pan,
    zoom,
    project,
    parameterValues,
    selectedWarp,
    selectedMesh,
    selectedPath,
    selectedArtPath,
    isMeshEditMode,
    isOnionSkinEnabled,
    isMotionPathEnabled,
    activeSnapshotSlot,
    tempSnapshots,
    isSoloMode,
    isFlipScreenX,
    editLevel,
    selectedVertexIndex,
    draggingVertexIndex,
    draggingCpIndex,
  ]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.max(0.1, Math.min(5.0, z * factor)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const [wx, wy] = screenToWorld(e.clientX, e.clientY);

    // Mesh Edit Mode interaction
    if (isMeshEditMode && selectedNode && selectedMesh) {
      if (meshEditTool === 'add') {
        // Add new vertex and UV
        const uv: [number, number] = [
          (wx - 400) / 400, // normalized approx
          (wy - 400) / 400,
        ];
        executeCommand({
          id: `cmd_${Date.now()}`,
          name: 'mesh.add_vertex',
          params: {
            mesh_id: selectedNode.id,
            vertex: [wx, wy],
            uv,
          },
        });
        notify(`Added vertex at (${Math.round(wx)}, ${Math.round(wy)})`, 'info');
        return;
      }

      // Check if clicked an existing vertex
      const hitRadius = 8 / zoom;
      let clickedIdx: number | null = null;
      for (let i = 0; i < selectedMesh.vertices.length; i++) {
        const [vx, vy] = selectedMesh.vertices[i];
        if (Math.hypot(vx - wx, vy - wy) <= hitRadius) {
          clickedIdx = i;
          break;
        }
      }

      if (clickedIdx !== null) {
        if (meshEditTool === 'delete') {
          executeCommand({
            id: `cmd_${Date.now()}`,
            name: 'mesh.delete_vertex',
            params: {
              mesh_id: selectedNode.id,
              vertex_index: clickedIdx,
            },
          });
          notify(`Deleted vertex #${clickedIdx}`, 'info');
          setSelectedVertexIndex(null);
          return;
        }

        setSelectedVertexIndex(clickedIdx);
        setDraggingVertexIndex(clickedIdx);
        return;
      }
    }

    // Warp Deformer interaction
    if (selectedWarp && !isMeshEditMode) {
      const hitRadius = 8 / zoom;
      for (let i = 0; i < selectedWarp.control_points.length; i++) {
        const [cx, cy] = selectedWarp.control_points[i];
        if (Math.hypot(cx - wx, cy - wy) <= hitRadius) {
          setDraggingCpIndex(i);
          return;
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }

    const [wx, wy] = screenToWorld(e.clientX, e.clientY);
    setCursorWorldPos([wx, wy]);

    // Dragging mesh vertex
    if (isMeshEditMode && selectedNode && selectedMesh && draggingVertexIndex !== null) {
      executeCommand({
        id: `cmd_${Date.now()}`,
        name: 'mesh.move_vertex',
        params: {
          mesh_id: selectedNode.id,
          vertex_index: draggingVertexIndex,
          position: [wx, wy],
        },
      });
      return;
    }

    // Brush deform on warp
    if (isWarpBrushActive && selectedNode && selectedWarp && e.buttons === 1) {
      const [prevWx, prevWy] = screenToWorld(lastMousePos.current.x, lastMousePos.current.y);
      const deltaX = wx - prevWx;
      const deltaY = wy - prevWy;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      executeCommand({
        id: `cmd_${Date.now()}`,
        name: 'warp.brush_deform',
        params: {
          node_id: selectedNode.id,
          center: [wx, wy],
          delta: [deltaX, deltaY],
          radius: 120,
        },
      });
      return;
    }

    // Dragging warp control point (updates active keyform if bound, or base warp if unbound)
    if (selectedNode && selectedWarp && draggingCpIndex !== null) {
      const nextCps = [...selectedWarp.control_points];
      nextCps[draggingCpIndex] = [wx, wy];
      executeCommand({
        id: `cmd_${Date.now()}`,
        name: 'keyform.update_at_params',
        params: {
          target_node_id: selectedNode.id,
          params: parameterValues,
          payload: {
            kind: 'Warp',
            control_points: nextCps,
          },
        },
      });
      return;
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    setDraggingCpIndex(null);
    setDraggingVertexIndex(null);
  };

  // Re-triangulate current edited mesh using earcut
  const handleRetriangulate = () => {
    if (!selectedNode || !selectedMesh) return;
    const flat: number[] = [];
    for (const [vx, vy] of selectedMesh.vertices) {
      flat.push(vx, vy);
    }
    const newIndices = earcut(flat);
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'node.update',
      params: {
        id: selectedNode.id,
        changes: {
          kind: {
            ...selectedMesh,
            indices: newIndices,
          },
        },
      },
    });
    notify(`Retriangulated mesh: ${newIndices.length / 3} triangles generated`, 'success');
  };

  return (
    <div className="relative w-full h-full bg-[#101012] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {/* Top Floating Viewport Toolbar (Mesh Edit & Physics) */}
      <div className="absolute top-2 left-2 z-10 flex items-center space-x-1.5 bg-dcc-panel/90 backdrop-blur px-2 py-1 rounded border border-dcc-border shadow-lg">
        {selectedMesh && (
          <button
            className={`flex items-center px-2 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
              isMeshEditMode
                ? 'bg-rose-600 text-white shadow'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            onClick={() => setIsMeshEditMode(!isMeshEditMode)}
          >
            {isMeshEditMode ? <Check className="w-3 h-3 mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
            {isMeshEditMode ? 'Finish Mesh Edit' : 'Edit Mesh'}
          </button>
        )}

        {/* Mesh Edit Toolset */}
        {selectedWarp && !isMeshEditMode && (
          <button
            className={`flex items-center px-2 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
              isWarpBrushActive
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            onClick={() => setIsWarpBrushActive(!isWarpBrushActive)}
            title="Soft Selection Deform Brush (变形画笔)"
          >
            <Paintbrush className="w-3 h-3 mr-1" />
            Brush
          </button>
        )}

        {isMeshEditMode && selectedMesh && (
          <div className="flex items-center space-x-1 border-l border-dcc-border pl-1.5">
            <button
              className={`p-1 rounded text-dcc-sm ${
                meshEditTool === 'select' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'
              }`}
              onClick={() => setMeshEditTool('select')}
              title="Select / Move Vertex"
            >
              <MousePointer className="w-3 h-3" />
            </button>
            <button
              className={`p-1 rounded text-dcc-sm ${
                meshEditTool === 'add' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'
              }`}
              onClick={() => setMeshEditTool('add')}
              title="Add Vertex"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              className={`p-1 rounded text-dcc-sm ${
                meshEditTool === 'delete' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:bg-zinc-700'
              }`}
              onClick={() => setMeshEditTool('delete')}
              title="Delete Vertex"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <button
              className="px-1.5 py-0.5 text-dcc-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-mono"
              onClick={handleRetriangulate}
              title="Auto Retriangulate Delaunay Mesh"
            >
              Triangulate
            </button>
            <button
              className="px-1.5 py-0.5 text-dcc-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-mono"
              onClick={() => {
                if (selectedNode) {
                  executeCommand({
                    id: `cmd_${Date.now()}`,
                    name: 'mesh.subdivide',
                    params: { mesh_id: selectedNode.id },
                  });
                  notify('Subdivided mesh into finer triangles', 'success');
                }
              }}
              title="Subdivide all triangles into 4 finer triangles"
            >
              Subdivide
            </button>
          </div>
        )}

        <div className="h-3 w-px bg-dcc-border" />

        {/* Physics Live Mode Toggle */}
        <button
          className={`flex items-center px-2 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
            isPhysicsEnabled
              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
          onClick={() => {
            setIsPhysicsEnabled(!isPhysicsEnabled);
            notify(`Physics simulation ${!isPhysicsEnabled ? 'ENABLED' : 'DISABLED'}`, 'info');
          }}
          title="Toggle live physics simulation"
        >
          <Zap className="w-3 h-3 mr-1" />
          Physics
        </button>

        {/* Auto Idle Natural Posing Toggle */}
        <button
          className={`flex items-center px-2 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
            isAutoIdleEnabled
              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
          onClick={() => {
            setIsAutoIdleEnabled(!isAutoIdleEnabled);
            notify(`Auto Idle posing ${!isAutoIdleEnabled ? 'ENABLED' : 'DISABLED'}`, 'info');
          }}
          title="Toggle automatic natural breathing and posing"
        >
          <Smile className="w-3 h-3 mr-1" />
          Auto Idle
        </button>

        {/* Onion Skin Toggle (CMD_PREVIEW_ONIONSKIN_MODELER) */}
        <button
          className={`flex items-center px-2 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
            isOnionSkinEnabled
              ? 'bg-sky-600/30 text-sky-300 border border-sky-500/50'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
          onClick={() => {
            setIsOnionSkinEnabled(!isOnionSkinEnabled);
            notify(`Onion Skin ${!isOnionSkinEnabled ? 'ENABLED' : 'DISABLED'}`, 'info');
          }}
          title="Toggle Onion Skin Ghosting (洋葱皮前后关键帧重影)"
        >
          <Layers className="w-3 h-3 mr-1" />
          Onion Skin
        </button>

        {/* Motion Path Toggle (CMD_PREVIEW_MOTIONPATH_ANIMATION) */}
        <button
          className={`flex items-center px-2 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
            isMotionPathEnabled
              ? 'bg-teal-600/30 text-teal-300 border border-teal-500/50'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
          onClick={() => {
            setIsMotionPathEnabled(!isMotionPathEnabled);
            notify(`Motion Path ${!isMotionPathEnabled ? 'ENABLED' : 'DISABLED'}`, 'info');
          }}
          title="Toggle Motion Path Trajectory (运动轨迹预览)"
        >
          <Route className="w-3 h-3 mr-1" />
          Motion Path
        </button>

        {/* Solo Mode (`CMD_SOLO`, S) */}
        <button
          className={`flex items-center px-1.5 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
            isSoloMode
              ? 'bg-amber-500 text-black'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
          onClick={() => {
            setIsSoloMode(!isSoloMode);
            notify(`Solo View ${!isSoloMode ? 'ENABLED' : 'DISABLED'}`, 'info');
          }}
          title="Solo Selected Node/Branch (独显模式 S)"
        >
          <Eye className="w-3 h-3 mr-0.5" /> Solo
        </button>

        {/* Horizontal Screen Flip (`CMD_CAMERA_FLIP_HORIZONTALLY_SCREEN`, R) */}
        <button
          className={`flex items-center px-1.5 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
            isFlipScreenX
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
          }`}
          onClick={() => {
            setIsFlipScreenX(!isFlipScreenX);
            notify(`Horizontal Screen Mirror ${!isFlipScreenX ? 'ON' : 'OFF'}`, 'info');
          }}
          title="Flip Viewport Horizontally (水平镜像检查 R)"
        >
          <FlipHorizontal className="w-3 h-3" />
        </button>

        {/* Random Pose (`CMD_PLAY_OR_STOP_RANDOM_POSE`) */}
        <button
          className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
          onClick={() => {
            project.parameters.forEach((p, idx) => {
              if (!p.locked) {
                const t = ((Math.sin(Date.now() * 0.003 + idx * 1.7) + 1) * 0.5);
                const val = Number((p.min + (p.max - p.min) * t).toFixed(2));
                setParameterValue(p.id, val);
              }
            });
            notify('Applied Random Pose across unlocked parameters', 'info');
          }}
          title="Random Pose Test (随机姿势测试)"
        >
          <Shuffle className="w-3 h-3" />
        </button>

        {/* Edit Levels 1/2/3 (`CMD_EDIT_LEVEL_1..3`) */}
        <div className="flex items-center space-x-0.5 bg-zinc-900 px-1 py-0.5 rounded border border-dcc-border">
          {([1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              className={`px-1 text-[10px] font-mono rounded ${
                editLevel === lvl ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => {
                setEditLevel(lvl);
                if (lvl === 1 && selectedMesh) setIsMeshEditMode(true);
                else if (lvl !== 1 && isMeshEditMode) setIsMeshEditMode(false);
                notify(`Switched to Edit Level ${lvl}`, 'info');
              }}
              title={`Edit Level ${lvl} (编辑级别 ${lvl})`}
            >
              L{lvl}
            </button>
          ))}
        </div>

        <div className="h-3 w-px bg-dcc-border" />

        {/* Temporary Snapshot Slots 1..4 (`CMD_SAVE_TEMP_SNAP_SHOT_0..3`) */}
        <div className="flex items-center space-x-1">
          <Camera className="w-3 h-3 text-purple-400 mr-0.5" />
          {[0, 1, 2, 3].map((slot) => {
            const hasSnap = !!tempSnapshots[slot];
            const isShowing = activeSnapshotSlot === slot;
            return (
              <button
                key={slot}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  isShowing
                    ? 'bg-purple-600 text-white'
                    : hasSnap
                    ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
                onClick={(e) => {
                  if (e.shiftKey || !hasSnap) {
                    setTempSnapshots((prev) => {
                      const next = [...prev];
                      next[slot] = frame ? JSON.parse(JSON.stringify(frame)) : null;
                      return next;
                    });
                    setActiveSnapshotSlot(slot);
                    notify(`Saved Temporary Snapshot #${slot + 1} (Shift+Click to overwrite)`, 'success');
                  } else {
                    setActiveSnapshotSlot(isShowing ? null : slot);
                  }
                }}
                title={`Snapshot Slot #${slot + 1}: Click to toggle comparison, Shift+Click to save current frame`}
              >
                S{slot + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Status Bar Overlay */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-dcc-sm text-zinc-400 pointer-events-none flex items-center space-x-3">
        <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        <span>Pan: ({pan.x.toFixed(0)}, {pan.y.toFixed(0)})</span>
        <span>Meshes: {frame?.meshes.length ?? 0}</span>
        {selectedNode && (
          <span className="text-blue-400 font-medium">Selected: {selectedNode.name || selectedNode.id}</span>
        )}
        {isMeshEditMode && <span className="text-rose-400 font-bold uppercase tracking-wider">EDITING MESH</span>}
      </div>
    </div>
  );
};
