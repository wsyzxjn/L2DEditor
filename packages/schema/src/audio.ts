import type { TimelineKeyframe } from './types.js';

export interface LipSyncResult {
  fps: number;
  durationFrames: number;
  keyframes: TimelineKeyframe[];
}

/**
 * Analyzes a 16-bit PCM WAV audio buffer or Uint8Array and generates lip-sync keyframes for ParamMouthOpen.
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
  let prevValue = 0.0;

  for (let f = 0; f < durationFrames; f++) {
    const startSample = f * samplesPerFrame;
    const endSample = Math.min(totalSamples, startSample + samplesPerFrame);
    const count = endSample - startSample;

    if (count <= 0) break;

    let sumSq = 0;
    for (let s = startSample; s < endSample; s++) {
      const byteIdx = dataOffset + s * 2 * numChannels;
      if (byteIdx + 2 <= wavBytes.length) {
        const sample16 = view.getInt16(byteIdx, true);
        sumSq += (sample16 / 32768.0) * (sample16 / 32768.0);
      }
    }

    const rms = Math.sqrt(sumSq / count);
    let rawMouth = Math.max(0, (rms - noiseThreshold) / (0.4 - noiseThreshold));
    rawMouth = Math.min(1.0, rawMouth * mouthOpenScale);

    const attack = 0.65;
    const decay = 0.35;
    const smoothValue = rawMouth > prevValue
      ? prevValue + (rawMouth - prevValue) * attack
      : prevValue + (rawMouth - prevValue) * decay;

    prevValue = smoothValue;

    keyframes.push({
      frame: f,
      value: Number(smoothValue.toFixed(3)),
      curve: 'bezier',
    });
  }

  return {
    fps,
    durationFrames,
    keyframes,
  };
}
