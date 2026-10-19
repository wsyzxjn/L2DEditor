export { createCanvas } from '@napi-rs/canvas';
import { clearAllCache, createCanvas, loadImage, Path2D, PathOp, FillType, StrokeJoin, Image, type Canvas, type SKRSContext2D } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { getMeshBoundaryLoops, type EvaluatedFrameJs, type EvaluatedMeshJs } from '@l2d/schema';

export interface TextureResolver {
  (textureId: string): Buffer | null;
}

export interface RenderSessionCache {
  textures: Map<string, Image>;
  textureHashes: Map<string, string>;
  crops: Map<string, Image>;
}

export function createRenderSessionCache(): RenderSessionCache {
  return {
    textures: new Map(),
    textureHashes: new Map(),
    crops: new Map(),
  };
}

export function disposeRenderSessionCache(cache: RenderSessionCache): void {
  for (const image of cache.textures.values()) {
    try { image.src = ''; } catch { /* Ignore alternate image implementations. */ }
  }
  for (const image of cache.crops.values()) {
    try { image.src = ''; } catch { /* Ignore alternate image implementations. */ }
  }
  cache.textures.clear();
  cache.textureHashes.clear();
  cache.crops.clear();
}

/**
 * Renders an evaluated frame to a PNG buffer using pure headless Canvas.
 * Deterministic, requires no GPU or display server.
 */
export async function renderFrameToCanvas(
  canvasWidth: number,
  canvasHeight: number,
  frame: EvaluatedFrameJs,
  textureResolver: TextureResolver,
  backgroundColor: string = '#18181b',
  sessionCache?: RenderSessionCache
): Promise<Buffer> {
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  const meshCanvas = createCanvas(canvasWidth, canvasHeight);
  const meshCtx = meshCanvas.getContext('2d');

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Texture image cache
  const imgCache = sessionCache?.textures ?? new Map<string, Image>();
  const textureHashes = sessionCache?.textureHashes ?? new Map<string, string>();
  const cropCache = sessionCache?.crops ?? new Map<string, Image>();
  const maskCanvases = new Map<string, Canvas>();
  const maskUnion = createCanvas(canvasWidth, canvasHeight);
  const maskUnionCtx = maskUnion.getContext('2d');

  try {
    for (const mesh of frame.meshes) {
      if (mesh.opacity <= 0.001) continue;

      const isSolidArtPath = mesh.texture_id === '__artpath_solid__';
      const resolvedTexture = isSolidArtPath
        ? null
        : await resolveTexture(mesh.texture_id, textureResolver, textureHashes, imgCache);
      const img = resolvedTexture?.image;

      if (!img && !isSolidArtPath) continue;

      meshCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      meshCtx.save();
      traceMesh(meshCtx, mesh);
      meshCtx.clip('evenodd');
      // The padded triangles share texels. Replace those texels instead of
      // accumulating their alpha, then apply the drawable opacity once.
      meshCtx.globalCompositeOperation = 'copy';
      if (isSolidArtPath || !img) drawSolidMesh(meshCtx, mesh);
      else await drawTexturedMesh(meshCtx, mesh, img, true, resolvedTexture!.hash, cropCache);
      meshCtx.restore();

      if (mesh.mask_ids?.length) {
        const masks = frame.meshes.filter(source => mesh.mask_ids.includes(source.id));
        if (masks.length) {
          maskUnionCtx.clearRect(0, 0, canvasWidth, canvasHeight);
          for (const source of masks) {
            let maskCanvas = maskCanvases.get(source.id);
            if (!maskCanvas) {
              maskCanvas = createCanvas(canvasWidth, canvasHeight);
              const maskCtx = maskCanvas.getContext('2d');
              const triangles = new Path2D();
              triangles.setFillType(FillType.Winding);
              appendMaskTriangles(triangles, source);
              const coverage = new Path2D().op(triangles, PathOp.Union);
              maskCtx.clip(coverage, 'evenodd');
              const maskTexture = source.texture_id === '__artpath_solid__'
                ? null
                : await resolveTexture(source.texture_id, textureResolver, textureHashes, imgCache);
              // Coverage follows the mask UVs and deformed surface; drawable
              // opacity does not suppress a referenced clipping mesh.
              maskCtx.globalCompositeOperation = 'copy';
              if (maskTexture) {
                await drawTexturedMesh(
                  maskCtx,
                  source,
                  maskTexture.image,
                  false,
                  maskTexture.hash,
                  cropCache
                );
              }
              else {
                maskCtx.fillStyle = '#ffffff';
                maskCtx.fillRect(0, 0, canvasWidth, canvasHeight);
              }
              maskCanvases.set(source.id, maskCanvas);
            }
            maskUnionCtx.drawImage(maskCanvas, 0, 0);
          }
          meshCtx.save();
          meshCtx.globalCompositeOperation = mesh.is_mask_inverted ? 'destination-out' : 'destination-in';
          meshCtx.drawImage(maskUnion, 0, 0);
          meshCtx.restore();
        }
      }

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

      ctx.drawImage(meshCanvas, 0, 0);
      ctx.restore();
    }

    return canvas.toBuffer('image/png');
  } finally {
    releaseCanvas(canvas);
    releaseCanvas(meshCanvas);
    releaseCanvas(maskUnion);
    for (const mask of maskCanvases.values()) releaseCanvas(mask);
    maskCanvases.clear();
    if (!sessionCache) {
      disposeRenderSessionCache({ textures: imgCache, textureHashes, crops: cropCache });
      clearAllCache();
    }
  }
}

function releaseCanvas(canvas: { width: number; height: number }): void {
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    // Keep rendering compatible with canvas implementations with read-only sizes.
  }
}

async function resolveTexture(
  textureId: string,
  textureResolver: TextureResolver,
  textureHashes: Map<string, string>,
  textures: Map<string, Image>
): Promise<{ image: Image; hash: string } | null> {
  let hash = textureHashes.get(textureId);
  if (!hash || !textures.has(hash)) {
    const bytes = textureResolver(textureId);
    if (!bytes) return null;
    hash = createHash('sha256').update(bytes).digest('hex');
    textureHashes.set(textureId, hash);
    if (!textures.has(hash)) {
      textures.set(hash, await loadImage(bytes));
    }
  }
  return { image: textures.get(hash)!, hash };
}

function traceMesh(ctx: SKRSContext2D, mesh: EvaluatedMeshJs) {
  ctx.beginPath();
  appendMeshBoundary(ctx, mesh);
}

function appendMeshBoundary(ctx: SKRSContext2D | Path2D, mesh: EvaluatedMeshJs) {
  const verts = mesh.vertices;
  for (const loop of getMeshBoundaryLoops(mesh.indices)) {
    ctx.moveTo(verts[loop[0] * 2], verts[loop[0] * 2 + 1]);
    for (const index of loop.slice(1)) ctx.lineTo(verts[index * 2], verts[index * 2 + 1]);
    ctx.closePath();
  }
}

function appendMaskTriangles(path: Path2D, mesh: EvaluatedMeshJs) {
  const vertices = mesh.vertices;
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const a = mesh.indices[offset] * 2;
    let b = mesh.indices[offset + 1] * 2, c = mesh.indices[offset + 2] * 2;
    const area = (vertices[b] - vertices[a]) * (vertices[c + 1] - vertices[a + 1])
      - (vertices[c] - vertices[a]) * (vertices[b + 1] - vertices[a + 1]);
    if (!(Math.abs(area) > 1e-8)) continue;
    if (area < 0) [b, c] = [c, b];
    // A pinched boundary can revisit a shared vertex. Normalized triangle
    // winding lets Skia union the actual coverage without losing an island.
    path.moveTo(vertices[a], vertices[a + 1]);
    path.lineTo(vertices[b], vertices[b + 1]);
    path.lineTo(vertices[c], vertices[c + 1]);
    path.closePath();
  }
}

function drawSolidMesh(ctx: SKRSContext2D, mesh: EvaluatedMeshJs) {
  const mc = mesh.multiply_color || [0.15, 0.15, 0.18, 1.0];
  ctx.fillStyle = `rgba(${Math.round(mc[0] * 255)}, ${Math.round(mc[1] * 255)}, ${Math.round(mc[2] * 255)}, ${mc[3] ?? 1})`;
  traceMesh(ctx, mesh);
  ctx.fill('evenodd');
}

async function drawTexturedMesh(
  ctx: SKRSContext2D,
  mesh: EvaluatedMeshJs,
  img: Image,
  applyColors: boolean,
  textureHash: string,
  cropCache: Map<string, Image>
) {
  const texW = img.width;
  const texH = img.height;
  const indices = mesh.indices;
  const verts = mesh.vertices; // [x0, y0, x1, y1...]
  const uvs = mesh.uvs;        // [u0, v0, u1, v1...]
  let minU = 1, minV = 1, maxU = 0, maxV = 0;
  for (let index = 0; index < uvs.length; index += 2) {
    minU = Math.min(minU, uvs[index]); maxU = Math.max(maxU, uvs[index]);
    minV = Math.min(minV, uvs[index + 1]); maxV = Math.max(maxV, uvs[index + 1]);
  }
  const minX = minU * texW, maxX = maxU * texW, minY = minV * texH, maxY = maxV * texH;
  // Keep an integer-bounded bitmap's original sampling origin when it is
  // minified (for example a tiny mouth). Fractional bounds need a filter guard.
  const padX = Math.abs(minX - Math.round(minX)) + Math.abs(maxX - Math.round(maxX)) < 1e-4 ? 0 : 1;
  const padY = Math.abs(minY - Math.round(minY)) + Math.abs(maxY - Math.round(maxY)) < 1e-4 ? 0 : 1;
  const left = Math.min(texW - 1, Math.max(0, Math.floor(minX) - padX));
  const top = Math.min(texH - 1, Math.max(0, Math.floor(minY) - padY));
  const right = Math.min(texW, Math.max(left + 1, Math.ceil(maxX) + padX));
  const bottom = Math.min(texH, Math.max(top + 1, Math.ceil(maxY) + padY));
  let texture: Canvas | Image = img;
  let originX = 0, originY = 0;
  let textureFromCache = false;
  if (maxU - minU < 1e-8 && maxV - minV < 1e-8 && (texW > 1 || texH > 1)) {
    const key = `${textureHash}:pixel:${minU * texW}:${minV * texH}`;
    const cached = cropCache.get(key);
    if (cached) {
      texture = cached;
      textureFromCache = true;
      originX = minU * texW - 0.5;
      originY = minV * texH - 0.5;
    } else {
      texture = createCanvas(1, 1);
      originX = minU * texW - 0.5; originY = minV * texH - 0.5;
      texture.getContext('2d').drawImage(img, originX, originY, 1, 1, 0, 0, 1, 1);
      const cachedImage = await loadImage(texture.toBuffer('image/png'));
      releaseCanvas(texture);
      texture = cachedImage;
      cropCache.set(key, cachedImage);
      textureFromCache = true;
    }
  } else if (left > 0 || top > 0 || right < texW || bottom < texH) {
    // Keep copy-compositing in local texture coordinates. Skia can clear
    // a clipped image when an atlas translation exceeds the output canvas.
    const key = `${textureHash}:${left},${top},${right},${bottom}`;
    const cached = cropCache.get(key);
    if (cached) {
      texture = cached;
      textureFromCache = true;
    } else {
      texture = createCanvas(Math.max(1, right - left), Math.max(1, bottom - top));
      texture.getContext('2d').drawImage(img, left, top, texture.width, texture.height, 0, 0, texture.width, texture.height);
      const croppedImage = await loadImage(texture.toBuffer('image/png'));
      releaseCanvas(texture);
      texture = croppedImage;
      cropCache.set(key, croppedImage);
      textureFromCache = true;
    }
    originX = left;
    originY = top;
  }

  try {
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

      const u0 = uvs[i0 * 2] * texW - originX;
      const v0 = uvs[i0 * 2 + 1] * texH - originY;
      const u1 = uvs[i1 * 2] * texW - originX;
      const v1 = uvs[i1 * 2 + 1] * texH - originY;
      const u2 = uvs[i2 * 2] * texW - originX;
      const v2 = uvs[i2 * 2 + 1] * texH - originY;

      drawTexturedTriangle(ctx, texture, mesh, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2);
    }
    if (applyColors) applyMeshColors(ctx, mesh);
  } finally {
    if (texture !== img && !textureFromCache) {
      if (texture instanceof Image) texture.src = '';
      else releaseCanvas(texture);
    }
  }
}

function drawTexturedTriangle(
  ctx: SKRSContext2D,
  img: Image | Canvas,
  mesh: EvaluatedMeshJs,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  u0: number, v0: number,
  u1: number, v1: number,
  u2: number, v2: number,
) {
  ctx.save();
  const triangle = new Path2D();
  triangle.moveTo(x0, y0);
  triangle.lineTo(x1, y1);
  triangle.lineTo(x2, y2);
  triangle.closePath();
  // Skia expands every edge by the same amount, including narrow triangles.
  // Rounded joins bound the expansion at acute corners; the mesh boundary
  // clip above retains the original silhouette.
  const border = new Path2D(triangle).stroke({ width: 3, join: StrokeJoin.Round });
  ctx.clip(triangle.op(border, PathOp.Union));

  // Solve affine transform matrix mapping (u, v) -> (x, y)
  // | x |   | a  c  e | | u |
  // | y | = | b  d  f | | v |
  // | 1 |   | 0  0  1 | | 1 |
  const delta = u0 * (v1 - v2) - v0 * (u1 - u2) + (u1 * v2 - u2 * v1);
  if (Math.abs(delta) < 1e-6) {
    // A geometric aperture often samples one white texel at every vertex.
    // The GPU accepts constant UVs even though there is no affine inverse.
    if (Math.abs(u0 - u1) + Math.abs(u0 - u2) + Math.abs(v0 - v1) + Math.abs(v0 - v2) < 1e-6) {
      ctx.drawImage(img, Math.max(0, Math.min(img.width - 1, u0 - 0.5)),
        Math.max(0, Math.min(img.height - 1, v0 - 0.5)), 1, 1, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }
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

function applyMeshColors(ctx: SKRSContext2D, mesh: EvaluatedMeshJs): void {
  const mc = mesh.multiply_color;
  const sc = mesh.screen_color;
  const applyMultiply = Boolean(mc && (mc[0] < 0.999 || mc[1] < 0.999 || mc[2] < 0.999));
  const applyScreen = Boolean(sc && (sc[0] > 0.001 || sc[1] > 0.001 || sc[2] > 0.001));
  if (!applyMultiply && !applyScreen) return;

  // Restore the original texture alpha after blend-mode fills. Canvas blend modes
  // can color transparent texels; source alpha must remain the final mask.
  const alphaMask = createCanvas(ctx.canvas.width, ctx.canvas.height);
  try {
    alphaMask.getContext('2d').drawImage(ctx.canvas, 0, 0);
    if (applyMultiply && mc) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(${Math.round(mc[0] * 255)}, ${Math.round(mc[1] * 255)}, ${Math.round(mc[2] * 255)}, ${mc[3]})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    if (applyScreen && sc) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(${Math.round(sc[0] * 255)}, ${Math.round(sc[1] * 255)}, ${Math.round(sc[2] * 255)}, ${sc[3]})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(alphaMask, 0, 0);
    ctx.restore();
  } finally {
    releaseCanvas(alphaMask);
  }
}
