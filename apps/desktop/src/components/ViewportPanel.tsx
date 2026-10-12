import React, { useRef, useEffect, useState } from 'react';
import { useEditor } from '../context/EditorContext.js';
import {
  MousePointer,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Zap,
  Smile,
} from 'lucide-react';
import earcut from 'earcut';

export const ViewportPanel: React.FC = () => {
  const {
    project,
    frame,
    selectedNodeId,
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

  const selectedNode = project.nodes.find((n) => n.id === selectedNodeId);
  const selectedWarp = selectedNode?.kind.type === 'WarpDeformer' ? selectedNode.kind : null;
  const selectedMesh = selectedNode?.kind.type === 'ArtMesh' ? selectedNode.kind : null;
  const selectedPath = selectedNode?.kind.type === 'DeformPath' ? selectedNode.kind : null;

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
    ctx.scale(zoom, zoom);
    ctx.translate(-project.canvas.width / 2, -project.canvas.height / 2);

    // Draw canvas border
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(0, 0, project.canvas.width, project.canvas.height);

    // Draw evaluated meshes (wireframe or solid preview)
    if (frame) {
      for (const mesh of frame.meshes) {
        if (mesh.opacity <= 0.01) continue;

        const isCurrentlyEdited = isMeshEditMode && selectedNodeId === mesh.id;

        ctx.save();
        ctx.globalAlpha = mesh.opacity;
        ctx.fillStyle = isCurrentlyEdited ? '#f43f5e22' : '#fbcfe8';
        ctx.strokeStyle = isCurrentlyEdited ? '#f43f5e' : '#ec4899';
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

    ctx.restore();
  }, [
    frame,
    pan,
    zoom,
    project.canvas,
    selectedWarp,
    selectedMesh,
    selectedPath,
    isMeshEditMode,
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

    // Dragging warp control point
    if (selectedNode && selectedWarp && draggingCpIndex !== null) {
      const nextCps = [...selectedWarp.control_points];
      nextCps[draggingCpIndex] = [wx, wy];
      executeCommand({
        id: `cmd_${Date.now()}`,
        name: 'node.update',
        params: {
          id: selectedNode.id,
          changes: {
            kind: {
              ...selectedWarp,
              control_points: nextCps,
            },
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
