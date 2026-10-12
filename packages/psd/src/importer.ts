import { readPsd, writePsdBuffer, initializeCanvas } from 'ag-psd';
import { clearAllCache, createCanvas, Image } from '@napi-rs/canvas';
import { evaluateProjectJs, type Project, type Node, type ArtMeshData, type TextureMeta } from '@l2d/schema';
import { generateGridMesh } from './mesh.js';

// Initialize ag-psd canvas factory using @napi-rs/canvas
initializeCanvas(createCanvas as any);

export interface ImportedPsdResult {
  project: Project;
  extractedTextures: { id: string; buffer: Buffer; filename: string }[];
}

export interface ImportPsdOptions {
  meshDensity?: number;
  existingProject?: Project;
}

export async function importPsdBuffer(
  psdBuffer: Buffer,
  options: ImportPsdOptions = {}
): Promise<ImportedPsdResult> {
  const density = options.meshDensity ?? 2;
  // The importer only needs individual layer pixels. Decoding the composite
  // image as well doubles the largest allocation for many PSDs.
  const psd = readPsd(psdBuffer, {
    skipThumbnail: true,
    skipCompositeImageData: true,
  });

  try {

  const canvasWidth = psd.width;
  const canvasHeight = psd.height;

  const existingProject = options.existingProject;
  const existingNodesMap = new Map<string, Node>();
  if (existingProject) {
    for (const node of existingProject.nodes) {
      existingNodesMap.set(node.id, node);
    }
  }

  const nodes: Node[] = [];
  const textures: TextureMeta[] = [];
  const extractedTextures: { id: string; buffer: Buffer; filename: string }[] = [];

  let drawOrder = 10;

  function processLayer(layer: any, parentId: string | null) {
    if (layer.hidden) {
      return;
    }

    const layerId = sanitizeId(layer.name || `layer_${nodes.length + 1}`);

    // If it's a layer group
    if (layer.children && layer.children.length > 0) {
      nodes.push({
        id: layerId,
        name: layer.name || layerId,
        parent_id: parentId,
        visible: true,
        locked: false,
        kind: { type: 'Part', collapsed: false },
      });
      // Process children in reverse so top layer renders on top
      for (const child of layer.children) {
        processLayer(child, layerId);
      }
      return;
    }

    // If it's a pixel layer with canvas or image data
    if (layer.canvas || (layer.width && layer.height)) {
      const lx = layer.left ?? 0;
      const ly = layer.top ?? 0;
      const lw = layer.width ?? layer.canvas?.width ?? 0;
      const lh = layer.height ?? layer.canvas?.height ?? 0;

      if (lw <= 0 || lh <= 0) return;

      const textureId = `tex_${layerId}`;
      const filename = `${layerId}.png`;

      // Extract texture buffer. Release the native canvas as soon as its PNG
      // bytes have been copied; keeping it on the ag-psd layer tree makes
      // repeated imports retain all layer-sized Skia surfaces until GC.
      let pngBuffer: Buffer;
      if (layer.canvas && typeof layer.canvas.toBuffer === 'function') {
        const sourceCanvas = layer.canvas;
        try {
          pngBuffer = sourceCanvas.toBuffer('image/png');
        } finally {
          releaseCanvas(sourceCanvas);
          delete layer.canvas;
        }
      } else {
        const tempCanvas = createCanvas(lw, lh);
        try {
          const ctx = tempCanvas.getContext('2d');
          if (layer.canvas) {
            ctx.drawImage(layer.canvas, 0, 0);
          }
          pngBuffer = tempCanvas.toBuffer('image/png');
        } finally {
          releaseCanvas(tempCanvas);
        }
      }

      textures.push({
        id: textureId,
        path: `textures/${filename}`,
        width: lw,
        height: lh,
      });

      extractedTextures.push({
        id: textureId,
        buffer: pngBuffer,
        filename,
      });

      // Check if existing node exists (for non-destructive reload!)
      const existing = existingNodesMap.get(layerId);
      let meshKind: ArtMeshData;

      if (existing && existing.kind.type === 'ArtMesh') {
        // Retain existing vertices and deformer bindings
        meshKind = {
          ...existing.kind,
          texture_id: textureId,
        };
      } else {
        // Generate mesh based on density
        const mesh = generateGridMesh(lx, ly, lw, lh, density);
        meshKind = {
          texture_id: textureId,
          vertices: mesh.vertices,
          uvs: mesh.uvs,
          indices: mesh.indices,
          blend_mode: 'normal',
          opacity: layer.opacity ?? 1.0,
          draw_order: drawOrder++,
          mask_ids: [],
        };
      }

      nodes.push({
        id: layerId,
        name: layer.name || layerId,
        parent_id: existing ? existing.parent_id : parentId,
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          ...meshKind,
        },
      });
    }
  }

  if (psd.children) {
    for (const child of psd.children) {
      processLayer(child, null);
    }
  }

  const project: Project = {
    format_version: 1,
    canvas: {
      width: canvasWidth,
      height: canvasHeight,
      origin_x: 0.5,
      origin_y: 0.5,
      background_color: '#18181b',
    },
    parameters: existingProject?.parameters ?? [
      { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 },
      { id: 'ParamAngleY', name: 'Angle Y', min: -30, max: 30, default: 0 },
      { id: 'ParamEyeLOpen', name: 'Eye Left Open', min: 0, max: 1, default: 1 },
      { id: 'ParamEyeROpen', name: 'Eye Right Open', min: 0, max: 1, default: 1 },
      { id: 'ParamMouthForm', name: 'Mouth Form', min: -1, max: 1, default: 0 },
      { id: 'ParamMouthOpen', name: 'Mouth Open', min: 0, max: 1, default: 0 },
    ],
    nodes,
    keyforms: existingProject?.keyforms ?? [],
    textures,
  };

    return { project, extractedTextures };
  } finally {
    releasePsdResources(psd);
    // @napi-rs/canvas keeps a process-wide Skia cache. Clear it after an
    // import so opening several large PSDs does not look like a leak.
    clearAllCache();
  }
}

function releaseCanvas(canvas: any): void {
  if (!canvas) return;
  try {
    // @napi-rs/canvas frees the backing surface when dimensions are reset.
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    // Some browser-compatible canvas implementations expose read-only sizes.
  }
}

function releasePsdResources(psd: any): void {
  const releaseLayer = (layer: any): void => {
    releaseCanvas(layer.canvas);
    delete layer.canvas;
    releaseCanvas(layer.thumbnail);
    delete layer.thumbnail;

    for (const mask of [layer.mask, layer.realMask]) {
      if (!mask) continue;
      releaseCanvas(mask.canvas);
      delete mask.canvas;
    }

    for (const child of layer.children ?? []) {
      releaseLayer(child);
    }
  };

  releaseCanvas(psd.canvas);
  delete psd.canvas;
  releaseCanvas(psd.thumbnail);
  delete psd.thumbnail;
  for (const child of psd.children ?? []) {
    releaseLayer(child);
  }
}

function sanitizeId(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '');
}

/**
 * Exports an L2DEditor `Project` (evaluated at optional `params`) into a layered `.psd` Buffer (`CMD_EXPORT_MODEL_AS_PSD`).
 */
export function exportModelToPsdBuffer(
  project: Project,
  textureResolver: (textureId: string) => Buffer | null,
  params: Record<string, number> = {}
): Buffer {
  const frame = evaluateProjectJs(project, params);
  const tempCanvases: any[] = [];

  try {
    const children: any[] = [];

    for (const mesh of frame.meshes) {
      if (mesh.opacity <= 0.001 || mesh.vertices.length < 6) continue;
      const node = project.nodes.find((n) => n.id === mesh.id);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 2) {
        const vx = mesh.vertices[i];
        const vy = mesh.vertices[i + 1];
        if (vx < minX) minX = vx;
        if (vx > maxX) maxX = vx;
        if (vy < minY) minY = vy;
        if (vy > maxY) maxY = vy;
      }

      const left = Math.max(0, Math.floor(minX));
      const top = Math.max(0, Math.floor(minY));
      const right = Math.min(project.canvas.width, Math.ceil(maxX));
      const bottom = Math.min(project.canvas.height, Math.ceil(maxY));
      const lw = Math.max(1, right - left);
      const lh = Math.max(1, bottom - top);

      const layerCanvas = createCanvas(lw, lh);
      tempCanvases.push(layerCanvas);
      const ctx = layerCanvas.getContext('2d');
      ctx.translate(-left, -top);

      if (mesh.texture_id === '__artpath_solid__') {
        const mc = mesh.multiply_color || [0.15, 0.15, 0.18, 1];
        ctx.fillStyle = `rgba(${Math.round(mc[0] * 255)}, ${Math.round(mc[1] * 255)}, ${Math.round(mc[2] * 255)}, ${mc[3] ?? 1})`;
        for (let i = 0; i < mesh.indices.length; i += 3) {
          const i0 = mesh.indices[i] * 2;
          const i1 = mesh.indices[i + 1] * 2;
          const i2 = mesh.indices[i + 2] * 2;
          ctx.beginPath();
          ctx.moveTo(mesh.vertices[i0], mesh.vertices[i0 + 1]);
          ctx.lineTo(mesh.vertices[i1], mesh.vertices[i1 + 1]);
          ctx.lineTo(mesh.vertices[i2], mesh.vertices[i2 + 1]);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        const buf = textureResolver(mesh.texture_id);
        if (buf) {
          const img = new Image();
          img.src = buf;
          const texW = img.width;
          const texH = img.height;
          for (let i = 0; i < mesh.indices.length; i += 3) {
            const i0 = mesh.indices[i];
            const i1 = mesh.indices[i + 1];
            const i2 = mesh.indices[i + 2];
            const x0 = mesh.vertices[i0 * 2], y0 = mesh.vertices[i0 * 2 + 1];
            const x1 = mesh.vertices[i1 * 2], y1 = mesh.vertices[i1 * 2 + 1];
            const x2 = mesh.vertices[i2 * 2], y2 = mesh.vertices[i2 * 2 + 1];
            const u0 = mesh.uvs[i0 * 2] * texW, v0 = mesh.uvs[i0 * 2 + 1] * texH;
            const u1 = mesh.uvs[i1 * 2] * texW, v1 = mesh.uvs[i1 * 2 + 1] * texH;
            const u2 = mesh.uvs[i2 * 2] * texW, v2 = mesh.uvs[i2 * 2 + 1] * texH;
            const delta = u0 * (v1 - v2) - v0 * (u1 - u2) + (u1 * v2 - u2 * v1);
            if (Math.abs(delta) > 1e-6) {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(x0, y0);
              ctx.lineTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.closePath();
              ctx.clip();
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
          }
          img.src = '';
        }
      }

      children.push({
        name: node?.name || mesh.id,
        left,
        top,
        opacity: mesh.opacity,
        blendMode: mesh.blend_mode === 'multiply' ? 'multiply' : mesh.blend_mode === 'screen' ? 'screen' : 'normal',
        canvas: layerCanvas as any,
      });
    }

    const psd = {
      width: project.canvas.width,
      height: project.canvas.height,
      children,
    };

    return Buffer.from(writePsdBuffer(psd as any));
  } finally {
    for (const c of tempCanvases) {
      releaseCanvas(c);
    }
    clearAllCache();
  }
}
