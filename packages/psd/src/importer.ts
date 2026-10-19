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
  report: {
    addedLayers: string[];
    updatedLayers: string[];
    removedLayers: string[];
    preservedNonArtNodes: number;
  };
}

export interface ImportPsdOptions {
  meshDensity?: number;
  existingProject?: Project;
  maxBufferBytes?: number;
  maxLayers?: number;
}

export async function importPsdBuffer(
  psdBuffer: Buffer,
  options: ImportPsdOptions = {}
): Promise<ImportedPsdResult> {
  const density = options.meshDensity ?? 2;
  const maxBufferBytes = options.maxBufferBytes ?? 512 * 1024 * 1024;
  const maxLayers = options.maxLayers ?? 2000;
  if (psdBuffer.length > maxBufferBytes) {
    throw new Error(`PSD exceeds the ${maxBufferBytes} byte import limit`);
  }
  // The importer only needs individual layer pixels. Decoding the composite
  // image as well doubles the largest allocation for many PSDs.
  const psd = readPsd(psdBuffer, {
    skipThumbnail: true,
    skipCompositeImageData: true,
  });

  try {

  const canvasWidth = psd.width;
  const canvasHeight = psd.height;
  const existingProject = options.existingProject
    ? structuredClone(options.existingProject)
    : undefined;
  const nodes: Node[] = existingProject?.nodes ?? [];
  const usedNodeIds = new Set(nodes.map((node) => node.id));
  const texturesById = new Map<string, TextureMeta>(
    (existingProject?.textures ?? []).map((texture) => [texture.id, structuredClone(texture)])
  );
  const extractedTextures: { id: string; buffer: Buffer; filename: string }[] = [];
  const addedLayers: string[] = [];
  const updatedLayers: string[] = [];
  const matchedNodeIds = new Set<string>();
  const usedTextureFilenames = new Set<string>();
  const artByName = new Map<string, Node[]>();
  const partByName = new Map<string, Node[]>();
  for (const node of nodes) {
    const target = node.kind.type === 'ArtMesh'
      ? artByName
      : node.kind.type === 'Part'
        ? partByName
        : null;
    if (!target) continue;
    const list = target.get(node.name) ?? [];
    list.push(node);
    target.set(node.name, list);
  }
  const nextExistingByName = (map: Map<string, Node[]>, name: string): Node | undefined => {
    const candidates = map.get(name);
    while (candidates?.length) {
      const candidate = candidates.shift()!;
      if (!matchedNodeIds.has(candidate.id)) return candidate;
    }
    return undefined;
  };
  const uniqueNodeId = (base: string): string => {
    let candidate = base || 'layer';
    let suffix = 2;
    while (usedNodeIds.has(candidate)) {
      candidate = `${base || 'layer'}_${suffix++}`;
    }
    usedNodeIds.add(candidate);
    return candidate;
  };
  const uniqueTextureId = (base: string): string => {
    let candidate = base;
    let suffix = 2;
    while (texturesById.has(candidate)) {
      candidate = `${base}_${suffix++}`;
    }
    return candidate;
  };
  let layerCount = 0;

  let drawOrder = 10;

  function processLayer(layer: any, parentId: string | null, layerPath: string) {
    layerCount += 1;
    if (layerCount > maxLayers) {
      throw new Error(`PSD contains more than ${maxLayers} layers`);
    }
    const layerName = String(layer.name || `layer_${layerCount}`);
    const stablePath = `${layerPath}/${layerName}`;

    // If it's a layer group
    if (layer.children && layer.children.length > 0) {
      const existing = nextExistingByName(partByName, layerName);
      const layerId = existing?.id ?? uniqueNodeId(sanitizeId(layerName));
      if (existing) {
        matchedNodeIds.add(existing.id);
      } else {
        nodes.push({
          id: layerId,
          name: layerName,
          parent_id: parentId,
          visible: !layer.hidden,
          locked: false,
          kind: { type: 'Part', collapsed: false, opacity: layer.opacity ?? 1 },
        });
      }
      // Process children in reverse so top layer renders on top
      for (const child of [...layer.children].reverse()) {
        processLayer(child, layerId, stablePath);
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

      const existing = nextExistingByName(artByName, layerName);
      const layerId = existing?.id ?? uniqueNodeId(sanitizeId(layerName));
      const textureId = existing?.kind.type === 'ArtMesh'
        ? existing.kind.texture_id
        : uniqueTextureId(`tex_${layerId}`);
      let filename = `${layerId}.png`;
      let filenameSuffix = 2;
      while (usedTextureFilenames.has(filename)) {
        filename = `${layerId}_${filenameSuffix++}.png`;
      }
      usedTextureFilenames.add(filename);
      if (existing) matchedNodeIds.add(existing.id);

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

      const textureMeta: TextureMeta = {
        id: textureId,
        path: `textures/${filename}`,
        width: lw,
        height: lh,
      };
      texturesById.set(textureId, textureMeta);

      extractedTextures.push({
        id: textureId,
        buffer: pngBuffer,
        filename,
      });

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

      const nextNode: Node = {
        id: layerId,
        name: layerName,
        parent_id: existing ? existing.parent_id : parentId,
        visible: !layer.hidden,
        locked: existing?.locked ?? false,
        kind: {
          type: 'ArtMesh',
          ...meshKind,
        },
      } as Node;
      if (existing) {
        const index = nodes.findIndex((node) => node.id === existing.id);
        if (index >= 0) nodes[index] = nextNode;
        updatedLayers.push(layerId);
      } else {
        nodes.push(nextNode);
        addedLayers.push(layerId);
      }
    }
  }

  if (psd.children) {
    for (const child of [...psd.children].reverse()) {
      processLayer(child, null, '');
    }
  }

  const removedLayers = existingProject
    ? existingProject.nodes
      .filter((node) => node.kind.type === 'ArtMesh' && !matchedNodeIds.has(node.id))
      .map((node) => node.id)
    : [];
  const project: Project = existingProject
    ? {
        ...existingProject,
        canvas: {
          ...existingProject.canvas,
          width: canvasWidth,
          height: canvasHeight,
        },
        nodes,
        textures: [...texturesById.values()],
      }
    : {
        format_version: 1,
        canvas: {
          width: canvasWidth,
          height: canvasHeight,
          origin_x: 0.5,
          origin_y: 0.5,
          background_color: '#18181b',
        },
        parameters: [
          { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 },
          { id: 'ParamAngleY', name: 'Angle Y', min: -30, max: 30, default: 0 },
          { id: 'ParamEyeLOpen', name: 'Eye Left Open', min: 0, max: 1, default: 1 },
          { id: 'ParamEyeROpen', name: 'Eye Right Open', min: 0, max: 1, default: 1 },
          { id: 'ParamMouthForm', name: 'Mouth Form', min: -1, max: 1, default: 0 },
          { id: 'ParamMouthOpen', name: 'Mouth Open', min: 0, max: 1, default: 0 },
        ],
        nodes,
        keyforms: [],
        textures: [...texturesById.values()],
        glues: [],
        physics: [],
        animations: [],
        parameter_groups: [],
        pose_groups: [],
        expressions: [],
      };

    return {
      project,
      extractedTextures,
      report: {
        addedLayers,
        updatedLayers,
        removedLayers,
        preservedNonArtNodes: nodes.length - nodes.filter((node) => node.kind.type === 'ArtMesh').length,
      },
    };
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
  const normalized = name
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'layer';
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
