import type { TimelineKeyframe } from '@l2d/schema';

export interface LipSyncResult {
  fps: number;
  durationFrames: number;
  keyframes: TimelineKeyframe[];
}

/**
 * Analyzes a 16-bit PCM WAV audio buffer and generates lip-sync keyframes for ParamMouthOpen.
 */
export function analyzeWavForLipSync(
  wavBuffer: Buffer,
  fps: number = 30,
  noiseThreshold: number = 0.05,
  mouthOpenScale: number = 1.0
): LipSyncResult {
  // 1. Parse RIFF WAV Header
  if (wavBuffer.length < 44) {
    throw new Error('Invalid WAV file: buffer too short');
  }

  const riff = wavBuffer.toString('ascii', 0, 4);
  const wave = wavBuffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Invalid WAV header format');
  }

  // Find 'fmt ' chunk
  let offset = 12;
  let numChannels = 1;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      numChannels = wavBuffer.readUInt16LE(offset + 10);
      sampleRate = wavBuffer.readUInt32LE(offset + 12);
      bitsPerSample = wavBuffer.readUInt16LE(offset + 22);
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

  // 2. Read samples and compute RMS energy per video frame
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
      if (byteIdx + 2 <= wavBuffer.length) {
        const sample16 = wavBuffer.readInt16LE(byteIdx);
        sumSq += (sample16 / 32768.0) * (sample16 / 32768.0);
      }
    }

    const rms = Math.sqrt(sumSq / count);
    let rawMouth = Math.max(0, (rms - noiseThreshold) / (0.4 - noiseThreshold));
    rawMouth = Math.min(1.0, rawMouth * mouthOpenScale);

    // Apply smooth attack & decay
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

/**
 * Creates a synthetic 16-bit mono PCM WAV buffer for testing purposes.
 */
export function createSyntheticWavBuffer(
  durationSec: number = 1.0,
  frequencyHz: number = 440,
  sampleRate: number = 44100
): Buffer {
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequencyHz * t);
    const intSample = Math.floor(sample * 30000);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}
