import { readPsd, writePsdBuffer, initializeCanvas, type Layer } from 'ag-psd';
import { clearAllCache, createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import type { Project, Node, ArtMeshData, TextureMeta, EvaluatedFrameJs } from '@l2d/schema';
import { createRequire } from 'node:module';
import { renderFrameToCanvas } from '@l2d/renderer/headless';
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
      for (const child of [...layer.children].reverse()) {
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
    for (const child of [...psd.children].reverse()) {
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
export async function exportModelToPsdBuffer(
  project: Project,
  textureResolver: (textureId: string) => Buffer | null,
  params: Record<string, number> = {}
): Promise<Buffer> {
  const wasm = createRequire(import.meta.url)('@l2d/schema/wasm-node') as typeof import('@l2d/schema/wasm-node');
  const model = new wasm.WasmModel(JSON.stringify(project));
  const tempCanvases: Canvas[] = [];
  try {
    for (const [id, value] of Object.entries(params)) model.setParameter(id, value);
    const frame: EvaluatedFrameJs = model.evaluate();
    const children: Layer[] = [];
    for (const mesh of frame.meshes) {
      if (mesh.opacity <= 0.001 || mesh.vertices.length < 6) continue;
      const node = project.nodes.find(node => node.id === mesh.id);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let index = 0; index < mesh.vertices.length; index += 2) {
        minX = Math.min(minX, mesh.vertices[index]);
        maxX = Math.max(maxX, mesh.vertices[index]);
        minY = Math.min(minY, mesh.vertices[index + 1]);
        maxY = Math.max(maxY, mesh.vertices[index + 1]);
      }
      const left = Math.max(0, Math.floor(minX)), top = Math.max(0, Math.floor(minY));
      const right = Math.min(project.canvas.width, Math.ceil(maxX)), bottom = Math.min(project.canvas.height, Math.ceil(maxY));
      if (right <= left || bottom <= top) continue;
      // Reuse the PNG renderer, including clipping and seam handling. The
      // drawable opacity is kept on the PSD layer, rather than baked twice.
      const sources = frame.meshes.filter(source => mesh.mask_ids.includes(source.id));
      const isolated = [...sources.map(source => ({ ...source, opacity: 0 })), { ...mesh, opacity: 1, blend_mode: 'normal' as const }];
      const localFrame = { ...frame, meshes: isolated.map(source => ({
        ...source, vertices: source.vertices.map((coordinate, index) => coordinate - (index % 2 === 0 ? left : top)),
      })) };
      const png = await renderFrameToCanvas(right - left, bottom - top, localFrame, textureResolver, 'rgba(0,0,0,0)');
      const layerCanvas = createCanvas(right - left, bottom - top);
      tempCanvases.push(layerCanvas);
      const image = await loadImage(png);
      layerCanvas.getContext('2d').drawImage(image, 0, 0);
      image.src = '';
      children.push({
        name: node?.name || mesh.id, left, top, opacity: mesh.opacity,
        blendMode: mesh.blend_mode === 'multiply' ? 'multiply' : mesh.blend_mode === 'screen' ? 'screen' : mesh.blend_mode === 'additive' ? 'linear dodge' : 'normal',
        imageData: layerCanvas.getContext('2d').getImageData(0, 0, layerCanvas.width, layerCanvas.height),
      });
    }
    const composite = createCanvas(project.canvas.width, project.canvas.height);
    tempCanvases.push(composite);
    const compositeImage = await loadImage(await renderFrameToCanvas(project.canvas.width, project.canvas.height, frame, textureResolver, 'rgba(0,0,0,0)'));
    composite.getContext('2d').drawImage(compositeImage, 0, 0);
    compositeImage.src = '';
    return Buffer.from(writePsdBuffer({
      width: project.canvas.width, height: project.canvas.height,
      // ag-psd stores the topmost layer first; evaluated draw order is ascending.
      children: children.reverse(), imageData: composite.getContext('2d').getImageData(0, 0, composite.width, composite.height),
    }));
  } finally {
    model.free();
    for (const canvas of tempCanvases) releaseCanvas(canvas);
    clearAllCache();
  }
}
