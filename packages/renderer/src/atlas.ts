import { createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import type { Project } from '@l2d/schema';
import type { TextureResolver } from './headless.js';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const wasmNode = req('@l2d/schema/wasm-node');

export interface AtlasPackResult {
  updatedProject: Project;
  atlasPngBuffers: { id: string; filename: string; buffer: Buffer }[];
}

function drawTextureWithBleed(
  ctx: SKRSContext2D,
  image: Image,
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number
): void {
  ctx.drawImage(image, x, y, width, height);
  if (padding <= 0) return;

  // Runtime texture sampling is clamp-to-edge. Extending the edge pixels into the atlas
  // gutter keeps bilinear filtering identical to rendering the original texture directly.
  ctx.drawImage(image, 0, 0, 1, height, x - padding, y, padding, height);
  ctx.drawImage(image, width - 1, 0, 1, height, x + width, y, padding, height);
  ctx.drawImage(image, 0, 0, width, 1, x, y - padding, width, padding);
  ctx.drawImage(image, 0, height - 1, width, 1, x, y + height, width, padding);
  ctx.drawImage(image, 0, 0, 1, 1, x - padding, y - padding, padding, padding);
  ctx.drawImage(image, width - 1, 0, 1, 1, x + width, y - padding, padding, padding);
  ctx.drawImage(image, 0, height - 1, 1, 1, x - padding, y + height, padding, padding);
  ctx.drawImage(
    image,
    width - 1,
    height - 1,
    1,
    1,
    x + width,
    y + height,
    padding,
    padding
  );
}

/**
 * Packs all individual ArtMesh textures into a single texture atlas
 * using the pure-Rust 2D Shelf bin-packing & UV remapper (`crates/l2d-core/src/exporter.rs`).
 */
export async function generateTextureAtlas(
  project: Project,
  textureResolver: TextureResolver,
  atlasSize: number = 2048,
  padding: number = 4
): Promise<AtlasPackResult> {
  if (!Number.isInteger(atlasSize) || atlasSize < 64 || atlasSize > 16384 || (atlasSize & (atlasSize - 1)) !== 0) {
    throw new Error(`Atlas size must be a power of two between 64 and 16384, got ${atlasSize}`);
  }
  if (!Number.isInteger(padding) || padding < 0 || padding >= atlasSize / 2) {
    throw new Error(`Atlas padding must be an integer below ${atlasSize / 2}, got ${padding}`);
  }
  const bundle = wasmNode.exportRuntimeBundleWithOptions(
    JSON.stringify(project),
    'model',
    atlasSize,
    padding,
    false
  ) as {
    atlas_size: number;
    updated_project: Project;
    atlas_placements: {
      mesh_id: string;
      texture_id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  };

  const actualAtlasSize = bundle.atlas_size;
  const canvas = createCanvas(actualAtlasSize, actualAtlasSize);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, actualAtlasSize, actualAtlasSize);

  const atlasId = 'tex_atlas_00';
  const atlasFilename = 'texture_00.png';

  const drawnTextures = new Set<string>();
  for (const p of bundle.atlas_placements) {
    if (drawnTextures.has(p.texture_id)) continue;
    const buf = textureResolver(p.texture_id);
    if (buf) {
      const img = await loadImage(buf);
      drawTextureWithBleed(ctx, img, p.x, p.y, p.width, p.height, padding);
      img.src = '';
    }
    drawnTextures.add(p.texture_id);
  }

  const atlasBuffer = canvas.toBuffer('image/png');

  return {
    updatedProject: bundle.updated_project,
    atlasPngBuffers: [
      {
        id: atlasId,
        filename: atlasFilename,
        buffer: atlasBuffer,
      },
    ],
  };
}

/**
 * Reconstructs individual cropped ArtMesh texture PNGs from a packed atlas image
 * and mesh UV coordinates (`CMD_GENERATE_RAW_IMAGE_FROM_TEXTURE_ATLAS`).
 */
export async function unpackAtlasTextures(
  project: Project,
  atlasBuffer: Buffer
): Promise<{ textureId: string; filename: string; buffer: Buffer }[]> {
  const atlasImg = await loadImage(atlasBuffer);
  const atlasW = atlasImg.width;
  const atlasH = atlasImg.height;
  const results: { textureId: string; filename: string; buffer: Buffer }[] = [];

  for (const node of project.nodes) {
    if (node.kind.type !== 'ArtMesh' || node.kind.uvs.length === 0) continue;
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (const [u, v] of node.kind.uvs) {
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const sx = Math.max(0, Math.floor(minU * atlasW));
    const sy = Math.max(0, Math.floor(minV * atlasH));
    const sw = Math.max(1, Math.ceil((maxU - minU) * atlasW));
    const sh = Math.max(1, Math.ceil((maxV - minV) * atlasH));

    const canvas = createCanvas(sw, sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(atlasImg, sx, sy, sw, sh, 0, 0, sw, sh);

    results.push({
      textureId: `tex_unpacked_${node.id}`,
      filename: `${node.id}_unpacked.png`,
      buffer: canvas.toBuffer('image/png'),
    });
  }
  return results;
}
