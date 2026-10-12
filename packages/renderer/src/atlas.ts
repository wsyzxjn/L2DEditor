import { createCanvas, Image } from '@napi-rs/canvas';
import type { Project, ArtMeshData } from '@l2d/schema';
import type { TextureResolver } from './headless.js';

interface RectToPack {
  meshId: string;
  textureId: string;
  width: number;
  height: number;
  img: Image;
}

interface PackedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rect: RectToPack;
}

export interface AtlasPackResult {
  updatedProject: Project;
  atlasPngBuffers: { id: string; filename: string; buffer: Buffer }[];
}

/**
 * Packs all individual ArtMesh textures into a single texture atlas
 * and remaps mesh UVs accordingly.
 */
export function generateTextureAtlas(
  project: Project,
  textureResolver: TextureResolver,
  atlasSize: number = 2048,
  padding: number = 4
): AtlasPackResult {
  const rects: RectToPack[] = [];
  const imageCache = new Map<string, Image>();

  // Collect all unique textures used by visible ArtMeshes
  for (const node of project.nodes) {
    if (node.kind.type === 'ArtMesh') {
      const artMesh = node.kind;
      const texMeta = project.textures.find((t) => t.id === artMesh.texture_id);
      if (!texMeta) continue;

      let img = imageCache.get(texMeta.id);
      if (!img) {
        const buf = textureResolver(texMeta.id);
        if (buf) {
          img = new Image();
          img.src = buf;
          imageCache.set(texMeta.id, img);
        }
      }

      if (img) {
        rects.push({
          meshId: node.id,
          textureId: texMeta.id,
          width: img.width,
          height: img.height,
          img,
        });
      }
    }
  }

  // Sort descending by height for simple Shelf/Skyline bin packing
  rects.sort((a, b) => b.height - a.height);

  const packed: PackedRect[] = [];
  let curX = padding;
  let curY = padding;
  let shelfHeight = 0;

  for (const r of rects) {
    if (curX + r.width + padding > atlasSize) {
      // Move to next shelf
      curX = padding;
      curY += shelfHeight + padding;
      shelfHeight = 0;
    }

    if (curY + r.height + padding > atlasSize) {
      // Atlas overflow (in production multiple pages can be used; clamp or expand)
      break;
    }

    packed.push({
      x: curX,
      y: curY,
      w: r.width,
      h: r.height,
      rect: r,
    });

    curX += r.width + padding;
    shelfHeight = Math.max(shelfHeight, r.height);
  }

  // Draw atlas canvas
  const canvas = createCanvas(atlasSize, atlasSize);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, atlasSize, atlasSize);

  const atlasId = 'tex_atlas_00';
  const atlasFilename = 'texture_00.png';

  // Map from meshId -> packed placement
  const placementMap = new Map<string, PackedRect>();

  for (const p of packed) {
    ctx.drawImage(p.rect.img, p.x, p.y);
    placementMap.set(p.rect.meshId, p);
  }

  const atlasBuffer = canvas.toBuffer('image/png');

  // Deep clone project and remap UVs
  const nextProject: Project = JSON.parse(JSON.stringify(project));
  nextProject.textures = [
    {
      id: atlasId,
      path: `textures/${atlasFilename}`,
      width: atlasSize,
      height: atlasSize,
    },
  ];

  for (const node of nextProject.nodes) {
    if (node.kind.type === 'ArtMesh') {
      const artMesh = node.kind;
      const placement = placementMap.get(node.id);
      if (placement) {
        artMesh.texture_id = atlasId;
        const origW = placement.w;
        const origH = placement.h;
        const atX = placement.x;
        const atY = placement.y;

        // Remap UV coordinates: [u, v] -> [ (atX + u * origW) / atlasSize, (atY + v * origH) / atlasSize ]
        for (let i = 0; i < artMesh.uvs.length; i++) {
          const [u, v] = artMesh.uvs[i];
          artMesh.uvs[i] = [
            (atX + u * origW) / atlasSize,
            (atY + v * origH) / atlasSize,
          ];
        }
      }
    }
  }

  return {
    updatedProject: nextProject,
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
export function unpackAtlasTextures(
  project: Project,
  atlasBuffer: Buffer
): { textureId: string; filename: string; buffer: Buffer }[] {
  const atlasImg = new Image();
  atlasImg.src = atlasBuffer;
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
