import { evaluateAnimationAtFrameJs, type Project } from '@l2d/schema';
import { renderFrameToCanvas, type TextureResolver } from './headless.js';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);

export interface RenderSequenceOptions {
  fps?: number;
  format?: 'png' | 'mp4' | 'webm' | 'gif';
  videoOutputPath?: string;
  audioWavPath?: string;
}

export async function renderAnimationSequence(
  project: Project,
  animationId: string,
  textureResolver: TextureResolver,
  outFramesDir: string,
  options: RenderSequenceOptions = {}
): Promise<{ totalFrames: number; videoPath?: string }> {
  const anim = project.animations?.find((a) => a.id === animationId);
  if (!anim) {
    throw new Error(`Animation '${animationId}' not found in project`);
  }

  const fps = options.fps || anim.fps || 30;
  const durationFrames = Math.max(1, Math.round(anim.duration_frames));

  fs.mkdirSync(outFramesDir, { recursive: true });

  const wasmNode = req('@l2d/schema/wasm-node');
  const WasmModelClass = wasmNode.WasmModel;
  const rawJson = JSON.stringify(project);
  const model = new WasmModelClass(rawJson);

  // Render each frame
  for (let f = 0; f < durationFrames; f++) {
    const frameParams = evaluateAnimationAtFrameJs(anim, f);
    for (const [paramId, val] of Object.entries(frameParams)) {
      model.setParameter(paramId, val);
    }

    // 2. Evaluate mesh frame
    const frameData = model.evaluate() as any;

    // 3. Render to PNG
    const pngBuf = await renderFrameToCanvas(
      project.canvas.width,
      project.canvas.height,
      frameData,
      textureResolver,
      project.canvas.background_color
    );

    const frameFilename = `frame_${String(f).padStart(4, '0')}.png`;
    fs.writeFileSync(path.join(outFramesDir, frameFilename), pngBuf);
  }

  let videoPath: string | undefined;

  // 4. Encode to MP4, WebM, or Animated GIF if requested and ffmpeg is available
  if (options.format === 'mp4' || options.format === 'webm' || options.format === 'gif' || options.videoOutputPath) {
    const finalVideo = options.videoOutputPath || path.join(outFramesDir, `output.${options.format || 'mp4'}`);
    const ffmpegBin = findFfmpegBinary();

    if (ffmpegBin) {
      const framePattern = path.join(outFramesDir, 'frame_%04d.png');
      const isGif = options.format === 'gif' || finalVideo.endsWith('.gif');
      const hasAudio = !isGif && options.audioWavPath && fs.existsSync(options.audioWavPath);
      const args = isGif
        ? ['-y', '-r', String(fps), '-i', framePattern, finalVideo]
        : [
            '-y',
            '-r',
            String(fps),
            '-i',
            framePattern,
            ...(hasAudio ? ['-i', options.audioWavPath!, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
            '-c:v',
            options.format === 'webm'
              ? 'libvpx-vp9'
              : ffmpegBin.includes('Live2D')
              ? 'libopenh264'
              : 'libx264',
            '-pix_fmt',
            options.format === 'webm' ? 'yuva420p' : 'yuv420p',
            finalVideo,
          ];

      try {
        execFileSync(ffmpegBin, args, { stdio: 'pipe' });
        videoPath = finalVideo;
      } catch (err) {
        console.warn('FFmpeg encoding failed:', err);
      }
    }
  }

  return {
    totalFrames: durationFrames,
    videoPath,
  };
}

function findFfmpegBinary(): string | null {
  const brewFfmpeg = '/opt/homebrew/bin/ffmpeg';
  if (fs.existsSync(brewFfmpeg)) {
    return brewFfmpeg;
  }
  try {
    const pathFfmpeg = execFileSync('which', ['ffmpeg'], { encoding: 'utf-8' }).trim();
    if (pathFfmpeg && fs.existsSync(pathFfmpeg)) {
      return pathFfmpeg;
    }
  } catch {
    // Ignore
  }
  return null;
}
