import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { evaluateProjectJs, type Project } from '../packages/schema/dist/index.js';
import { WasmModel } from '../packages/schema/wasm-node/l2d_wasm.js';
import { renderFrameToCanvas } from '../packages/renderer/dist/headless.js';

const require = createRequire(new URL('../packages/renderer/package.json', import.meta.url));
const { createCanvas, loadImage } = require('@napi-rs/canvas');

function fixture(): Project {
  return {
    format_version: 1,
    canvas: { width: 64, height: 64, origin_x: 0.5, origin_y: 0.5, background_color: '#ffffff' },
    parameters: [], keyforms: [],
    textures: [{ id: 'solid', path: 'solid.png', width: 1, height: 1 }],
    nodes: [
      {
        id: 'aperture', name: 'Transparent eye aperture', parent_id: null, visible: true, locked: false,
        kind: {
          type: 'ArtMesh', texture_id: 'solid',
          vertices: [[16, 16], [40, 16], [16, 40], [40, 40]],
          uvs: [[0, 0], [1, 0], [0, 1], [1, 1]], indices: [0, 1, 2, 1, 3, 2],
          blend_mode: 'normal', opacity: 0, draw_order: 0, mask_ids: [],
        },
      },
      {
        id: 'iris', name: 'Clipped iris', parent_id: null, visible: true, locked: false,
        kind: {
          type: 'ArtMesh', texture_id: 'solid',
          vertices: [[0, 0], [64, 0], [0, 64], [64, 64]],
          uvs: [[0, 0], [1, 0], [0, 1], [1, 1]], indices: [0, 1, 2, 1, 3, 2],
          blend_mode: 'normal', opacity: 1, draw_order: 1, mask_ids: ['aperture'],
        },
      },
    ],
  };
}

describe('Transparent clipping geometry', () => {
  it('samples a constant atlas UV without stretching neighboring transparent texels', async () => {
    const project = fixture();
    project.textures.push({ id: 'atlas', path: 'atlas.png', width: 64, height: 64 });
    if (project.nodes[0].kind.type === 'ArtMesh') {
      project.nodes[0].kind.texture_id = 'atlas';
      project.nodes[0].kind.uvs = project.nodes[0].kind.vertices.map(() => [40.5 / 64, 40.5 / 64]);
    }
    const atlas = createCanvas(64, 64), solid = createCanvas(1, 1);
    atlas.getContext('2d').fillStyle = 'rgba(0,0,0,0.5)'; atlas.getContext('2d').fillRect(40, 40, 1, 1);
    solid.getContext('2d').fillStyle = '#2456dc'; solid.getContext('2d').fillRect(0, 0, 1, 1);
    const model = new WasmModel(JSON.stringify(project));
    try {
      const png = await renderFrameToCanvas(64, 64, model.evaluate(), id => (id === 'atlas' ? atlas : solid).toBuffer('image/png'), 'transparent');
      const canvas = createCanvas(64, 64), context = canvas.getContext('2d');
      context.drawImage(await loadImage(png), 0, 0);
      for (const [x, y] of [[18, 18], [24, 24], [37, 37]]) expect(Math.abs(context.getImageData(x, y, 1, 1).data[3] - 128)).toBeLessThanOrEqual(1);
    } finally { model.free(); atlas.width = 0; solid.width = 0; }
  });

  it('clips to texture alpha, retaining an internal transparent hole for both directions', async () => {
    const project = fixture();
    project.textures.push({ id: 'coverage', path: 'coverage.png', width: 24, height: 24 });
    if (project.nodes[0].kind.type === 'ArtMesh') project.nodes[0].kind.texture_id = 'coverage';
    const coverage = createCanvas(24, 24), color = createCanvas(1, 1);
    coverage.getContext('2d').fillStyle = '#000000';
    coverage.getContext('2d').fillRect(0, 0, 24, 24);
    coverage.getContext('2d').clearRect(8, 8, 8, 8);
    color.getContext('2d').fillStyle = '#2456dc';
    color.getContext('2d').fillRect(0, 0, 1, 1);
    try {
      for (const inverted of [false, true]) {
        if (project.nodes[1].kind.type === 'ArtMesh') project.nodes[1].kind.is_mask_inverted = inverted;
        const model = new WasmModel(JSON.stringify(project));
        try {
          const png = await renderFrameToCanvas(64, 64, model.evaluate(), id =>
            (id === 'coverage' ? coverage : color).toBuffer('image/png'), '#ffffff');
          const canvas = createCanvas(64, 64), context = canvas.getContext('2d');
          context.drawImage(await loadImage(png), 0, 0);
          expect([...context.getImageData(20, 20, 1, 1).data]).toEqual(inverted ? [255, 255, 255, 255] : [36, 86, 220, 255]);
          expect([...context.getImageData(28, 28, 1, 1).data]).toEqual(inverted ? [36, 86, 220, 255] : [255, 255, 255, 255]);
          canvas.width = 0; canvas.height = 0;
        } finally { model.free(); }
      }
    } finally { coverage.width = 0; color.width = 0; }
  });

  it('unions overlapping alpha masks and ignores their drawable opacity', async () => {
    const project = fixture();
    project.textures.push({ id: 'coverage', path: 'coverage.png', width: 1, height: 1 });
    if (project.nodes[0].kind.type === 'ArtMesh') project.nodes[0].kind.texture_id = 'coverage';
    const second = structuredClone(project.nodes[0]);
    second.id = 'second';
    if (second.kind.type === 'ArtMesh') second.kind.vertices = [[28, 16], [52, 16], [28, 40], [52, 40]];
    project.nodes.push(second);
    if (project.nodes[1].kind.type === 'ArtMesh') project.nodes[1].kind.mask_ids = ['aperture', 'second'];
    const coverage = createCanvas(1, 1), color = createCanvas(1, 1);
    coverage.getContext('2d').fillStyle = 'rgba(0, 0, 0, 0.5)';
    coverage.getContext('2d').fillRect(0, 0, 1, 1);
    color.getContext('2d').fillStyle = '#2456dc';
    color.getContext('2d').fillRect(0, 0, 1, 1);
    try {
      for (const inverted of [false, true]) {
        if (project.nodes[1].kind.type === 'ArtMesh') project.nodes[1].kind.is_mask_inverted = inverted;
        const model = new WasmModel(JSON.stringify(project));
        try {
          const png = await renderFrameToCanvas(64, 64, model.evaluate(), id =>
            (id === 'coverage' ? coverage : color).toBuffer('image/png'), 'transparent');
          const canvas = createCanvas(64, 64), context = canvas.getContext('2d');
          context.drawImage(await loadImage(png), 0, 0);
          for (const [x, expected] of [[24, 128], [34, inverted ? 63 : 192], [8, inverted ? 255 : 0]]) {
            expect(Math.abs(context.getImageData(x, 24, 1, 1).data[3] - expected)).toBeLessThanOrEqual(2);
          }
          canvas.width = 0; canvas.height = 0;
        } finally { model.free(); }
      }
    } finally { coverage.width = 0; color.width = 0; }
  });

  it('retains zero-opacity masks in Rust/Wasm and JS without drawing them', async () => {
    const project = fixture();
    const model = new WasmModel(JSON.stringify(project));
    try {
      const frames = [evaluateProjectJs(project, {}), model.evaluate()];
      const texture = createCanvas(1, 1);
      texture.getContext('2d').fillStyle = '#2456dc';
      texture.getContext('2d').fillRect(0, 0, 1, 1);
      const bytes = texture.toBuffer('image/png');
      for (const frame of frames) {
        expect(frame.meshes.map(mesh => mesh.id)).toEqual(['aperture', 'iris']);
        expect(frame.meshes[0].opacity).toBe(0);
        const png = await renderFrameToCanvas(64, 64, frame, () => bytes, '#ffffff');
        const image = await loadImage(png);
        const canvas = createCanvas(64, 64);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        expect([...context.getImageData(24, 24, 1, 1).data]).toEqual([36, 86, 220, 255]);
        expect([...context.getImageData(8, 24, 1, 1).data]).toEqual([255, 255, 255, 255]);
        canvas.width = 0;
        canvas.height = 0;
      }
      texture.width = 0;
      texture.height = 0;
    } finally { model.free(); }
  });

  it('still excludes invisible mask objects and unreferenced transparent drawables', () => {
    const project = fixture();
    project.nodes[0].visible = false;
    expect(evaluateProjectJs(project, {}).meshes.map(mesh => mesh.id)).toEqual(['iris']);
    const hiddenModel = new WasmModel(JSON.stringify(project));
    try { expect(hiddenModel.evaluate().meshes.map(mesh => mesh.id)).toEqual(['iris']); }
    finally { hiddenModel.free(); }
    project.nodes[0].visible = true;
    if (project.nodes[1].kind.type === 'ArtMesh') project.nodes[1].kind.mask_ids = [];
    const model = new WasmModel(JSON.stringify(project));
    try {
      expect(evaluateProjectJs(project, {}).meshes.map(mesh => mesh.id)).toEqual(['iris']);
      expect(model.evaluate().meshes.map(mesh => mesh.id)).toEqual(['iris']);
    } finally { model.free(); }
  });

  it('subtracts the union of overlapping inverted masks instead of XOR', async () => {
    const project = fixture();
    const second = structuredClone(project.nodes[0]);
    second.id = 'second';
    if (second.kind.type === 'ArtMesh') second.kind.vertices = [[28, 16], [52, 16], [28, 40], [52, 40]];
    project.nodes.push(second);
    if (project.nodes[1].kind.type === 'ArtMesh') {
      project.nodes[1].kind.mask_ids = ['aperture', 'second'];
      project.nodes[1].kind.is_mask_inverted = true;
    }
    const model = new WasmModel(JSON.stringify(project));
    const texture = createCanvas(1, 1);
    texture.getContext('2d').fillStyle = '#2456dc';
    texture.getContext('2d').fillRect(0, 0, 1, 1);
    try {
      const png = await renderFrameToCanvas(64, 64, model.evaluate(), () => texture.toBuffer('image/png'), '#ffffff');
      const image = await loadImage(png), canvas = createCanvas(64, 64), context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      for (const x of [24, 34, 48]) expect([...context.getImageData(x, 24, 1, 1).data]).toEqual([255, 255, 255, 255]);
      expect([...context.getImageData(8, 24, 1, 1).data]).toEqual([36, 86, 220, 255]);
      canvas.width = 0; canvas.height = 0;
    } finally { model.free(); texture.width = 0; texture.height = 0; }
  });

  it('retains holes inside an individual mask', async () => {
    const project = fixture();
    if (project.nodes[0].kind.type === 'ArtMesh') {
      const mask = project.nodes[0].kind;
      mask.vertices = [[16, 16], [48, 16], [48, 48], [16, 48], [24, 24], [40, 24], [40, 40], [24, 40]];
      mask.uvs = mask.vertices.map(() => [0.5, 0.5]);
      mask.indices = [0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7];
    }
    const model = new WasmModel(JSON.stringify(project)), texture = createCanvas(1, 1);
    texture.getContext('2d').fillStyle = '#2456dc';
    texture.getContext('2d').fillRect(0, 0, 1, 1);
    try {
      const png = await renderFrameToCanvas(64, 64, model.evaluate(), () => texture.toBuffer('image/png'), '#ffffff');
      const image = await loadImage(png), canvas = createCanvas(64, 64), context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      expect([...context.getImageData(20, 32, 1, 1).data]).toEqual([36, 86, 220, 255]);
      expect([...context.getImageData(32, 32, 1, 1).data]).toEqual([255, 255, 255, 255]);
      canvas.width = 0; canvas.height = 0;
    } finally { model.free(); texture.width = 0; texture.height = 0; }
  });

  it('retains both mask islands sharing a vertex, including mixed winding', async () => {
    const project = fixture();
    if (project.nodes[0].kind.type === 'ArtMesh') {
      const mask = project.nodes[0].kind;
      mask.vertices = [[8, 8], [28, 8], [28, 28], [8, 28], [48, 28], [48, 48], [28, 48]];
      mask.uvs = mask.vertices.map(() => [0.5, 0.5]);
      mask.indices = [0, 1, 2, 0, 2, 3, 2, 5, 4, 2, 6, 5];
    }
    const texture = createCanvas(1, 1);
    texture.getContext('2d').fillStyle = '#2456dc';
    texture.getContext('2d').fillRect(0, 0, 1, 1);
    try {
      for (const inverted of [false, true]) {
        if (project.nodes[1].kind.type === 'ArtMesh') project.nodes[1].kind.is_mask_inverted = inverted;
        const model = new WasmModel(JSON.stringify(project));
        try {
          const png = await renderFrameToCanvas(64, 64, model.evaluate(), () => texture.toBuffer('image/png'), '#ffffff');
          const image = await loadImage(png), canvas = createCanvas(64, 64), context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          for (const [x, y] of [[16, 16], [32, 32], [42, 42]]) {
            expect([...context.getImageData(x, y, 1, 1).data]).toEqual(inverted ? [255, 255, 255, 255] : [36, 86, 220, 255]);
          }
          expect([...context.getImageData(56, 16, 1, 1).data]).toEqual(inverted ? [36, 86, 220, 255] : [255, 255, 255, 255]);
          canvas.width = 0; canvas.height = 0;
        } finally { model.free(); }
      }
    } finally { texture.width = 0; texture.height = 0; }
  });

  it('uses the even-odd fill rule returned by complex PathOps differences', async () => {
    const project = fixture();
    const definitions = [
      { rect: [30, 9, 21, 10] },
      { rect: [22, 7, 17, 25], hole: [24, 9, 13, 21] },
      { rect: [24, 8, 25, 23], hole: [26, 10, 21, 19] },
      { rect: [15, 29, 12, 23], hole: [17, 31, 8, 19] },
      { rect: [35, 12, 15, 17], hole: [37, 14, 11, 13] },
      { rect: [19, 19, 14, 23] },
      { rect: [31, 15, 10, 24], hole: [33, 17, 6, 20] },
    ];
    const target = project.nodes[1];
    project.nodes = definitions.map((definition, index) => {
      const node = structuredClone(fixture().nodes[0]);
      node.id = `coverage-${index}`;
      if (node.kind.type === 'ArtMesh') {
        const [x, y, w, h] = definition.rect;
        node.kind.vertices = [[x, y], [x+w, y], [x+w, y+h], [x, y+h]];
        node.kind.indices = [0, 1, 2, 0, 2, 3];
        if (definition.hole) {
          const [hx, hy, hw, hh] = definition.hole;
          node.kind.vertices.push([hx, hy], [hx+hw, hy], [hx+hw, hy+hh], [hx, hy+hh]);
          node.kind.indices = [0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 6, 5, 2, 3, 6, 3, 7, 6, 3, 0, 7, 0, 4, 7];
        }
        node.kind.uvs = node.kind.vertices.map(() => [0.5, 0.5]);
      }
      return node;
    });
    if (target.kind.type === 'ArtMesh') {
      target.kind.mask_ids = project.nodes.map(node => node.id);
      target.kind.is_mask_inverted = true;
    }
    project.nodes.push(target);
    const model = new WasmModel(JSON.stringify(project)), texture = createCanvas(1, 1);
    texture.getContext('2d').fillStyle = '#2456dc';
    texture.getContext('2d').fillRect(0, 0, 1, 1);
    try {
      const png = await renderFrameToCanvas(64, 64, model.evaluate(), () => texture.toBuffer('image/png'), '#ffffff');
      const image = await loadImage(png), canvas = createCanvas(64, 64), context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      expect([...context.getImageData(22, 7, 1, 1).data]).toEqual([255, 255, 255, 255]);
      expect([...context.getImageData(0, 0, 1, 1).data]).toEqual([36, 86, 220, 255]);
      canvas.width = 0; canvas.height = 0;
    } finally { model.free(); texture.width = 0; texture.height = 0; }
  });
});
