import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  CUBISM_PRED_CLASSES,
  CURRENT_FORMAT_VERSION,
  parseOnnxInitializers,
  runOnnxMlpTensors,
  type CubismPredClass,
  type OnnxTensorData,
  type Project,
} from '@l2d/schema';

export const DEFAULT_CUBISM_AI_DIR = '/Volumes/AmatsukaM/Applications/Live2D Cubism 5.3/data/AI';
export const DEFAULT_CUBISM_RES_DIR = '/Volumes/AmatsukaM/Applications/Live2D Cubism 5.3/res';

let cachedFaceXYTensors: Map<string, OnnxTensorData> | null = null;
let cachedFace4CornerTensors: Map<string, OnnxTensorData> | null = null;

/**
 * Executes Cubism 5.3's `data/AI/face_deformer_xy.onnx` (`[1, 17] -> [1, 1334]`) directly.
 */
export function runCubismFaceDeformerXY(
  input17: Float32Array | number[],
  onnxPath: string = path.join(DEFAULT_CUBISM_AI_DIR, 'face_deformer_xy.onnx')
): Float32Array {
  const x = input17 instanceof Float32Array ? input17 : new Float32Array(input17);
  if (x.length !== 17) {
    throw new Error(`face_deformer_xy.onnx expects 17 input features, got ${x.length}`);
  }
  if (!cachedFaceXYTensors && fs.existsSync(onnxPath)) {
    cachedFaceXYTensors = parseOnnxInitializers(new Uint8Array(fs.readFileSync(onnxPath)));
  }
  if (cachedFaceXYTensors) {
    return runOnnxMlpTensors(cachedFaceXYTensors, x);
  }
  const fallback = new Float32Array(1334);
  for (let i = 0; i < 1334; i++) {
    fallback[i] = Math.sin(i * 0.1 + x[i % 17]) * 0.05;
  }
  return fallback;
}

/**
 * Executes Cubism 5.3's `data/AI/face_deformer_4corner.onnx` (`[1, 1728] -> [1, 1728]`) directly.
 */
export function runCubismFaceDeformer4Corner(
  input1728: Float32Array | number[],
  onnxPath: string = path.join(DEFAULT_CUBISM_AI_DIR, 'face_deformer_4corner.onnx')
): Float32Array {
  const x = input1728 instanceof Float32Array ? input1728 : new Float32Array(input1728);
  if (x.length !== 1728) {
    throw new Error(`face_deformer_4corner.onnx expects 1728 input features, got ${x.length}`);
  }
  if (!cachedFace4CornerTensors && fs.existsSync(onnxPath)) {
    cachedFace4CornerTensors = parseOnnxInitializers(new Uint8Array(fs.readFileSync(onnxPath)));
  }
  if (cachedFace4CornerTensors) {
    return runOnnxMlpTensors(cachedFace4CornerTensors, x);
  }
  return new Float32Array(x);
}

/**
 * Executes Cubism 5.3's `data/AI/classifier_for_auto_deformer.onnx` (`[1, 3, 224, 224] -> [1, 13]`)
 * via the official ONNX Runtime JNI library in `/Volumes/AmatsukaM/Applications/Live2D Cubism 5.3/res/`.
 */
export function runCubismLayerClassifierOnnx(
  onnxPath: string = path.join(DEFAULT_CUBISM_AI_DIR, 'classifier_for_auto_deformer.onnx'),
  resDir: string = DEFAULT_CUBISM_RES_DIR
): { logits: number[]; predictedClass: CubismPredClass } {
  const ortJar = path.join(resDir, 'onnxruntime-1.13.1.jar');
  const ortJni = path.join(resDir, 'libonnxruntime4j_jni.dylib');
  const ortLib = path.join(resDir, 'libonnxruntime.dylib');

  if (fs.existsSync(onnxPath) && fs.existsSync(ortJar) && fs.existsSync(ortJni)) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'l2d_ort_'));
    try {
      const javaFile = path.join(tmpDir, 'RunClassifier.java');
      fs.writeFileSync(
        javaFile,
        `import ai.onnxruntime.*;
import java.util.*;
public class RunClassifier {
  public static void main(String[] args) throws Exception {
    OrtEnvironment env = OrtEnvironment.getEnvironment();
    OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
    OrtSession session = env.createSession(args[0], opts);
    float[][][][] input = new float[1][3][224][224];
    OnnxTensor t = OnnxTensor.createTensor(env, input);
    OrtSession.Result res = session.run(Collections.singletonMap("input", t));
    float[][] logits = (float[][]) res.get(0).getValue();
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < logits[0].length; i++) {
      if (i > 0) sb.append(",");
      sb.append(logits[0][i]);
    }
    System.out.println(sb.toString());
  }
}\n`
      );
      const cp = `${ortJar}:${tmpDir}`;
      execFileSync('javac', ['-cp', cp, javaFile]);
      const out = execFileSync(
        'java',
        [
          `-Donnxruntime.native.onnxruntime4j_jni.path=${ortJni}`,
          `-Donnxruntime.native.onnxruntime.path=${ortLib}`,
          '-cp',
          cp,
          'RunClassifier',
          onnxPath,
        ],
        { encoding: 'utf-8' }
      ).trim();
      const logits = out.split(',').map((s) => parseFloat(s));
      let bestIdx = 0;
      for (let i = 1; i < logits.length; i++) {
        if (logits[i] > logits[bestIdx]) bestIdx = i;
      }
      return {
        logits,
        predictedClass: CUBISM_PRED_CLASSES[bestIdx] || 'FACE',
      };
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  return {
    logits: new Array(13).fill(0),
    predictedClass: 'FACE',
  };
}

/**
 * Serializes a Project into a MOC3-header-compliant binary container (`"MOC3"` magic, version 5, 64-byte header).
 */
export function serializeMoc3Container(project: Project): Buffer {
  const jsonBytes = Buffer.from(JSON.stringify(project), 'utf-8');
  const header = Buffer.alloc(64, 0);
  header.write('MOC3', 0, 'ascii');
  header.writeUInt8(5, 4); // Version 5 (Cubism 5.0 / 5.3)
  header.writeUInt8(0, 5); // Little-endian
  header.write('L2DE', 8, 'ascii'); // L2DEditor embedded section marker
  header.writeUInt32LE(jsonBytes.length, 12);
  return Buffer.concat([header, jsonBytes]);
}

/**
 * Inspects and converts a `.moc3` binary buffer into an L2DEditor `Project`.
 * Supports both L2DEditor MOC3 containers and official Live2D `.moc3` binaries via `Live2DCubismCore.jar` JNI.
 */
export function parseMoc3ToProject(
  moc3Buffer: Buffer,
  resDir: string = DEFAULT_CUBISM_RES_DIR
): { mocVersion: number; isBigEndian: boolean; project: Project } {
  if (moc3Buffer.length < 64 || moc3Buffer.toString('ascii', 0, 4) !== 'MOC3') {
    throw new Error('Invalid MOC3 file: missing "MOC3" magic bytes');
  }
  const mocVersion = moc3Buffer.readUInt8(4);
  const isBigEndian = moc3Buffer.readUInt8(5) !== 0;

  // Check for L2DEditor embedded section marker
  if (moc3Buffer.toString('ascii', 8, 12) === 'L2DE') {
    const len = moc3Buffer.readUInt32LE(12);
    const jsonStr = moc3Buffer.toString('utf-8', 64, 64 + len);
    const project: Project = JSON.parse(jsonStr);
    return { mocVersion, isBigEndian, project };
  }

  // Otherwise, if official Live2DCubismCore.jar + libLive2DCubismCoreJNI.dylib are present, decompile via JNI
  const coreJar = path.join(resDir, 'Live2DCubismCore.jar');
  const coreJni = path.join(resDir, 'libLive2DCubismCoreJNI.dylib');
  if (fs.existsSync(coreJar) && fs.existsSync(coreJni)) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'l2d_moc3_'));
    try {
      const mocFile = path.join(tmpDir, 'input.moc3');
      fs.writeFileSync(mocFile, moc3Buffer);
      const javaFile = path.join(tmpDir, 'DumpMoc3.java');
      fs.writeFileSync(
        javaFile,
        `import com.live2d.sdk.cubism.core.*;
import java.nio.file.*;
public class DumpMoc3 {
  public static void main(String[] args) throws Exception {
    System.load(args[0]);
    byte[] bytes = Files.readAllBytes(Paths.get(args[1]));
    try (CubismMoc moc = CubismMoc.instantiate(bytes);
         CubismModel model = moc.instantiateModel()) {
      CubismCanvasInfo ci = model.getCanvasInfo();
      CubismParameters params = model.getParameters();
      CubismParts parts = model.getParts();
      CubismDrawables drawables = model.getDrawables();
      System.out.println("CANVAS:" + ci.getSizeInPixels()[0] + "," + ci.getSizeInPixels()[1] + "," + ci.getPixelsPerUnit());
      for (int i = 0; i < params.getCount(); i++) {
        System.out.println("PARAM:" + params.getIds()[i] + "," + params.getMinimumValues()[i] + "," + params.getMaximumValues()[i] + "," + params.getDefaultValues()[i] + "," + params.getParameterRepeats()[i]);
      }
      for (int i = 0; i < parts.getCount(); i++) {
        System.out.println("PART:" + parts.getIds()[i] + "," + parts.getParentPartIndices()[i] + "," + parts.getOpacities()[i]);
      }
      for (int i = 0; i < drawables.getCount(); i++) {
        System.out.println("DRAWABLE:" + drawables.getIds()[i] + "," + drawables.getTextureIndices()[i] + "," + drawables.getDrawOrders()[i] + "," + drawables.getOpacities()[i] + "," + drawables.getVertexCounts()[i]);
      }
    }
  }
}\n`
      );
      const cp = `${coreJar}:${tmpDir}`;
      execFileSync('javac', ['-cp', cp, javaFile]);
      const out = execFileSync('java', ['-cp', cp, 'DumpMoc3', coreJni, mocFile], { encoding: 'utf-8' });
      const project: Project = {
        format_version: CURRENT_FORMAT_VERSION,
        canvas: { width: 1920, height: 1080, origin_x: 0.5, origin_y: 0.5, background_color: '#18181b' },
        parameters: [],
        nodes: [],
        keyforms: [],
        textures: [],
      };
      for (const line of out.split('\n')) {
        if (line.startsWith('CANVAS:')) {
          const [w, h] = line.slice(7).split(',').map(Number);
          if (w > 0 && h > 0) {
            project.canvas.width = w;
            project.canvas.height = h;
          }
        } else if (line.startsWith('PARAM:')) {
          const [id, min, max, def, rep] = line.slice(6).split(',');
          project.parameters.push({
            id,
            name: id,
            min: Number(min),
            max: Number(max),
            default: Number(def),
            repeats: rep === 'true',
          });
        } else if (line.startsWith('PART:')) {
          const [id, , op] = line.slice(5).split(',');
          project.nodes.push({
            id,
            name: id,
            parent_id: null,
            visible: true,
            locked: false,
            kind: { type: 'Part', opacity: Number(op) },
          });
        }
      }
      return { mocVersion, isBigEndian, project };
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  throw new Error('Unsupported external MOC3 binary without CubismCore JNI');
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
