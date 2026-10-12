import type { TimelineKeyframe } from './types.js';

export interface LipSyncResult {
  fps: number;
  durationFrames: number;
  keyframes: TimelineKeyframe[];
  mouthFormKeyframes: TimelineKeyframe[];
  vowelKeyframes: Record<'A' | 'I' | 'U' | 'E' | 'O', TimelineKeyframe[]>;
  waveformPeaks: number[];
}

/**
 * Analyzes a 16-bit PCM WAV audio buffer and generates CRI-aligned lip-sync keyframes
 * (`res/values/motionSync/default_motion_sync_preset.xml`):
 * - `keyframes`: ParamMouthOpenY (0.0 .. 1.0)
 * - `mouthFormKeyframes`: ParamMouthForm (-1.0 .. 1.0, estimated via zero-crossing spectral centroid)
 * - `vowelKeyframes`: 5-vowel blendshape weights (A, I, U, E, O)
 * - `waveformPeaks`: normalized per-frame peak amplitude (0.0 .. 1.0) for Timeline waveform visualization
 */
export function analyzeWavForLipSync(
  wavBytes: Uint8Array,
  fps: number = 30,
  noiseThreshold: number = 0.05,
  mouthOpenScale: number = 1.0
): LipSyncResult {
  if (wavBytes.length < 44) {
    throw new Error('Invalid WAV file: buffer too short');
  }

  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);

  // RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid WAV header format');
  }

  let offset = 12;
  let numChannels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= wavBytes.length) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  if (dataOffset < 0 || bitsPerSample !== 16) {
    throw new Error('Unsupported WAV: must contain 16-bit PCM data chunk');
  }

  const totalSamples = Math.floor(dataLength / (2 * numChannels));
  const samplesPerFrame = Math.floor(sampleRate / fps);
  const durationFrames = Math.ceil(totalSamples / samplesPerFrame);

  const keyframes: TimelineKeyframe[] = [];
  const mouthFormKeyframes: TimelineKeyframe[] = [];
  const vowelKeyframes: Record<'A' | 'I' | 'U' | 'E' | 'O', TimelineKeyframe[]> = {
    A: [],
    I: [],
    U: [],
    E: [],
    O: [],
  };
  const waveformPeaks: number[] = [];
  let prevValue = 0.0;
  let prevForm = 0.0;

  for (let f = 0; f < durationFrames; f++) {
    const startSample = f * samplesPerFrame;
    const endSample = Math.min(totalSamples, startSample + samplesPerFrame);
    const count = endSample - startSample;

    if (count <= 0) break;

    let sumSq = 0;
    let peak = 0;
    let zeroCrossings = 0;
    let prevSample = 0;
    for (let s = startSample; s < endSample; s++) {
      const byteIdx = dataOffset + s * 2 * numChannels;
      if (byteIdx + 2 <= wavBytes.length) {
        const norm = view.getInt16(byteIdx, true) / 32768.0;
        sumSq += norm * norm;
        const absNorm = Math.abs(norm);
        if (absNorm > peak) peak = absNorm;
        if (s > startSample && ((norm >= 0 && prevSample < 0) || (norm < 0 && prevSample >= 0))) {
          zeroCrossings++;
        }
        prevSample = norm;
      }
    }

    const rms = Math.sqrt(sumSq / count);
    waveformPeaks.push(Number(Math.min(1.0, peak).toFixed(3)));
    let rawMouth = Math.max(0, (rms - noiseThreshold) / (0.4 - noiseThreshold));
    rawMouth = Math.min(1.0, rawMouth * mouthOpenScale);

    const attack = 0.65;
    const decay = 0.35;
    const smoothValue = rawMouth > prevValue
      ? prevValue + (rawMouth - prevValue) * attack
      : prevValue + (rawMouth - prevValue) * decay;

    prevValue = smoothValue;

    // Estimate vowel class (A, I, U, E, O) using energy + zero-crossing frequency (CRI_LIP_SYNC_DEFAULT_1/2)
    const zcrHz = (zeroCrossings * sampleRate) / (2 * Math.max(1, count));
    let targetForm = 0.0;
    const vWeights = { A: 0, I: 0, U: 0, E: 0, O: 0 };
    if (smoothValue > 0.05) {
      if (zcrHz > 1400) {
        // High second formant -> 'I' or 'E' (spread mouth form +1.0)
        targetForm = 1.0;
        if (smoothValue > 0.55) vWeights.E = Number(smoothValue.toFixed(3));
        else vWeights.I = Number(smoothValue.toFixed(3));
      } else if (zcrHz < 550) {
        // Low formant -> 'U' or 'O' (rounded mouth form -1.0)
        targetForm = -1.0;
        if (smoothValue > 0.6) vWeights.O = Number(smoothValue.toFixed(3));
        else vWeights.U = Number(smoothValue.toFixed(3));
      } else {
        // Mid formant + open -> 'A' (mouth form +1.0, open 1.0)
        targetForm = 1.0;
        vWeights.A = Number(smoothValue.toFixed(3));
      }
    }
    const smoothForm = prevForm + (targetForm - prevForm) * 0.45;
    prevForm = smoothForm;

    keyframes.push({
      frame: f,
      value: Number(smoothValue.toFixed(3)),
      curve: 'bezier',
    });
    mouthFormKeyframes.push({
      frame: f,
      value: Number(smoothForm.toFixed(3)),
      curve: 'bezier',
    });
    for (const v of ['A', 'I', 'U', 'E', 'O'] as const) {
      vowelKeyframes[v].push({
        frame: f,
        value: vWeights[v],
        curve: 'linear',
      });
    }
  }

  return {
    fps,
    durationFrames,
    keyframes,
    mouthFormKeyframes,
    vowelKeyframes,
    waveformPeaks,
  };
}
