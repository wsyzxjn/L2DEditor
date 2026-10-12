import type {
  Animation,
  ArtPathPoint,
  Diagnostic,
  EvaluatedFrameJs,
  EvaluatedMeshJs,
  ExtendedInterpolationType,
  KeyformBinding,
  ModelStats,
  Node,
  Project,
} from './types.js';
import { CURRENT_FORMAT_VERSION } from './types.js';

function compute1dWeights(keys: number[], value: number, ext?: ExtendedInterpolationType): [number, number][] {
  if (keys.length === 0) return [];
  if (keys.length === 1) return [[0, 1.0]];
  if (value <= keys[0]) return [[0, 1.0]];
  const lastIdx = keys.length - 1;
  if (value >= keys[lastIdx]) return [[lastIdx, 1.0]];

  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    if (value >= k0 && value <= k1) {
      const span = k1 - k0;
      if (Math.abs(span) < 1e-6) return [[i, 1.0]];
      let t = (value - k0) / span;
      if (ext === 'circle') {
        t = t * t * (3.0 - 2.0 * t);
      } else if (ext === 'bezier') {
        t = t * t * t;
      }
      const res: [number, number][] = [];
      if (1.0 - t > 1e-6) res.push([i, 1.0 - t]);
      if (t > 1e-6) res.push([i + 1, t]);
      return res;
    }
  }
  return [[lastIdx, 1.0]];
}

export function computeMultidimWeightsJs(
  kf: KeyformBinding,
  params: Record<string, number>,
  project: Project
): number[] {
  const numDims = kf.dimensions.length;
  if (numDims === 0 || kf.keyforms.length === 0) {
    return new Array(kf.keyforms.length).fill(0);
  }

  const dimWeights: Map<number, number>[] = kf.dimensions.map((dim) => {
    const paramMeta = project.parameters.find((p) => p.id === dim.param_id);
    const def = paramMeta ? paramMeta.default : 0;
    let val = params[dim.param_id] ?? def;
    if (paramMeta?.repeats && Math.abs(paramMeta.max - paramMeta.min) > 1e-5) {
      const span = paramMeta.max - paramMeta.min;
      val = paramMeta.min + ((((val - paramMeta.min) % span) + span) % span);
    }
    return new Map(compute1dWeights(dim.keys, val, dim.extended_interpolation));
  });

  const weights: number[] = [];
  let totalW = 0;
  for (const state of kf.keyforms) {
    let stateW = 1.0;
    for (let d = 0; d < numDims; d++) {
      const coordVal = state.coordinates[d];
      const keyIdx = kf.dimensions[d].keys.findIndex((k) => Math.abs(k - coordVal) < 1e-5);
      if (keyIdx >= 0) {
        stateW *= dimWeights[d].get(keyIdx) ?? 0;
      } else {
        stateW = 0;
      }
    }
    weights.push(stateW);
    totalW += stateW;
  }

  if (totalW > 1e-6) {
    for (let i = 0; i < weights.length; i++) {
      weights[i] /= totalW;
    }
  }
  return weights;
}

function transformPointByWarp(
  pt: [number, number],
  cols: number,
  rows: number,
  bounds: [number, number, number, number],
  controlPoints: [number, number][],
  bezierSmooth?: boolean
): [number, number] {
  const [minX, minY, w, h] = bounds;
  if (cols === 0 || rows === 0 || Math.abs(w) < 1e-5 || Math.abs(h) < 1e-5) return pt;

  const u = Math.max(0, Math.min(1, (pt[0] - minX) / w));
  const v = Math.max(0, Math.min(1, (pt[1] - minY) / h));

  const gx = u * cols;
  const gy = v * rows;
  const c0 = Math.min(Math.floor(gx), cols - 1);
  const r0 = Math.min(Math.floor(gy), rows - 1);
  const c1 = c0 + 1;
  const r1 = r0 + 1;

  let tx = gx - c0;
  let ty = gy - r0;
  if (bezierSmooth) {
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
  }

  const stride = cols + 1;
  const p00 = controlPoints[r0 * stride + c0] || pt;
  const p10 = controlPoints[r0 * stride + c1] || pt;
  const p01 = controlPoints[r1 * stride + c0] || pt;
  const p11 = controlPoints[r1 * stride + c1] || pt;

  const topX = p00[0] * (1 - tx) + p10[0] * tx;
  const topY = p00[1] * (1 - tx) + p10[1] * tx;
  const botX = p01[0] * (1 - tx) + p11[0] * tx;
  const botY = p01[1] * (1 - tx) + p11[1] * tx;

  return [topX * (1 - ty) + botX * ty, topY * (1 - ty) + botY * ty];
}

function transformPointByRotation(
  pt: [number, number],
  origin: [number, number],
  angleDeg: number,
  scale: [number, number]
): [number, number] {
  const dx = (pt[0] - origin[0]) * scale[0];
  const dy = (pt[1] - origin[1]) * scale[1];
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [origin[0] + dx * cos - dy * sin, origin[1] + dx * sin + dy * cos];
}

function transformPointByDeformPath(
  pt: [number, number],
  basePoints: [number, number][],
  deformedPoints: [number, number][]
): [number, number] {
  const n = Math.min(basePoints.length, deformedPoints.length);
  if (n === 0) return pt;
  if (n === 1) {
    return [
      pt[0] + (deformedPoints[0][0] - basePoints[0][0]),
      pt[1] + (deformedPoints[0][1] - basePoints[0][1]),
    ];
  }
  let totalW = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const distSq = (pt[0] - basePoints[i][0]) ** 2 + (pt[1] - basePoints[i][1]) ** 2;
    const w = 1.0 / (distSq + 100.0);
    dx += (deformedPoints[i][0] - basePoints[i][0]) * w;
    dy += (deformedPoints[i][1] - basePoints[i][1]) * w;
    totalW += w;
  }
  if (totalW > 1e-6) {
    return [pt[0] + dx / totalW, pt[1] + dy / totalW];
  }
  return pt;
}

function tessellateArtPathJs(
  points: ArtPathPoint[],
  closed: boolean = false
): { vertices: number[]; uvs: number[]; indices: number[]; avgOpacity: number } {
  const n = points.length;
  if (n < 2) return { vertices: [], uvs: [], indices: [], avgOpacity: 1 };

  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let sumOp = 0;

  for (let i = 0; i < n; i++) {
    const pCurr = points[i].pos;
    const pPrev = i > 0 ? points[i - 1].pos : closed ? points[n - 1].pos : pCurr;
    const pNext = i + 1 < n ? points[i + 1].pos : closed ? points[0].pos : pCurr;

    let tx = pNext[0] - pPrev[0];
    let ty = pNext[1] - pPrev[1];
    const len = Math.hypot(tx, ty);
    if (len > 1e-5) {
      tx /= len;
      ty /= len;
    } else {
      tx = 1;
      ty = 0;
    }
    const nx = -ty;
    const ny = tx;
    const halfW = Math.max(0.25, (points[i].width ?? 4) * 0.5);

    vertices.push(pCurr[0] + nx * halfW, pCurr[1] + ny * halfW);
    vertices.push(pCurr[0] - nx * halfW, pCurr[1] - ny * halfW);

    const u = n > 1 ? i / (n - 1) : 0;
    uvs.push(u, 0, u, 1);
    sumOp += points[i].opacity ?? 1;
  }

  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const nextI = (i + 1) % n;
    const v0 = i * 2;
    const v1 = i * 2 + 1;
    const v2 = nextI * 2;
    const v3 = nextI * 2 + 1;
    indices.push(v0, v1, v2, v2, v1, v3);
  }

  return { vertices, uvs, indices, avgOpacity: sumOp / n };
}

export function evaluateProjectJs(
  project: Project,
  rawParams: Record<string, number>,
  options?: { currentFrame?: number; activeAnimationId?: string | null }
): EvaluatedFrameJs {
  const params: Record<string, number> = { ...rawParams };

  // Apply active Expression overrides
  for (const expr of project.expressions || []) {
    const w = Math.max(
      0,
      Math.min(1, params[`__expression_weight:${expr.id}`] ?? params[`expr:${expr.id}`] ?? 0)
    );
    if (w > 1e-5) {
      for (const ep of expr.parameters) {
        const def = project.parameters.find((p) => p.id === ep.id)?.default ?? 0;
        const cur = params[ep.id] ?? def;
        const blend = ep.blend || 'add';
        if (blend === 'add') params[ep.id] = cur + ep.value * w;
        else if (blend === 'multiply') params[ep.id] = cur * (1 + (ep.value - 1) * w);
        else params[ep.id] = cur * (1 - w) + ep.value * w;
      }
    }
  }

  // Resolve PoseGroup mutually-exclusive Part visibility
  const posePartMult = new Map<string, number>();
  for (const group of project.pose_groups || []) {
    if (group.part_ids.length > 1) {
      let winnerIdx = -1;
      let bestVal = 0;
      group.part_ids.forEach((pid, idx) => {
        const v = params[pid] ?? params[`ParamPose_${pid}`] ?? 0;
        if (v > bestVal) {
          bestVal = v;
          winnerIdx = idx;
        }
      });
      if (winnerIdx >= 0) {
        group.part_ids.forEach((pid, idx) => {
          posePartMult.set(pid, idx === winnerIdx ? 1 : 0);
        });
      }
    }
  }

  // Evaluate FormAnimationTrack offsets if active animation is playing
  const formOffsets = new Map<string, [number, number][]>();
  if (options?.activeAnimationId && options.currentFrame !== undefined) {
    const anim = project.animations?.find((a) => a.id === options.activeAnimationId);
    if (anim?.form_tracks) {
      for (const ft of anim.form_tracks) {
        if (ft.keyframes.length > 0) {
          const kf = ft.keyframes.reduce((prev, curr) =>
            Math.abs(curr.frame - options.currentFrame!) < Math.abs(prev.frame - options.currentFrame!)
              ? curr
              : prev
          );
          formOffsets.set(ft.target_node_id, kf.offsets);
        }
      }
    }
  }

  const nodeMap = new Map<string, Node>();
  for (const n of project.nodes) nodeMap.set(n.id, n);
  const kfMap = new Map<string, KeyformBinding>();
  for (const k of project.keyforms) kfMap.set(k.target_node_id, k);

  // 1. Evaluate deformers
  const deformerStates = new Map<string, any>();
  for (const node of project.nodes) {
    if (node.kind.type === 'WarpDeformer') {
      let cp = node.kind.control_points.map((p): [number, number] => [p[0], p[1]]);
      const kf = kfMap.get(node.id);
      if (kf && kf.keyforms.length > 0) {
        const weights = computeMultidimWeightsJs(kf, params, project);
        const states = kf.keyforms.filter((s) => s.payload.kind === 'Warp');
        if (states.length === weights.length && states.length > 0) {
          cp = cp.map((_, idx) => {
            let x = 0;
            let y = 0;
            for (let s = 0; s < states.length; s++) {
              const pts = (states[s].payload as any).control_points;
              if (pts[idx]) {
                x += pts[idx][0] * weights[s];
                y += pts[idx][1] * weights[s];
              }
            }
            return [x, y];
          });
        }
      }
      const fOff = formOffsets.get(node.id);
      if (fOff) {
        cp = cp.map((p, i) => [p[0] + (fOff[i]?.[0] || 0), p[1] + (fOff[i]?.[1] || 0)]);
      }
      deformerStates.set(node.id, {
        type: 'Warp',
        cols: node.kind.cols,
        rows: node.kind.rows,
        bounds: node.kind.bounds,
        controlPoints: cp,
        bezierSmooth: node.kind.bezier_smooth,
      });
    } else if (node.kind.type === 'RotationDeformer') {
      let origin: [number, number] = [...node.kind.origin];
      let angleDeg = node.kind.angle_deg;
      let scale: [number, number] = [...node.kind.scale];
      const kf = kfMap.get(node.id);
      if (kf && kf.keyforms.length > 0) {
        const weights = computeMultidimWeightsJs(kf, params, project);
        let ox = 0, oy = 0, ang = 0, sx = 0, sy = 0, valid = false;
        kf.keyforms.forEach((s, idx) => {
          if (s.payload.kind === 'Rotation') {
            valid = true;
            const w = weights[idx];
            ox += s.payload.origin[0] * w;
            oy += s.payload.origin[1] * w;
            ang += s.payload.angle_deg * w;
            sx += s.payload.scale[0] * w;
            sy += s.payload.scale[1] * w;
          }
        });
        if (valid) {
          origin = [ox, oy];
          angleDeg = ang;
          scale = [sx, sy];
        }
      }
      deformerStates.set(node.id, { type: 'Rotation', origin, angleDeg, scale });
    } else if (node.kind.type === 'DeformPath') {
      let pts = node.kind.control_points.map((p): [number, number] => [p[0], p[1]]);
      const kf = kfMap.get(node.id);
      if (kf && kf.keyforms.length > 0) {
        const weights = computeMultidimWeightsJs(kf, params, project);
        const states = kf.keyforms.filter((s) => s.payload.kind === 'DeformPath');
        if (states.length === weights.length && states.length > 0) {
          pts = pts.map((_, idx) => {
            let x = 0, y = 0;
            for (let s = 0; s < states.length; s++) {
              const cp = (states[s].payload as any).control_points;
              if (cp[idx]) {
                x += cp[idx][0] * weights[s];
                y += cp[idx][1] * weights[s];
              }
            }
            return [x, y];
          });
        }
      }
      deformerStates.set(node.id, {
        type: 'DeformPath',
        basePoints: node.kind.control_points,
        deformedPoints: pts,
        targetMeshIds: node.kind.target_mesh_ids,
      });
    }
  }

  // 2. Evaluate ArtMeshes & ArtPaths
  const evaluatedMeshes: {
    id: string;
    texture_id: string;
    pts: [number, number][];
    uvs: number[];
    indices: number[];
    blend_mode: string;
    opacity: number;
    multiply_color: [number, number, number, number];
    screen_color: [number, number, number, number];
    draw_order: number;
    mask_ids: string[];
    is_mask_inverted?: boolean;
  }[] = [];

  for (const node of project.nodes) {
    if (!node.visible) continue;
    if (node.kind.type === 'ArtMesh') {
      const meshData = node.kind;
      const pts: [number, number][] = meshData.vertices.map((v) => [v[0], v[1]]);
      let opacity = meshData.opacity;
      const multiplyColor: [number, number, number, number] = meshData.multiply_color
        ? [...meshData.multiply_color]
        : [1, 1, 1, 1];
      const screenColor: [number, number, number, number] = meshData.screen_color
        ? [...meshData.screen_color]
        : [0, 0, 0, 0];
      let drawOrder = meshData.draw_order;

      const kf = kfMap.get(node.id);
      if (kf && kf.keyforms.length > 0) {
        const weights = computeMultidimWeightsJs(kf, params, project);
        let hasOp = false;
        let opAcc = 0;
        let maxDoW = 0;
        kf.keyforms.forEach((s, sIdx) => {
          const w = weights[sIdx];
          if (s.payload.kind === 'ArtMesh') {
            s.payload.vertex_offsets.forEach((off, vIdx) => {
              if (pts[vIdx]) {
                pts[vIdx][0] += off[0] * w;
                pts[vIdx][1] += off[1] * w;
              }
            });
            if (s.payload.opacity !== undefined) {
              hasOp = true;
              opAcc += s.payload.opacity * w;
            }
            if (s.payload.multiply_color) {
              for (let c = 0; c < 4; c++) {
                multiplyColor[c] = multiplyColor[c] * (1 - w) + s.payload.multiply_color[c] * w;
              }
            }
            if (s.payload.screen_color) {
              for (let c = 0; c < 4; c++) {
                screenColor[c] = screenColor[c] * (1 - w) + s.payload.screen_color[c] * w;
              }
            }
            if (s.payload.draw_order !== undefined && w > maxDoW) {
              maxDoW = w;
              drawOrder = s.payload.draw_order;
            }
          }
        });
        if (hasOp) opacity = opAcc;
      }

      // Form Animation offsets
      const fOff = formOffsets.get(node.id);
      if (fOff) {
        for (let i = 0; i < pts.length; i++) {
          if (fOff[i]) {
            pts[i][0] += fOff[i][0];
            pts[i][1] += fOff[i][1];
          }
        }
      }

      // MorphTargets
      for (const morph of meshData.morph_targets || []) {
        const w = params[morph.param_id] ?? 0;
        if (Math.abs(w) > 1e-5) {
          for (let i = 0; i < pts.length && i < morph.vertex_offsets.length; i++) {
            pts[i][0] += morph.vertex_offsets[i][0] * w;
            pts[i][1] += morph.vertex_offsets[i][1] * w;
          }
        }
      }

      // DeformPaths targeting this mesh
      for (const def of deformerStates.values()) {
        if (def.type === 'DeformPath' && def.targetMeshIds.includes(node.id)) {
          for (let i = 0; i < pts.length; i++) {
            pts[i] = transformPointByDeformPath(pts[i], def.basePoints, def.deformedPoints);
          }
        }
      }

      // Ancestor chain
      const ancestors: string[] = [];
      let currPid = node.parent_id;
      const visited = new Set<string>();
      let inheritedVisible = true;
      while (currPid) {
        if (visited.has(currPid)) break;
        visited.add(currPid);
        const pNode = nodeMap.get(currPid);
        if (!pNode) break;
        if (!pNode.visible) {
          inheritedVisible = false;
          break;
        }
        if (pNode.kind.type === 'Part') {
          opacity *= pNode.kind.opacity ?? 1.0;
          if (posePartMult.has(currPid)) {
            opacity *= posePartMult.get(currPid)!;
          }
        }
        ancestors.push(currPid);
        currPid = pNode.parent_id;
      }
      if (!inheritedVisible || opacity <= 1e-5) continue;

      for (const ancId of ancestors) {
        const def = deformerStates.get(ancId);
        if (!def) continue;
        if (def.type === 'Warp') {
          for (let i = 0; i < pts.length; i++) {
            pts[i] = transformPointByWarp(pts[i], def.cols, def.rows, def.bounds, def.controlPoints, def.bezierSmooth);
          }
        } else if (def.type === 'Rotation') {
          for (let i = 0; i < pts.length; i++) {
            pts[i] = transformPointByRotation(pts[i], def.origin, def.angleDeg, def.scale);
          }
        } else if (def.type === 'DeformPath') {
          for (let i = 0; i < pts.length; i++) {
            pts[i] = transformPointByDeformPath(pts[i], def.basePoints, def.deformedPoints);
          }
        }
      }

      evaluatedMeshes.push({
        id: node.id,
        texture_id: meshData.texture_id,
        pts,
        uvs: meshData.uvs.flat(),
        indices: meshData.indices,
        blend_mode: meshData.blend_mode,
        opacity,
        multiply_color: multiplyColor,
        screen_color: screenColor,
        draw_order: drawOrder,
        mask_ids: meshData.mask_ids || [],
        is_mask_inverted: meshData.is_mask_inverted,
      });
    } else if (node.kind.type === 'ArtPath') {
      const pathData = node.kind;
      if (!pathData.points || pathData.points.length < 2) continue;
      let points: ArtPathPoint[] = pathData.points.map((p) => ({
        pos: [p.pos[0], p.pos[1]],
        width: p.width ?? 4,
        opacity: p.opacity ?? 1,
      }));
      let opacity = pathData.opacity ?? 1;

      const kf = kfMap.get(node.id);
      if (kf && kf.keyforms.length > 0) {
        const weights = computeMultidimWeightsJs(kf, params, project);
        const states = kf.keyforms.filter((s) => s.payload.kind === 'ArtPath');
        if (states.length === weights.length && states.length > 0) {
          points = points.map((_, idx) => {
            let px = 0, py = 0, pw = 0, pop = 0;
            for (let s = 0; s < states.length; s++) {
              const kpts = (states[s].payload as any).points as ArtPathPoint[];
              if (kpts[idx]) {
                px += kpts[idx].pos[0] * weights[s];
                py += kpts[idx].pos[1] * weights[s];
                pw += (kpts[idx].width ?? 4) * weights[s];
                pop += (kpts[idx].opacity ?? 1) * weights[s];
              }
            }
            return { pos: [px, py], width: pw, opacity: pop };
          });
        }
      }

      // Ancestor chain
      const ancestors: string[] = [];
      let currPid = node.parent_id;
      const visited = new Set<string>();
      let inheritedVisible = true;
      while (currPid) {
        if (visited.has(currPid)) break;
        visited.add(currPid);
        const pNode = nodeMap.get(currPid);
        if (!pNode) break;
        if (!pNode.visible) {
          inheritedVisible = false;
          break;
        }
        if (pNode.kind.type === 'Part') {
          opacity *= pNode.kind.opacity ?? 1.0;
          if (posePartMult.has(currPid)) {
            opacity *= posePartMult.get(currPid)!;
          }
        }
        ancestors.push(currPid);
        currPid = pNode.parent_id;
      }
      if (!inheritedVisible || opacity <= 1e-5) continue;

      for (const ancId of ancestors) {
        const def = deformerStates.get(ancId);
        if (!def) continue;
        if (def.type === 'Warp') {
          for (const pt of points) {
            pt.pos = transformPointByWarp(pt.pos, def.cols, def.rows, def.bounds, def.controlPoints, def.bezierSmooth);
          }
        } else if (def.type === 'Rotation') {
          for (const pt of points) {
            pt.pos = transformPointByRotation(pt.pos, def.origin, def.angleDeg, def.scale);
          }
        } else if (def.type === 'DeformPath') {
          for (const pt of points) {
            pt.pos = transformPointByDeformPath(pt.pos, def.basePoints, def.deformedPoints);
          }
        }
      }

      const tess = tessellateArtPathJs(points, pathData.closed);
      const pts2d: [number, number][] = [];
      for (let i = 0; i < tess.vertices.length; i += 2) {
        pts2d.push([tess.vertices[i], tess.vertices[i + 1]]);
      }
      evaluatedMeshes.push({
        id: node.id,
        texture_id: pathData.texture_id || '__artpath_solid__',
        pts: pts2d,
        uvs: tess.uvs,
        indices: tess.indices,
        blend_mode: pathData.blend_mode || 'normal',
        opacity: Math.max(0, Math.min(1, opacity * tess.avgOpacity)),
        multiply_color: pathData.color || [0.15, 0.15, 0.18, 1.0],
        screen_color: [0, 0, 0, 0],
        draw_order: pathData.draw_order ?? 0,
        mask_ids: pathData.mask_ids || [],
        is_mask_inverted: pathData.is_mask_inverted,
      });
    }
  }

  // 3. Apply Glue constraints
  for (const glue of project.glues || []) {
    const meshA = evaluatedMeshes.find((m) => m.id === glue.mesh_a_id);
    const meshB = evaluatedMeshes.find((m) => m.id === glue.mesh_b_id);
    if (meshA && meshB && meshA !== meshB) {
      for (const pair of glue.vertex_pairs) {
        const pa = meshA.pts[pair.index_a];
        const pb = meshB.pts[pair.index_b];
        const totalW = pair.weight_a + pair.weight_b;
        if (pa && pb && totalW > 1e-5) {
          const bx = (pa[0] * pair.weight_a + pb[0] * pair.weight_b) / totalW;
          const by = (pa[1] * pair.weight_a + pb[1] * pair.weight_b) / totalW;
          meshA.pts[pair.index_a] = [bx, by];
          meshB.pts[pair.index_b] = [bx, by];
        }
      }
    }
  }

  evaluatedMeshes.sort((a, b) => a.draw_order - b.draw_order);

  const meshes: EvaluatedMeshJs[] = evaluatedMeshes.map((m) => ({
    id: m.id,
    texture_id: m.texture_id,
    vertices: m.pts.flat(),
    uvs: m.uvs,
    indices: m.indices,
    blend_mode: m.blend_mode,
    opacity: m.opacity,
    multiply_color: m.multiply_color,
    screen_color: m.screen_color,
    draw_order: m.draw_order,
    mask_ids: m.mask_ids,
    is_mask_inverted: m.is_mask_inverted,
  }));

  return {
    meshes,
    total_vertices: meshes.reduce((acc, m) => acc + m.vertices.length / 2, 0),
    total_indices: meshes.reduce((acc, m) => acc + m.indices.length, 0),
  };
}

/**
 * Evaluates an Animation at a continuous frame position using Linear, Stepped, or Bezier Hermite curves.
 */
export function evaluateAnimationAtFrameJs(anim: Animation, frame: number): Record<string, number> {
  const result: Record<string, number> = {};
  const duration = Math.max(0, anim.duration_frames);
  const targetFrame =
    anim.loop_playback && duration > 0
      ? ((frame % duration) + duration) % duration
      : Math.max(0, Math.min(duration, frame));

  for (const track of anim.tracks) {
    const kfs = track.keyframes;
    if (!kfs || kfs.length === 0) continue;
    if (kfs.length === 1 || targetFrame <= kfs[0].frame) {
      result[track.target_param_id] = kfs[0].value;
      continue;
    }
    const lastIdx = kfs.length - 1;
    if (targetFrame >= kfs[lastIdx].frame) {
      result[track.target_param_id] = kfs[lastIdx].value;
      continue;
    }
    for (let i = 0; i < kfs.length - 1; i++) {
      const k0 = kfs[i];
      const k1 = kfs[i + 1];
      if (targetFrame >= k0.frame && targetFrame <= k1.frame) {
        const span = k1.frame - k0.frame;
        const t = Math.abs(span) < 1e-6 ? 0 : (targetFrame - k0.frame) / span;
        const curve = k0.curve || 'linear';
        if (curve === 'stepped') {
          result[track.target_param_id] = k0.value;
        } else if (curve === 'bezier') {
          const t2 = t * t;
          const t3 = t2 * t;
          const h00 = 2 * t3 - 3 * t2 + 1;
          const h10 = t3 - 2 * t2 + t;
          const h01 = -2 * t3 + 3 * t2;
          const h11 = t3 - t2;
          const m = k1.value - k0.value;
          result[track.target_param_id] = h00 * k0.value + h10 * m + h01 * k1.value + h11 * m;
        } else {
          result[track.target_param_id] = k0.value + t * (k1.value - k0.value);
        }
        break;
      }
    }
  }
  return result;
}

export class PhysicsSimulatorJs {
  private groupStates = new Map<string, { angle: number; angularVelocity: number }[]>();
  private prevParams: Record<string, number> = {};

  reset(): void {
    this.groupStates.clear();
    this.prevParams = {};
  }

  update(project: Project, currentParams: Record<string, number>, dt: number): Record<string, number> {
    const clampedDt = Math.max(0.001, Math.min(0.1, dt));
    const outParams: Record<string, number> = {};

    for (const group of project.physics || []) {
      if (group.pendulums.length === 0) continue;
      let states = this.groupStates.get(group.id);
      if (!states || states.length !== group.pendulums.length) {
        states = group.pendulums.map(() => ({ angle: 0, angularVelocity: 0 }));
        this.groupStates.set(group.id, states);
      }

      let totalForceX = 0;
      for (const inp of group.inputs) {
        const curr = currentParams[inp.param_id] ?? 0;
        const prev = this.prevParams[inp.param_id] ?? curr;
        const sign = inp.reflect ? -1 : 1;
        totalForceX += (curr - prev) * inp.weight * sign * 10.0;
      }

      for (let i = 0; i < group.pendulums.length; i++) {
        const pend = group.pendulums[i];
        const st = states[i];
        const restoring = -15.0 * st.angle;
        const damping = -pend.damping * st.angularVelocity * 4.0;
        const torque = totalForceX * 0.1;
        const accel = (restoring + damping + torque) / Math.max(0.1, pend.mass);
        st.angularVelocity += accel * clampedDt;
        st.angle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, st.angle + st.angularVelocity * clampedDt));
      }

      for (const out of group.outputs) {
        if (out.pendulum_index < states.length) {
          const deg = (states[out.pendulum_index].angle * 180) / Math.PI;
          outParams[out.param_id] = (outParams[out.param_id] ?? 0) + deg * out.angle_scale * out.weight;
        }
      }
    }

    this.prevParams = { ...currentParams };
    return outParams;
  }
}

export function lintProjectJs(project: Project): Diagnostic[] {
  const diags: Diagnostic[] = [];
  if (project.format_version <= 0 || project.format_version > CURRENT_FORMAT_VERSION) {
    diags.push({
      code: 'FORMAT_VERSION_UNSUPPORTED',
      severity: 'error',
      message: `Unsupported format_version ${project.format_version}`,
      target_id: null,
      json_path: '/format_version',
    });
  }
  const paramIds = new Set<string>();
  project.parameters.forEach((p, idx) => {
    if (paramIds.has(p.id)) {
      diags.push({
        code: 'DUPLICATE_PARAM_ID',
        severity: 'error',
        message: `Duplicate parameter ID '${p.id}'`,
        target_id: p.id,
        json_path: `/parameters/${idx}`,
      });
    }
    paramIds.add(p.id);
    if (p.min >= p.max) {
      diags.push({
        code: 'INVALID_PARAM_RANGE',
        severity: 'error',
        message: `Parameter '${p.id}' min (${p.min}) must be < max (${p.max})`,
        target_id: p.id,
        json_path: `/parameters/${idx}/min`,
      });
    }
  });

  const nodeIds = new Set<string>();
  const nodeMap = new Map<string, Node>();
  project.nodes.forEach((n, idx) => {
    if (nodeIds.has(n.id)) {
      diags.push({
        code: 'DUPLICATE_NODE_ID',
        severity: 'error',
        message: `Duplicate node ID '${n.id}'`,
        target_id: n.id,
        json_path: `/nodes/${idx}`,
      });
    }
    nodeIds.add(n.id);
    nodeMap.set(n.id, n);
  });

  project.nodes.forEach((n, idx) => {
    if (n.parent_id && !nodeMap.has(n.parent_id)) {
      diags.push({
        code: 'DANGLING_PARENT_ID',
        severity: 'error',
        message: `Node '${n.id}' references missing parent '${n.parent_id}'`,
        target_id: n.id,
        json_path: `/nodes/${idx}/parent_id`,
      });
    } else if (n.parent_id) {
      const parentNode = nodeMap.get(n.parent_id);
      if (parentNode && parentNode.kind.type === 'WarpDeformer') {
        const [bx, by, bw, bh] = parentNode.kind.bounds;
        const eps = 1e-2;
        const pts =
          n.kind.type === 'ArtMesh'
            ? n.kind.vertices
            : n.kind.type === 'WarpDeformer'
            ? n.kind.control_points
            : null;
        if (pts) {
          const outside = pts.filter(
            ([px, py]) => px < bx - eps || px > bx + bw + eps || py < by - eps || py > by + bh + eps
          );
          if (outside.length > 0) {
            diags.push({
              code: 'CHILD_OUTSIDE_WARP_BOUNDS',
              severity: 'warning',
              message: `Node '${n.id}' has ${outside.length} point(s) protruding outside parent WarpDeformer '${parentNode.id}'`,
              target_id: n.id,
              json_path: `/nodes/${idx}`,
            });
          }
        }
      }
    }
  });

  return diags;
}

export function computeModelStatsJs(project: Project): ModelStats {
  let total_vertices = 0;
  let total_triangles = 0;
  let artmesh_count = 0;
  let artpath_count = 0;
  let warp_count = 0;
  let rotation_count = 0;
  let deform_path_count = 0;

  for (const node of project.nodes) {
    if (node.kind.type === 'ArtMesh') {
      artmesh_count++;
      total_vertices += node.kind.vertices.length;
      total_triangles += Math.floor(node.kind.indices.length / 3);
    } else if (node.kind.type === 'ArtPath') {
      artpath_count++;
      if (node.kind.points.length >= 2) {
        total_vertices += node.kind.points.length * 2;
        total_triangles += (node.kind.points.length - 1) * 2;
      }
    } else if (node.kind.type === 'WarpDeformer') warp_count++;
    else if (node.kind.type === 'RotationDeformer') rotation_count++;
    else if (node.kind.type === 'DeformPath') deform_path_count++;
  }

  let estimated_texture_vram_bytes = 0;
  for (const t of project.textures) {
    estimated_texture_vram_bytes += t.width * t.height * 4;
  }

  return {
    total_vertices,
    total_triangles,
    artmesh_count,
    artpath_count,
    warp_count,
    rotation_count,
    deform_path_count,
    parameter_count: project.parameters.length,
    keyform_count: project.keyforms.reduce((acc, k) => acc + k.keyforms.length, 0),
    estimated_texture_vram_bytes,
  };
}

/**
 * Transforms points from an axis-aligned source bounding box `[minX, minY, width, height]`
 * into an arbitrary 4-corner quadrilateral `[topLeft, topRight, bottomLeft, bottomRight]`.
 * Supports both `'perspective'` (2D Projective Homography with foreshortening depth scaling,
 * matching `onMoveSelectPoint_perspective` / `QuadWeight_v2` in Cubism 5.3) and `'bilinear'`.
 */
export function transformPointsByFreeQuad(
  points: [number, number][],
  bounds: [number, number, number, number],
  quadCorners: [[number, number], [number, number], [number, number], [number, number]],
  mode: 'perspective' | 'bilinear' = 'perspective'
): [number, number][] {
  const [minX, minY, w, h] = bounds;
  if (Math.abs(w) < 1e-5 || Math.abs(h) < 1e-5) return points;
  const [p00, p10, p01, p11] = quadCorners;

  if (mode === 'perspective') {
    // Compute projective homography mapping unit square (0,0),(1,0),(0,1),(1,1) -> p00,p10,p01,p11
    const dx1 = p10[0] - p11[0];
    const dy1 = p10[1] - p11[1];
    const dx2 = p01[0] - p11[0];
    const dy2 = p01[1] - p11[1];
    const sx = p00[0] - p10[0] + p11[0] - p01[0];
    const sy = p00[1] - p10[1] + p11[1] - p01[1];
    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) > 1e-6) {
      const g = (sx * dy2 - sy * dx2) / det;
      const hCoeff = (dx1 * sy - dy1 * sx) / det;
      const a = p10[0] - p00[0] + g * p10[0];
      const b = p01[0] - p00[0] + hCoeff * p01[0];
      const c = p00[0];
      const d = p10[1] - p00[1] + g * p10[1];
      const e = p01[1] - p00[1] + hCoeff * p01[1];
      const f = p00[1];

      return points.map(([px, py]): [number, number] => {
        const u = (px - minX) / w;
        const v = (py - minY) / h;
        const denom = g * u + hCoeff * v + 1.0;
        if (Math.abs(denom) < 1e-5) return [px, py];
        return [(a * u + b * v + c) / denom, (d * u + e * v + f) / denom];
      });
    }
  }

  // Bilinear quad interpolation
  return points.map(([px, py]): [number, number] => {
    const u = (px - minX) / w;
    const v = (py - minY) / h;
    const tx = p00[0] * (1 - u) + p10[0] * u;
    const ty = p00[1] * (1 - u) + p10[1] * u;
    const bx = p01[0] * (1 - u) + p11[0] * u;
    const by = p01[1] * (1 - u) + p11[1] * u;
    return [tx * (1 - v) + bx * v, ty * (1 - v) + by * v];
  });
}

/**
 * Generates a triangulated strip mesh along a user/agent stroke polyline (`CMD_TOOL_MODE_MESH_EDIT_STROKE_MESH`).
 */
export function generateStrokeMeshTopology(
  strokePoints: [number, number][],
  width: number = 24,
  canvasSize: [number, number] = [1920, 1080]
): { vertices: [number, number][]; uvs: [number, number][]; indices: number[] } {
  const n = strokePoints.length;
  if (n < 2) {
    return { vertices: [], uvs: [], indices: [] };
  }
  const vertices: [number, number][] = [];
  const uvs: [number, number][] = [];
  const indices: number[] = [];
  const [cw, ch] = canvasSize;

  for (let i = 0; i < n; i++) {
    const pCurr = strokePoints[i];
    const pPrev = i > 0 ? strokePoints[i - 1] : pCurr;
    const pNext = i + 1 < n ? strokePoints[i + 1] : pCurr;
    let tx = pNext[0] - pPrev[0];
    let ty = pNext[1] - pPrev[1];
    const len = Math.hypot(tx, ty);
    if (len > 1e-5) {
      tx /= len;
      ty /= len;
    } else {
      tx = 1;
      ty = 0;
    }
    const nx = -ty;
    const ny = tx;
    const halfW = Math.max(1, width * 0.5);

    const leftPt: [number, number] = [pCurr[0] + nx * halfW, pCurr[1] + ny * halfW];
    const centerPt: [number, number] = [pCurr[0], pCurr[1]];
    const rightPt: [number, number] = [pCurr[0] - nx * halfW, pCurr[1] - ny * halfW];

    vertices.push(leftPt, centerPt, rightPt);
    for (const pt of [leftPt, centerPt, rightPt]) {
      uvs.push([
        Math.max(0, Math.min(1, pt[0] / (cw || 1))),
        Math.max(0, Math.min(1, pt[1] / (ch || 1))),
      ]);
    }
  }

  // 3 vertices per cross-section -> 4 triangles per segment
  for (let i = 0; i < n - 1; i++) {
    const b0 = i * 3;
    const b1 = (i + 1) * 3;
    // Left band
    indices.push(b0, b0 + 1, b1, b1, b0 + 1, b1 + 1);
    // Right band
    indices.push(b0 + 1, b0 + 2, b1 + 1, b1 + 1, b0 + 2, b1 + 2);
  }

  return { vertices, uvs, indices };
}

export interface ModelingTemplate {
  template_version: number;
  canvas: { width: number; height: number };
  parameters: Project['parameters'];
  parameter_groups: NonNullable<Project['parameter_groups']>;
  deformers: Node[];
  keyforms: KeyformBinding[];
  physics: NonNullable<Project['physics']>;
}

/**
 * Exports a project's rigging structure (parameters, deformers, keyforms, physics) as a reusable template (`CMD_EXPORT_AS_TEMPLATE`).
 */
export function exportModelingTemplate(project: Project): ModelingTemplate {
  const deformers = project.nodes.filter(
    (n) =>
      n.kind.type === 'WarpDeformer' ||
      n.kind.type === 'RotationDeformer' ||
      n.kind.type === 'DeformPath'
  );
  const deformerIds = new Set(deformers.map((d) => d.id));
  const keyforms = project.keyforms.filter((k) => deformerIds.has(k.target_node_id));
  return {
    template_version: 1,
    canvas: { width: project.canvas.width, height: project.canvas.height },
    parameters: JSON.parse(JSON.stringify(project.parameters)),
    parameter_groups: JSON.parse(JSON.stringify(project.parameter_groups || [])),
    deformers: JSON.parse(JSON.stringify(deformers)),
    keyforms: JSON.parse(JSON.stringify(keyforms)),
    physics: JSON.parse(JSON.stringify(project.physics || [])),
  };
}
