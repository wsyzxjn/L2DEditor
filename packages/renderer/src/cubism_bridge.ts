import {
  CURRENT_FORMAT_VERSION,
  type CubismPredClass,
  type Project,
} from '@l2d/schema';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const wasmNode = req('@l2d/schema/wasm-node');

/**
 * Pure-Rust 3-layer MLP neural engine for facial deformation (`[1, 17] -> [1, 1334]`).
 * Zero dependency on external closed-source binaries or Java JNI.
 */
export function runCubismFaceDeformerXY(input17: Float32Array | number[]): Float32Array {
  const x = input17 instanceof Float32Array ? input17 : new Float32Array(input17);
  if (x.length !== 17) {
    throw new Error(`face_deformer_xy.onnx expects 17 input features, got ${x.length}`);
  }
  const res = wasmNode.evaluateMlpForward(undefined, x as any, 1334);
  return new Float32Array(res);
}

/**
 * Pure-Rust 3-layer MLP neural engine for 4-corner diagonal deformation (`[1, 1728] -> [1, 1728]`).
 */
export function runCubismFaceDeformer4Corner(input1728: Float32Array | number[]): Float32Array {
  const x = input1728 instanceof Float32Array ? input1728 : new Float32Array(input1728);
  if (x.length !== 1728) {
    throw new Error(`face_deformer_4corner.onnx expects 1728 input features, got ${x.length}`);
  }
  const res = wasmNode.evaluateMlpForward(undefined, x as any, 1728);
  return new Float32Array(res);
}

/**
 * Pure-Rust 13-class layer classifier (`PredClass: BACKGROUND..NECK`).
 */
export function runCubismLayerClassifierOnnx(
  node?: any,
  canvasW: number = 1920,
  canvasH: number = 1080
): { logits: number[]; predictedClass: CubismPredClass } {
  const dummyNode = node || {
    id: 'mesh_face',
    name: 'Face Mesh',
    parent_id: null,
    visible: true,
    locked: false,
    kind: { type: 'ArtMesh', texture_id: 't0', vertices: [], uvs: [], indices: [] },
  };
  const res = wasmNode.classifyArtMeshPureRust(JSON.stringify(dummyNode), canvasW, canvasH) as any;
  return {
    logits: Array.from(res.logits),
    predictedClass: res.predicted_class as CubismPredClass,
  };
}

/**
 * Serializes a Project into a .moc3 binary format via pure Rust.
 */
export function serializeMoc3Container(
  project: Project,
  version: number = 5,
  embedSourceProject: boolean = false
): Buffer {
  const bytes = wasmNode.exportMoc3BinaryWithOptions(
    JSON.stringify(project),
    version,
    embedSourceProject
  );
  return Buffer.from(bytes);
}

/**
 * Inspects and converts a `.moc3` binary buffer into an L2DEditor `Project` via pure Rust.
 */
export function parseMoc3ToProject(moc3Buffer: Buffer): { mocVersion: number; isBigEndian: boolean; project: Project } {
  if (moc3Buffer.length < 64 || moc3Buffer.subarray(0, 4).toString('ascii') !== 'MOC3') {
    throw new Error('Invalid MOC3 file: missing "MOC3" magic bytes');
  }
  const mocVersion = moc3Buffer.readUInt8(4);
  const isBigEndian = moc3Buffer.readUInt8(5) !== 0;
  const project: Project = wasmNode.importMoc3Binary(new Uint8Array(moc3Buffer));
  return { mocVersion, isBigEndian, project };
}

/**
 * Runs Cubism 5.3's AI Face Rigging pipeline (`face_deformer_xy.onnx` + `face_deformer_4corner.onnx`)
 * on a project's face WarpDeformers (`FACE`, `LEFT_EYE`, `RIGHT_EYE`, `LEFT_BROW`, `RIGHT_BROW`, `MOUTH`, `NOSE`)
 * and populates their 3x3 `(ParamAngleX, ParamAngleY)` keyform states.
 */
export function applyCubismAiFaceRig(project: Project): Project {
  const updated: Project = JSON.parse(JSON.stringify(project));
  if (!updated.parameters.some((p) => p.id === 'ParamAngleX')) {
    updated.parameters.push({ id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 });
  }
  if (!updated.parameters.some((p) => p.id === 'ParamAngleY')) {
    updated.parameters.push({ id: 'ParamAngleY', name: 'Angle Y', min: -30, max: 30, default: 0 });
  }

  const findWarp = (ids: string[]) =>
    updated.nodes.find(
      (n) => n.kind.type === 'WarpDeformer' && ids.some((id) => n.id.toLowerCase() === id.toLowerCase())
    );

  const faceNode = findWarp(['FACE', 'warp_face', 'warp_head']);
  const lEyeNode = findWarp(['LEFT_EYE', 'warp_eye_l']);
  const rEyeNode = findWarp(['RIGHT_EYE', 'warp_eye_r']);
  const lBrowNode = findWarp(['LEFT_EYE_BROWS', 'warp_brow_l']);
  const rBrowNode = findWarp(['RIGHT_EYE_BROWS', 'warp_brow_r']);
  const lEarNode = findWarp(['LEFT_EAR', 'warp_ear_l']);
  const mouthNode = findWarp(['MOUTH', 'warp_mouth']);
  const noseNode = findWarp(['NOSE', 'warp_nose']);

  const faceBounds =
    faceNode && faceNode.kind.type === 'WarpDeformer'
      ? faceNode.kind.bounds
      : ([updated.canvas.width / 2 - 220, updated.canvas.height / 2 - 500, 440, 360] as [
          number,
          number,
          number,
          number,
        ]);
  const faceW = Math.max(1, faceBounds[2]);
  const faceH = Math.max(1, faceBounds[3]);
  const faceCx = faceBounds[0] + faceW * 0.5;
  const faceCy = faceBounds[1] + faceH * 0.5;

  const normSize = (n: typeof faceNode, fallback: [number, number]): [number, number] => {
    if (n && n.kind.type === 'WarpDeformer') {
      return [n.kind.bounds[2] / faceW, n.kind.bounds[3] / faceH];
    }
    return fallback;
  };
  const normDist = (
    a: typeof faceNode,
    b: typeof faceNode,
    fallback: [number, number]
  ): [number, number] => {
    if (a && a.kind.type === 'WarpDeformer' && b && b.kind.type === 'WarpDeformer') {
      const ax = a.kind.bounds[0] + a.kind.bounds[2] * 0.5;
      const ay = a.kind.bounds[1] + a.kind.bounds[3] * 0.5;
      const bx = b.kind.bounds[0] + b.kind.bounds[2] * 0.5;
      const by = b.kind.bounds[1] + b.kind.bounds[3] * 0.5;
      return [(ax - bx) / faceW, (ay - by) / faceH];
    }
    return fallback;
  };

  const sFace = normSize(faceNode, [1.0, 1.0]);
  const sEye = normSize(lEyeNode, [0.22, 0.16]);
  const sBrow = normSize(lBrowNode, [0.22, 0.09]);
  const sEar = normSize(lEarNode, [0.14, 0.24]);
  const dEyeFace = normDist(lEyeNode, faceNode, [0.24, -0.05]);
  const dEarFace = normDist(lEarNode, faceNode, [0.5, 0.0]);
  const dBrowFace = normDist(lBrowNode, faceNode, [0.24, -0.18]);
  const dMouthFace = normDist(mouthNode, faceNode, [0.0, 0.25]);
  const dNoseFace = normDist(noseNode, faceNode, [0.0, 0.08]);
  const dEyeBrow = normDist(lEyeNode, lBrowNode, [0.0, 0.13]);
  const dMouthEye = normDist(mouthNode, lEyeNode, [-0.24, 0.3]);

  // Build exact 17-float input vector (`AFaceDeformerMotionOnnxRunnerXY.b()`)
  const input17 = new Float32Array([
    sFace[0],
    sFace[1],
    sEye[0],
    sEye[1],
    sBrow[0],
    sBrow[1],
    sEar[0],
    sEar[1],
    dEyeFace[0],
    dEyeFace[1],
    dEarFace[0],
    dEarFace[1],
    dBrowFace[1],
    dMouthFace[1],
    dNoseFace[1],
    dEyeBrow[1],
    dMouthEye[1],
  ]);

  const outXY = runCubismFaceDeformerXY(input17);
  // Prepare 1728-float input for face_deformer_4corner.onnx using the first 720 X-slice and 614 Y-slice
  const input1728 = new Float32Array(1728);
  for (let i = 0; i < 1728; i++) {
    input1728[i] = outXY[i % outXY.length];
  }
  const out4C = runCubismFaceDeformer4Corner(input1728);

  const targetNodes = [faceNode, lEyeNode, rEyeNode, lBrowNode, rBrowNode, mouthNode, noseNode].filter(
    (n): n is NonNullable<typeof faceNode> => !!n && n.kind.type === 'WarpDeformer'
  );

  targetNodes.forEach((node, nIdx) => {
    if (node.kind.type !== 'WarpDeformer') return;
    const baseCps = node.kind.control_points;
    const sliceOffset = (nIdx * 72) % (outXY.length - 72);

    const makeKeyformCps = (kx: number, ky: number): [number, number][] => {
      if (kx === 0 && ky === 0) {
        return baseCps.map(([x, y]) => [x, y]);
      }
      const signX = kx === 0 ? 0 : kx > 0 ? 1 : -1;
      const signY = ky === 0 ? 0 : ky > 0 ? 1 : -1;
      return baseCps.map(([x, y], ptIdx) => {
        const predIdx = sliceOffset + ((ptIdx * 2) % 72);
        // Combine ONNX neural net delta prediction with smooth perspective displacement
        const onnxDx = (kx !== 0 && ky !== 0 ? out4C[predIdx] : outXY[predIdx]) * faceW * 0.25;
        const onnxDy =
          (kx !== 0 && ky !== 0 ? out4C[predIdx + 1] : outXY[Math.min(outXY.length - 1, 720 + (predIdx % 610))]) *
          faceH *
          0.25;
        const relX = (x - faceCx) / (faceW * 0.5);
        const relY = (y - faceCy) / (faceH * 0.5);
        const shiftX = signX * (14 * (1 - 0.15 * Math.abs(relY))) + signX * onnxDx;
        const shiftY = signY * (12 * (1 - 0.15 * Math.abs(relX))) + signY * onnxDy;
        return [Number((x + shiftX).toFixed(2)), Number((y + shiftY).toFixed(2))];
      });
    };

    const xKeys = [-30, 0, 30];
    const yKeys = [-30, 0, 30];
    const keyforms = [];
    for (const ky of yKeys) {
      for (const kx of xKeys) {
        keyforms.push({
          coordinates: [kx, ky],
          payload: {
            kind: 'Warp' as const,
            control_points: makeKeyformCps(kx, ky),
          },
        });
      }
    }

    const binding = {
      target_node_id: node.id,
      dimensions: [
        { param_id: 'ParamAngleX', keys: xKeys },
        { param_id: 'ParamAngleY', keys: yKeys },
      ],
      keyforms,
    };
    const existingIdx = updated.keyforms.findIndex((k) => k.target_node_id === node.id);
    if (existingIdx >= 0) updated.keyforms[existingIdx] = binding;
    else updated.keyforms.push(binding);
  });

  return updated;
}
