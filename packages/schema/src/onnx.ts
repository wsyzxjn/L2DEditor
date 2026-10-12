/**
 * The 13 official layer classification categories from `com.live2d.cubism.doc.model.deformer.autoDeformerCreate.PredClass` (`L.class`).
 */
export const CUBISM_PRED_CLASSES = [
  'BACKGROUND',
  'ARM',
  'UPPER_BODY',
  'LOWER_BODY',
  'HAIR',
  'FACE',
  'EYE_BROWS',
  'EYE',
  'EYE_BALL',
  'NOSE',
  'MOUTH',
  'EAR',
  'NECK',
] as const;

export type CubismPredClass = (typeof CUBISM_PRED_CLASSES)[number];

export interface OnnxTensorData {
  name: string;
  dims: number[];
  data: Float32Array;
}

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let val = 0;
  let shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    val |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return [val >>> 0, pos];
    shift += 7;
  }
  return [val >>> 0, pos];
}

interface ProtoField {
  fieldNum: number;
  wireType: number;
  value: number | Uint8Array;
}

function parseProtoFields(buf: Uint8Array, start = 0, end = buf.length): ProtoField[] {
  let pos = start;
  const fields: ProtoField[] = [];
  while (pos < end) {
    const [tag, nextPos] = readVarint(buf, pos);
    pos = nextPos;
    const fieldNum = tag >>> 3;
    const wireType = tag & 7;
    if (wireType === 0) {
      const [v, p2] = readVarint(buf, pos);
      pos = p2;
      fields.push({ fieldNum, wireType, value: v });
    } else if (wireType === 1) {
      fields.push({ fieldNum, wireType, value: buf.subarray(pos, pos + 8) });
      pos += 8;
    } else if (wireType === 2) {
      const [len, p2] = readVarint(buf, pos);
      pos = p2;
      fields.push({ fieldNum, wireType, value: buf.subarray(pos, pos + len) });
      pos += len;
    } else if (wireType === 5) {
      fields.push({ fieldNum, wireType, value: buf.subarray(pos, pos + 4) });
      pos += 4;
    } else {
      break;
    }
  }
  return fields;
}

/**
 * Parses initializer tensors (`fc1.weight`, `fc1.bias`, etc.) from an ONNX protobuf file.
 */
export function parseOnnxInitializers(onnxBytes: Uint8Array): Map<string, OnnxTensorData> {
  const tensors = new Map<string, OnnxTensorData>();
  const topFields = parseProtoFields(onnxBytes);
  const decoder = new TextDecoder();

  for (const f of topFields) {
    if (f.fieldNum === 7 && f.wireType === 2 && f.value instanceof Uint8Array) {
      const graphFields = parseProtoFields(f.value);
      for (const gf of graphFields) {
        if (gf.fieldNum === 5 && gf.wireType === 2 && gf.value instanceof Uint8Array) {
          let name = '';
          const dims: number[] = [];
          let rawData: Uint8Array | null = null;
          const floatChunks: Uint8Array[] = [];

          for (const tf of parseProtoFields(gf.value)) {
            if (tf.fieldNum === 1 && tf.wireType === 0 && typeof tf.value === 'number') {
              dims.push(tf.value);
            } else if (tf.fieldNum === 8 && tf.wireType === 2 && tf.value instanceof Uint8Array) {
              name = decoder.decode(tf.value);
            } else if (tf.fieldNum === 9 && tf.wireType === 2 && tf.value instanceof Uint8Array) {
              rawData = tf.value;
            } else if (tf.fieldNum === 4 && tf.wireType === 2 && tf.value instanceof Uint8Array) {
              floatChunks.push(tf.value);
            }
          }

          let data: Float32Array;
          if (rawData) {
            const view = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);
            const len = Math.floor(rawData.byteLength / 4);
            data = new Float32Array(len);
            for (let i = 0; i < len; i++) {
              data[i] = view.getFloat32(i * 4, true);
            }
          } else {
            const totalBytes = floatChunks.reduce((acc, c) => acc + c.byteLength, 0);
            const len = Math.floor(totalBytes / 4);
            data = new Float32Array(len);
            let idx = 0;
            for (const c of floatChunks) {
              const view = new DataView(c.buffer, c.byteOffset, c.byteLength);
              for (let i = 0; i < c.byteLength; i += 4) {
                data[idx++] = view.getFloat32(i, true);
              }
            }
          }

          if (name) {
            tensors.set(name, { name, dims, data });
          }
        }
      }
    }
  }

  return tensors;
}

function gemmRelu(input: Float32Array, weight: OnnxTensorData, bias: OnnxTensorData, applyRelu: boolean): Float32Array {
  const [outFeatures, inFeatures] = weight.dims;
  const out = new Float32Array(outFeatures);
  const wData = weight.data;
  const bData = bias.data;
  for (let r = 0; r < outFeatures; r++) {
    let sum = bData[r] || 0;
    const rowOffset = r * inFeatures;
    for (let c = 0; c < inFeatures; c++) {
      sum += (input[c] || 0) * wData[rowOffset + c];
    }
    out[r] = applyRelu ? Math.max(0, sum) : sum;
  }
  return out;
}

/**
 * Runs a 3-layer ONNX MLP (`fc1 -> Relu -> fc2 -> Relu -> fc3`) from parsed ONNX initializer tensors.
 */
export function runOnnxMlpTensors(
  tensors: Map<string, OnnxTensorData>,
  input: Float32Array | number[]
): Float32Array {
  const x = input instanceof Float32Array ? input : new Float32Array(input);
  const w1 = tensors.get('fc1.weight');
  const b1 = tensors.get('fc1.bias');
  const w2 = tensors.get('fc2.weight');
  const b2 = tensors.get('fc2.bias');
  const w3 = tensors.get('fc3.weight');
  const b3 = tensors.get('fc3.bias');
  if (!w1 || !b1 || !w2 || !b2 || !w3 || !b3) {
    throw new Error('Missing expected MLP weights (fc1/fc2/fc3) in ONNX model');
  }
  const h1 = gemmRelu(x, w1, b1, true);
  const h2 = gemmRelu(h1, w2, b2, true);
  return gemmRelu(h2, w3, b3, false);
}
