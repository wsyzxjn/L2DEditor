import React, { useRef, useEffect, useState } from 'react';
import { useEditor } from '../context/EditorContext.js';

export const ViewportPanel: React.FC = () => {
  const { project, frame, selectedNodeId, executeCommand } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Dragging Warp control point
  const [draggingCpIndex, setDraggingCpIndex] = useState<number | null>(null);

  const selectedNode = project.nodes.find((n) => n.id === selectedNodeId);
  const selectedWarp = selectedNode?.kind.type === 'WarpDeformer' ? selectedNode.kind : null;

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

    // If there are no meshes yet, draw empty guidance
    if (!frame || frame.meshes.length === 0) {
      ctx.fillStyle = '#27272a';
      ctx.font = `${Math.round(24 / zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        'Empty Stage — Import PSD or create Deformers to begin',
        project.canvas.width / 2,
        project.canvas.height / 2
      );
    }

    // Draw evaluated meshes (wireframe or solid preview)
    if (frame) {
      for (const mesh of frame.meshes) {
        if (mesh.opacity <= 0.01) continue;

        ctx.save();
        ctx.globalAlpha = mesh.opacity;
        ctx.fillStyle = '#fbcfe8';
        ctx.strokeStyle = '#ec4899';
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

    // Draw Warp Gizmo if selected
    if (selectedWarp) {
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
        ctx.arc(cx, cy, 5 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 / zoom;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [frame, pan, zoom, project.canvas, selectedWarp, draggingCpIndex]);

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
      // Pan
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
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
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    setDraggingCpIndex(null);
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
      {/* Status Bar Overlay */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-dcc-sm text-zinc-400 pointer-events-none flex items-center space-x-3">
        <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
        <span>Pan: ({pan.x.toFixed(0)}, {pan.y.toFixed(0)})</span>
        <span>Meshes: {frame?.meshes.length ?? 0}</span>
        {selectedNode && <span className="text-blue-400">Selected: {selectedNode.name || selectedNode.id}</span>}
      </div>
    </div>
  );
};
