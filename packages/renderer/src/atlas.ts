import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { Project } from '@l2d/schema';
import type { TextureResolver } from './headless.js';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const wasmNode = req('@l2d/schema/wasm-node');

export interface AtlasPackResult {
  updatedProject: Project;
  atlasPngBuffers: { id: string; filename: string; buffer: Buffer }[];
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
  const bundle = wasmNode.exportRuntimeBundle(
    JSON.stringify(project),
    'model',
    atlasSize,
    padding
  ) as {
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

  const canvas = createCanvas(atlasSize, atlasSize);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, atlasSize, atlasSize);

  const atlasId = 'tex_atlas_00';
  const atlasFilename = 'texture_00.png';

  const drawnTextures = new Set<string>();
  for (const p of bundle.atlas_placements) {
    if (drawnTextures.has(p.texture_id)) continue;
    const buf = textureResolver(p.texture_id);
    if (buf) {
      const img = await loadImage(buf);
      ctx.drawImage(img, p.x, p.y, p.width, p.height);
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
