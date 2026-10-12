export { createCanvas } from '@napi-rs/canvas';
import { createCanvas, Image, type SKRSContext2D } from '@napi-rs/canvas';
import type { Project, EvaluatedFrameJs, EvaluatedMeshJs } from '@l2d/schema';

export interface TextureResolver {
  (textureId: string): Buffer | null;
}

/**
 * Renders an evaluated frame to a PNG buffer using pure headless Canvas.
 * Deterministic, requires no GPU or display server.
 */
export function renderFrameToCanvas(
  canvasWidth: number,
  canvasHeight: number,
  frame: EvaluatedFrameJs,
  textureResolver: TextureResolver,
  backgroundColor: string = '#18181b'
): Buffer {
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Texture image cache
  const imgCache = new Map<string, Image>();

  for (const mesh of frame.meshes) {
    if (mesh.opacity <= 0.001) continue;

    let img = imgCache.get(mesh.texture_id);
    if (!img) {
      const buf = textureResolver(mesh.texture_id);
      if (buf) {
        const image = new Image();
        image.src = buf;
        img = image;
        imgCache.set(mesh.texture_id, image);
      }
    }

    if (!img) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, mesh.opacity));

    switch (mesh.blend_mode) {
      case 'multiply':
        ctx.globalCompositeOperation = 'multiply';
        break;
      case 'screen':
        ctx.globalCompositeOperation = 'screen';
        break;
      case 'additive':
        ctx.globalCompositeOperation = 'lighter';
        break;
      default:
        ctx.globalCompositeOperation = 'source-over';
        break;
    }

    drawTexturedMesh(ctx, mesh, img);
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

function drawTexturedMesh(ctx: SKRSContext2D, mesh: EvaluatedMeshJs, img: Image) {
  const texW = img.width;
  const texH = img.height;
  const indices = mesh.indices;
  const verts = mesh.vertices; // [x0, y0, x1, y1...]
  const uvs = mesh.uvs;        // [u0, v0, u1, v1...]

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const x0 = verts[i0 * 2];
    const y0 = verts[i0 * 2 + 1];
    const x1 = verts[i1 * 2];
    const y1 = verts[i1 * 2 + 1];
    const x2 = verts[i2 * 2];
    const y2 = verts[i2 * 2 + 1];

    const u0 = uvs[i0 * 2] * texW;
    const v0 = uvs[i0 * 2 + 1] * texH;
    const u1 = uvs[i1 * 2] * texW;
    const v1 = uvs[i1 * 2 + 1] * texH;
    const u2 = uvs[i2 * 2] * texW;
    const v2 = uvs[i2 * 2 + 1] * texH;

    drawTexturedTriangle(ctx, img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2);
  }
}

function drawTexturedTriangle(
  ctx: SKRSContext2D,
  img: Image,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  u0: number, v0: number,
  u1: number, v1: number,
  u2: number, v2: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

  // Solve affine transform matrix mapping (u, v) -> (x, y)
  // | x |   | a  c  e | | u |
  // | y | = | b  d  f | | v |
  // | 1 |   | 0  0  1 | | 1 |
  const delta = u0 * (v1 - v2) - v0 * (u1 - u2) + (u1 * v2 - u2 * v1);
  if (Math.abs(delta) < 1e-6) {
    ctx.restore();
    return;
  }

  const a = -(v0 * (x1 - x2) - v1 * x0 + v2 * x0 + (v1 * x2 - v2 * x1)) / delta;
  const b = -(v0 * (y1 - y2) - v1 * y0 + v2 * y0 + (v1 * y2 - v2 * y1)) / delta;
  const c = (u0 * (x1 - x2) - u1 * x0 + u2 * x0 + (u1 * x2 - u2 * x1)) / delta;
  const d = (u0 * (y1 - y2) - u1 * y0 + u2 * y0 + (u1 * y2 - u2 * y1)) / delta;
  const e = (u0 * (v1 * x2 - v2 * x1) - v0 * (u1 * x2 - u2 * x1) + (u1 * v2 - u2 * v1) * x0) / delta;
  const f = (u0 * (v1 * y2 - v2 * y1) - v0 * (u1 * y2 - u2 * y1) + (u1 * v2 - u2 * v1) * y0) / delta;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
