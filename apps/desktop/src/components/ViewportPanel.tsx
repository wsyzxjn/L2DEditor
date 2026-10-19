import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEditor, useEditorRuntime } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { evaluateProjectJs, triangleWeights, type EvaluatedFrameJs, type Project } from '@l2d/schema';
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
  Eye,
  FlipHorizontal,
  Shuffle,
  Maximize2,
  Crop,
  Grid,
  FolderOpen,
  FileUp,
} from 'lucide-react';
import earcut from 'earcut';
import { ModelArtwork } from './ModelArtwork.js';
import { OverflowMenu, OverflowMenuItem, OverflowMenuLabel } from './OverflowMenu.js';

function sameParameters(left: Record<string, number> | null, right: Record<string, number>): boolean {
  if (!left) return false;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) && left[key] === right[key]);
}

export const ViewportPanel: React.FC = () => {
  const { t } = useI18n();
  const {
    project,
    bus,
    currentFilePath,
    openProject,
    importPsd,
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
    isOnionSkinEnabled,
    setIsOnionSkinEnabled,
    isMotionPathEnabled,
    setIsMotionPathEnabled,
    isGridSnapEnabled,
    setIsGridSnapEnabled,
    gridSize,
    viewportControls,
    notify,
  } = useEditor();
  const {
    frame,
    parameterValues,
    setParameterValue,
    isPlayingAnimation,
  } = useEditorRuntime();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [artworkReady, setArtworkReady] = useState(false);
  const renderedFrame = useRef<EvaluatedFrameJs | null>(null);
  const captureRef = useRef<((scale: number) => Promise<string>) | null>(null);
  const onArtworkRendered = useCallback((rendered: EvaluatedFrameJs | null) => { renderedFrame.current = rendered; }, []);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
  const isPanning = useRef(false);
  const dragTransactionActive = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const overlayCacheRef = useRef<{
    project: Project | null;
    parameters: Record<string, number> | null;
    primaryParamId: string | null;
    targetMeshId: string | null;
    live: boolean;
    onionFrames: EvaluatedFrameJs[];
    trajectory: [number, number][];
  }>({
    project: null,
    parameters: null,
    primaryParamId: null,
    targetMeshId: null,
    live: false,
    onionFrames: [],
    trajectory: [],
  });

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
  // Free Quad Perspective Gizmo (`CMD_CREATE_FREE_DEFORM_HANDLER_AS_PERSPECTIVE_MODE`)
  const [isFreeQuadActive, setIsFreeQuadActive] = useState(false);
  const [quadCorners, setQuadCorners] = useState<[[number, number], [number, number], [number, number], [number, number]] | null>(null);
  const [draggingQuadCornerIdx, setDraggingQuadCornerIdx] = useState<number | null>(null);

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

    const wx = (sx - (w / 2 + pan.x)) / (isFlipScreenX ? -zoom : zoom) + project.canvas.width / 2;
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
    ctx.strokeStyle = isGridSnapEnabled ? '#38bdf844' : '#27272a66';
    ctx.lineWidth = (isGridSnapEnabled ? 1.2 : 1) / zoom;
    const gridStep = gridSize || 50;
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

    const primaryOverlayParam = project.parameters[0] ?? null;
    const motionTargetMeshId = selectedNodeId ?? frame?.meshes[0]?.id ?? null;
    const liveOverlay = isPlayingAnimation || isPhysicsEnabled || isAutoIdleEnabled;
    const overlayCache = overlayCacheRef.current;
    const overlayRequested = isOnionSkinEnabled || isMotionPathEnabled;
    const needsOverlayRefresh = overlayRequested && (
      overlayCache.project !== project
      || overlayCache.primaryParamId !== (primaryOverlayParam?.id ?? null)
      || overlayCache.targetMeshId !== motionTargetMeshId
      || (liveOverlay && !overlayCache.live)
      || (!liveOverlay && (overlayCache.live || !sameParameters(overlayCache.parameters, parameterValues)))
    );
    if (needsOverlayRefresh) {
      const onionFrames: EvaluatedFrameJs[] = [];
      if (isOnionSkinEnabled && primaryOverlayParam) {
        for (const ghostValue of [primaryOverlayParam.min, primaryOverlayParam.max]) {
          onionFrames.push(evaluateProjectJs(project, {
            ...parameterValues,
            [primaryOverlayParam.id]: ghostValue,
          }));
        }
      }
      const trajectory: [number, number][] = [];
      if (isMotionPathEnabled && primaryOverlayParam && frame && frame.meshes.length > 0 && motionTargetMeshId) {
        const sampleCount = 9;
        for (let sample = 0; sample <= sampleCount; sample++) {
          const value = primaryOverlayParam.min
            + ((primaryOverlayParam.max - primaryOverlayParam.min) * sample) / sampleCount;
          const sampledFrame = evaluateProjectJs(project, {
            ...parameterValues,
            [primaryOverlayParam.id]: value,
          });
          const mesh = sampledFrame.meshes.find(candidate => candidate.id === motionTargetMeshId)
            ?? sampledFrame.meshes[0];
          if (!mesh || mesh.vertices.length < 2) continue;
          let centerX = 0;
          let centerY = 0;
          const pointCount = mesh.vertices.length / 2;
          for (let index = 0; index < mesh.vertices.length; index += 2) {
            centerX += mesh.vertices[index];
            centerY += mesh.vertices[index + 1];
          }
          trajectory.push([centerX / pointCount, centerY / pointCount]);
        }
      }
      overlayCacheRef.current = {
        project,
        parameters: { ...parameterValues },
        primaryParamId: primaryOverlayParam?.id ?? null,
        targetMeshId: motionTargetMeshId,
        live: liveOverlay,
        onionFrames,
        trajectory,
      };
    }

    // Draw Onion Skin ghosts (previous/next parameter states) if enabled
    if (isOnionSkinEnabled && primaryOverlayParam) {
      overlayCacheRef.current.onionFrames.forEach((ghostFrame, gIdx) => {
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
          if (!artworkReady || isArtPathMesh) ctx.fill();
          if (!artworkReady || selectedNodeId === mesh.id || isCurrentlyEdited) ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Draw Motion Path trajectory if enabled
    if (isMotionPathEnabled && primaryOverlayParam && frame && frame.meshes.length > 0) {
      const trajectory = overlayCacheRef.current.trajectory;
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

    // Draw 4-Point Perspective Free Quad Gizmo if active
    if (isFreeQuadActive && quadCorners) {
      const [tl, tr, bl, br] = quadCorners;
      ctx.save();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.beginPath();
      ctx.moveTo(tl[0], tl[1]);
      ctx.lineTo(tr[0], tr[1]);
      ctx.lineTo(br[0], br[1]);
      ctx.lineTo(bl[0], bl[1]);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      [tl, tr, bl, br].forEach(([qx, qy], qIdx) => {
        ctx.fillStyle = draggingQuadCornerIdx === qIdx ? '#fbbf24' : '#f43f5e';
        ctx.fillRect(qx - 5 / zoom, qy - 5 / zoom, 10 / zoom, 10 / zoom);
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
    selectedNodeId,
    selectedWarp,
    selectedMesh,
    selectedPath,
    selectedArtPath,
    isMeshEditMode,
    isOnionSkinEnabled,
    isMotionPathEnabled,
    isPlayingAnimation,
    isPhysicsEnabled,
    isAutoIdleEnabled,
    activeSnapshotSlot,
    tempSnapshots,
    isSoloMode,
    isFlipScreenX,
    editLevel,
    isFreeQuadActive,
    quadCorners,
    draggingQuadCornerIdx,
    selectedVertexIndex,
    draggingVertexIndex,
    draggingCpIndex,
    artworkReady,
    canvasSize,
  ]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
      setCanvasSize({ width: canvas.width, height: canvas.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  const fitModel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPan({ x: 0, y: 0 });
    setZoom(Math.max(0.1, Math.min((canvas.width - 64) / project.canvas.width, (canvas.height - 112) / project.canvas.height)));
  }, [project.canvas.width, project.canvas.height]);

  useEffect(() => { fitModel(); }, [currentFilePath, fitModel]);

  useEffect(() => {
    viewportControls.current = {
      getState: () => ({ zoom, pan, flipped: isFlipScreenX, solo: isSoloMode, texturesReady: artworkReady, frameRendered: frame !== null && renderedFrame.current === frame }),
      hasRenderedFrame: expected => expected !== null && renderedFrame.current === expected,
      update: request => {
        if (request.fit) fitModel();
        if (request.zoom !== undefined) setZoom(request.zoom);
        if (request.pan !== undefined) setPan(request.pan);
        if (request.flipped !== undefined) setIsFlipScreenX(request.flipped);
        if (request.solo !== undefined) setIsSoloMode(request.solo);
      },
      captureModel: scale => {
        if (!captureRef.current) throw new Error('Model renderer is not ready');
        return captureRef.current(scale);
      },
    };
    return () => { viewportControls.current = null; };
  }, [viewportControls, zoom, pan, isFlipScreenX, isSoloMode, artworkReady, fitModel, frame]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.max(0.1, Math.min(5.0, z * factor)));
  };

  const finishDragTransaction = useCallback((commit: boolean) => {
    if (!dragTransactionActive.current) return;
    dragTransactionActive.current = false;
    try {
      if (commit) bus.commitTransaction();
      else bus.rollbackTransaction();
    } catch {
      // The transaction may already have been committed by another pointer path.
    }
  }, [bus]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!bus.isTransactionActive()) {
      bus.beginTransaction();
      dragTransactionActive.current = true;
    }

    const [wx, wy] = screenToWorld(e.clientX, e.clientY);
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    // Free Quad Corner Handle interaction
    if (isFreeQuadActive && quadCorners) {
      const hitRadius = 10 / zoom;
      for (let i = 0; i < 4; i++) {
        const [qx, qy] = quadCorners[i];
        if (Math.hypot(qx - wx, qy - wy) <= hitRadius) {
          setDraggingQuadCornerIdx(i);
          return;
        }
      }
    }

    // Mesh Edit Mode interaction
    if (isMeshEditMode && selectedNode && selectedMesh) {
      if (meshEditTool === 'add') {
        const surface = renderedFrame.current?.meshes.find(mesh => mesh.id === selectedNode.id);
        if (!surface || selectedNode.locked) return;
        if (surface.vertices.length !== selectedMesh.vertices.length * 2) return;
        let pos: [number, number] | undefined;
        for (let i = 0; i < surface.indices.length; i += 3) {
          const ids = surface.indices.slice(i, i + 3);
          const points = ids.map(id => [surface.vertices[id * 2], surface.vertices[id * 2 + 1]]);
          const weights = triangleWeights([wx, wy], points[0], points[1], points[2]);
          if (!weights) continue;
          // Invert the displayed triangle into the mesh's rest-space surface.
          pos = [0, 1].map(axis => ids.reduce((sum, id, j) => sum + selectedMesh.vertices[id][axis] * weights[j], 0)) as [number, number];
          break;
        }
        if (!pos) { notify(t('viewport.vertex_outside'), 'error'); return; }
        const result = executeCommand({
          id: `cmd_${crypto.randomUUID()}`,
          name: 'mesh.add_vertex',
          params: { node_id: selectedNode.id, pos },
        });
        if (result.success) notify(t('notify.vertex_added', { x: Math.round(wx), y: Math.round(wy) }), 'info');
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
            id: `cmd_${crypto.randomUUID()}`,
            name: 'mesh.delete_vertex',
            params: {
              mesh_id: selectedNode.id,
              vertex_index: clickedIdx,
            },
          });
          notify(t('notify.vertex_deleted', { index: clickedIdx }), 'info');
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

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }

    const [wx, wy] = screenToWorld(e.clientX, e.clientY);
    setCursorWorldPos([wx, wy]);

    // Dragging Free Quad Perspective Handle
    if (isFreeQuadActive && selectedNode && quadCorners && draggingQuadCornerIdx !== null) {
      const nextCorners = quadCorners.map((c) => [...c] as [number, number]) as [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
      ];
      nextCorners[draggingQuadCornerIdx] = [wx, wy];
      setQuadCorners(nextCorners);
      executeCommand({
        id: `cmd_${crypto.randomUUID()}`,
        name: 'deform.free_quad',
        params: {
          node_id: selectedNode.id,
          quad_corners: nextCorners,
          mode: 'perspective',
        },
      });
      return;
    }

    // Dragging mesh vertex
    if (isMeshEditMode && selectedNode && selectedMesh && draggingVertexIndex !== null) {
      const step = gridSize || 50;
      const targetX = isGridSnapEnabled ? Math.round(wx / step) * step : wx;
      const targetY = isGridSnapEnabled ? Math.round(wy / step) * step : wy;
      executeCommand({
        id: `cmd_${crypto.randomUUID()}`,
        name: 'mesh.move_vertex',
        params: {
          mesh_id: selectedNode.id,
          vertex_index: draggingVertexIndex,
          position: [targetX, targetY],
        },
      });
      return;
    }

    // Brush deform on warp (with W3C PointerEvent pressure sensitivity for stylus/pen tablets)
    if (isWarpBrushActive && selectedNode && selectedWarp && e.buttons === 1) {
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      const [prevWx, prevWy] = screenToWorld(lastMousePos.current.x, lastMousePos.current.y);
      const deltaX = (wx - prevWx) * (0.5 + pressure);
      const deltaY = (wy - prevWy) * (0.5 + pressure);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      executeCommand({
        id: `cmd_${crypto.randomUUID()}`,
        name: 'warp.brush_deform',
        params: {
          node_id: selectedNode.id,
          center: [wx, wy],
          delta: [deltaX, deltaY],
          radius: Math.round(60 + pressure * 120),
        },
      });
      return;
    }

    // Dragging warp control point (updates active keyform if bound, or base warp if unbound)
    if (selectedNode && selectedWarp && draggingCpIndex !== null) {
      const step = gridSize || 50;
      const nextCps = [...selectedWarp.control_points];
      const targetX = isGridSnapEnabled ? Math.round(wx / step) * step : wx;
      const targetY = isGridSnapEnabled ? Math.round(wy / step) * step : wy;
      nextCps[draggingCpIndex] = [targetX, targetY];
      executeCommand({
        id: `cmd_${crypto.randomUUID()}`,
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

  const handlePointerUp = () => {
    isPanning.current = false;
    setDraggingCpIndex(null);
    setDraggingVertexIndex(null);
    setDraggingQuadCornerIdx(null);
    finishDragTransaction(true);
  };

  const handlePointerCancel = () => {
    isPanning.current = false;
    setDraggingCpIndex(null);
    setDraggingVertexIndex(null);
    setDraggingQuadCornerIdx(null);
    finishDragTransaction(false);
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
      id: `cmd_${crypto.randomUUID()}`,
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
    notify(t('notify.retriangulated', { count: newIndices.length / 3 }), 'success');
  };

  return (
    <div className="panel-root relative w-full h-full bg-dcc-canvas overflow-hidden select-none">
      <ModelArtwork project={project} frame={frame} projectPath={currentFilePath} pan={pan} zoom={zoom}
        flipped={isFlipScreenX} soloNodeId={isSoloMode ? selectedNodeId : null} onReady={setArtworkReady}
        onRendered={onArtworkRendered} captureRef={captureRef} />
      <canvas
        ref={canvasRef}
        data-textures-ready={artworkReady}
        className="relative w-full h-full cursor-crosshair"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {project.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
          <div className="viewport-welcome pointer-events-auto w-full max-w-sm rounded-lg border border-dcc-border bg-dcc-panel/95 p-5 shadow-xl text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-sm font-semibold">{t('viewport.empty_title')}</h1>
            <p className="mt-2 text-dcc leading-relaxed text-dcc-muted text-balance">{t('viewport.empty_description')}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button onClick={importPsd} className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-dcc font-medium hover:bg-blue-500">
                <FileUp className="w-3.5 h-3.5" />{t('toolbar.import_psd')}
              </button>
              <button onClick={openProject} className="flex items-center gap-1.5 rounded border border-dcc-border bg-dcc-header px-3 py-1.5 text-dcc hover:bg-dcc-hover">
                <FolderOpen className="w-3.5 h-3.5" />{t('toolbar.open')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Floating Viewport Toolbar (Mesh Edit & Physics) */}
      <div className="absolute top-2 left-2 z-10 flex max-w-[calc(100%_-_1rem)] items-center gap-1 bg-dcc-panel/90 backdrop-blur px-1.5 py-1 rounded border border-dcc-border shadow-lg">
        {/* Tools scroll when space runs out; the overflow menu stays reachable at the end. */}
        <div className="flex min-w-0 items-center space-x-1.5 overflow-x-auto whitespace-nowrap [&>button]:shrink-0 [&>div]:shrink-0">
          <button className="btn btn-icon" onClick={fitModel} title={t('viewport.fit')} aria-label={t('viewport.fit')}>
            <Maximize2 className="w-3 h-3" />
          </button>
          {selectedMesh && (
            <button
              className="btn"
              aria-pressed={isMeshEditMode}
              onClick={() => setIsMeshEditMode(!isMeshEditMode)}
            >
              <Sparkles className="w-3 h-3" />
              <span className="toolbar-label-compact">{t('viewport.mesh_edit')}</span>
            </button>
          )}

          {/* Mesh Edit Toolset */}
          {selectedWarp && !isMeshEditMode && (
            <button
              className="btn"
              aria-pressed={isWarpBrushActive}
              onClick={() => setIsWarpBrushActive(!isWarpBrushActive)}
              title={t('viewport.deform_brush')}
              aria-label={t('viewport.deform_brush')}
            >
              <Paintbrush className="w-3 h-3" />
              <span className="toolbar-label-compact">{t('viewport.deform_brush')}</span>
            </button>
          )}

          {(selectedWarp || selectedMesh) && !isMeshEditMode && (
            <button
              className="btn"
              aria-pressed={isFreeQuadActive}
              onClick={() => {
                const nextState = !isFreeQuadActive;
                setIsFreeQuadActive(nextState);
                if (nextState) {
                  if (selectedWarp) {
                    const [bx, by, bw, bh] = selectedWarp.bounds;
                    setQuadCorners([
                      [bx, by],
                      [bx + bw, by],
                      [bx, by + bh],
                      [bx + bw, by + bh],
                    ]);
                  } else if (selectedMesh && selectedMesh.vertices.length > 0) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (const [vx, vy] of selectedMesh.vertices) {
                      if (vx < minX) minX = vx;
                      if (vx > maxX) maxX = vx;
                      if (vy < minY) minY = vy;
                      if (vy > maxY) maxY = vy;
                    }
                    setQuadCorners([
                      [minX, minY],
                      [maxX, minY],
                      [minX, maxY],
                      [maxX, maxY],
                    ]);
                  }
                }
              }}
              title={t('viewport.free_quad')}
              aria-label={t('viewport.free_quad')}
            >
              <Crop className="w-3 h-3" />
              <span className="toolbar-label-compact">{t('viewport.free_quad')}</span>
            </button>
          )}
          {isMeshEditMode && selectedMesh && (
            <div className="flex items-center space-x-1 border-l border-dcc-border pl-1.5">
              <button
                className="btn btn-icon"
                aria-pressed={meshEditTool === 'select'}
                onClick={() => setMeshEditTool('select')}
                title={t('viewport.tool_select')}
              >
                <MousePointer className="w-3 h-3" />
              </button>
              <button
                className="btn btn-icon"
                aria-pressed={meshEditTool === 'add'}
                onClick={() => setMeshEditTool('add')}
                title={t('viewport.tool_add_vertex')}
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                className="btn btn-icon"
                aria-pressed={meshEditTool === 'delete'}
                onClick={() => setMeshEditTool('delete')}
                title={t('viewport.tool_delete_vertex')}
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                className="btn"
                onClick={handleRetriangulate}
                title={t('viewport.triangulate')}
              >
                {t('viewport.triangulate')}
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (selectedNode) {
                    executeCommand({
                      id: `cmd_${crypto.randomUUID()}`,
                      name: 'mesh.subdivide',
                      params: { mesh_id: selectedNode.id },
                    });
                    notify(t('notify.subdivided'), 'success');
                  }
                }}
                title={t('viewport.subdivide')}
              >
                {t('viewport.subdivide')}
              </button>
            </div>
          )}

          <div className="h-3 w-px bg-dcc-border" />

          {/* Preview */}
          <div role="group" aria-label={t('viewport.group_preview')} className="flex items-center space-x-1">
            {/* Physics Live Mode Toggle */}
            <button
              className="btn"
              onClick={() => {
                setIsPhysicsEnabled(!isPhysicsEnabled);
              }}
              title={t('viewport.physics')}
              aria-pressed={isPhysicsEnabled}
            >
              <Zap className="w-3 h-3" />
              <span className="toolbar-label-compact">{t('viewport.physics')}</span>
            </button>

            {/* Auto Idle Natural Posing Toggle */}
            <button
              className="btn"
              onClick={() => {
                setIsAutoIdleEnabled(!isAutoIdleEnabled);
              }}
              title={t('viewport.auto_idle')}
              aria-pressed={isAutoIdleEnabled}
            >
              <Smile className="w-3 h-3" />
              <span className="toolbar-label-compact">{t('viewport.auto_idle')}</span>
            </button>
          </div>

          <div className="h-3 w-px bg-dcc-border" />

          {/* Edit */}
          <div role="group" aria-label={t('viewport.group_edit')} className="flex items-center space-x-1">
            {/* Grid Snap Toggle */}
            <button
              className="btn"
              onClick={() => {
                setIsGridSnapEnabled(!isGridSnapEnabled);
              }}
              title={t('viewport.grid_snap')}
              aria-pressed={isGridSnapEnabled}
            >
              <Grid className="w-3 h-3" />
              <span className="toolbar-label-compact">{t('viewport.grid_snap')}</span>
            </button>

            {/* Solo Mode (`CMD_SOLO`, S) */}
            <button
              className="btn"
              onClick={() => {
                setIsSoloMode(!isSoloMode);
              }}
              title={`${t('viewport.solo')} (S)`}
              aria-pressed={isSoloMode}
            >
              <Eye className="w-3 h-3" />
              <span className="toolbar-label-compact">{t('viewport.solo')}</span>
            </button>

            {/* Edit Levels 1/2/3 (`CMD_EDIT_LEVEL_1..3`) */}
            <div role="group" aria-label={t('viewport.edit_level')} className="flex items-center h-6 space-x-0.5 px-0.5 rounded bg-dcc-bg/60 border border-dcc-border">
              {([1, 2, 3] as const).map((lvl) => (
                <button
                  key={lvl}
                  className={`px-1 text-dcc-xs font-mono rounded ${
                    editLevel === lvl ? 'bg-blue-600 text-white' : 'text-dcc-subtle hover:text-dcc-control'
                  }`}
                  onClick={() => {
                    setEditLevel(lvl);
                    if (lvl === 1 && selectedMesh) setIsMeshEditMode(true);
                    else if (lvl !== 1 && isMeshEditMode) setIsMeshEditMode(false);
                  }}
                  title={`Edit Level ${lvl} (编辑级别 ${lvl})`}
                >
                  L{lvl}
                </button>
              ))}
          </div>

          </div>

        </div>

        <OverflowMenu
          label={t('common.more')}
          active={isOnionSkinEnabled || isMotionPathEnabled || isFlipScreenX || activeSnapshotSlot !== null}
        >
          <OverflowMenuLabel>{t('viewport.group_preview')}</OverflowMenuLabel>
          <OverflowMenuItem
            icon={Layers}
            label={t('viewport.onion_skin')}
            checked={isOnionSkinEnabled}
            onSelect={() => {
              setIsOnionSkinEnabled(!isOnionSkinEnabled);
            }}
          />
          <OverflowMenuItem
            icon={Route}
            label={t('viewport.motion_path')}
            checked={isMotionPathEnabled}
            onSelect={() => {
              setIsMotionPathEnabled(!isMotionPathEnabled);
            }}
          />
          <OverflowMenuItem
            icon={FlipHorizontal}
            label={`${t('viewport.flip')} (R)`}
            checked={isFlipScreenX}
            onSelect={() => {
              setIsFlipScreenX(!isFlipScreenX);
            }}
          />
          <OverflowMenuItem
            icon={Shuffle}
            label={t('viewport.random_pose')}
            onSelect={() => {
              project.parameters.forEach((p, idx) => {
                if (!p.locked) {
                  const t = ((Math.sin(Date.now() * 0.003 + idx * 1.7) + 1) * 0.5);
                  const val = Number((p.min + (p.max - p.min) * t).toFixed(2));
                  setParameterValue(p.id, val);
                }
              });
              notify(t('notify.random_pose'), 'info');
            }}
          />
          <OverflowMenuLabel>{t('viewport.snapshots')}</OverflowMenuLabel>
          {/* Temporary Snapshot Slots 1..4 (`CMD_SAVE_TEMP_SNAP_SHOT_0..3`) */}
          <div className="flex items-center gap-1 px-2 pb-1.5">
            {[0, 1, 2, 3].map((slot) => {
              const hasSnap = !!tempSnapshots[slot];
              const isShowing = activeSnapshotSlot === slot;
              return (
                <button
                  key={slot}
                  className={`flex-1 py-1 text-dcc-xs font-mono rounded transition-colors ${
                    isShowing
                      ? 'bg-blue-600 text-white'
                      : hasSnap
                      ? 'bg-dcc-hover text-zinc-200 border border-zinc-600'
                      : 'bg-dcc-raised text-dcc-subtle hover:text-dcc-control'
                  }`}
                  onClick={(e) => {
                    if (e.shiftKey || !hasSnap) {
                      setTempSnapshots((prev) => {
                        const next = [...prev];
                        next[slot] = frame ? JSON.parse(JSON.stringify(frame)) : null;
                        return next;
                      });
                      setActiveSnapshotSlot(slot);
                      notify(t('notify.snapshot_saved', { slot: slot + 1 }), 'success');
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
        </OverflowMenu>
      </div>

      {/* Bottom Status Bar Overlay */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-dcc-sm text-dcc-muted pointer-events-none flex items-center space-x-3">
        <span>{t('viewport.zoom')} {(zoom * 100).toFixed(0)}%</span>
        <span>{t('viewport.meshes')} {frame?.meshes.length ?? 0}</span>
        {selectedNode && (
          <span className="max-w-[240px] truncate text-zinc-200">{t('viewport.selected')}: {selectedNode.name || selectedNode.id}</span>
        )}
        {isMeshEditMode && <span className="text-rose-300 font-medium">{t('viewport.editing_mesh')}</span>}
      </div>
    </div>
  );
};
