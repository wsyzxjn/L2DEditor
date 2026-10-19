import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Project } from '../packages/schema/dist/index.js';
import { evaluateProjectJs, lintProjectJs } from '../packages/schema/dist/index.js';
import {
  serializeMoc3Container,
  importRuntimePackage,
  copyRuntimePackageTextures,
  generateTextureAtlas,
  renderFrameToCanvas,
} from '../packages/renderer/dist/index.js';

const { createCanvas, loadImage } = createRequire(new URL('../packages/renderer/package.json', import.meta.url))('@napi-rs/canvas');
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'l2d-runtime-import-'));
  directories.push(directory);
  const textures = [
    { id: 'custom_atlas_a', path: 'first.png', width: 93, height: 67, color: '#d63c26' },
    { id: 'custom_atlas_b', path: 'second.png', width: 47, height: 83, color: '#246bd5' },
  ];
  const project: Project = {
    format_version: 1,
    canvas: { width: 64, height: 64, origin_x: 0.5, origin_y: 0.5, background_color: '#ffffff' },
    parameters: [], keyforms: [],
    textures: textures.map(({ color, ...texture }) => texture),
    nodes: textures.map((texture, index) => ({
      id: `mesh_${index}`, name: `Mesh ${index}`, visible: true, locked: false, parent_id: null,
      kind: {
        type: 'ArtMesh' as const, texture_id: texture.id,
        vertices: [[index * 32, 0], [index * 32 + 32, 0], [index * 32, 64], [index * 32 + 32, 64]],
        uvs: [[0, 0], [1, 0], [0, 1], [1, 1]], indices: [0, 1, 2, 1, 3, 2],
        opacity: 1, draw_order: index, blend_mode: 'normal' as const, mask_ids: [],
      },
    })),
  };
  for (const texture of textures) {
    const canvas = createCanvas(texture.width, texture.height);
    canvas.getContext('2d').fillStyle = texture.color;
    canvas.getContext('2d').fillRect(0, 0, texture.width, texture.height);
    fs.writeFileSync(path.join(directory, texture.path), canvas.toBuffer('image/png'));
    canvas.width = 0; canvas.height = 0;
  }
  // Custom texture IDs and names are editor metadata, so this fixture explicitly embeds
  // the source project. Runtime exports do not embed it by default.
  fs.writeFileSync(path.join(directory, 'fixture.moc3'), serializeMoc3Container(project, 5, true));
  const manifestPath = path.join(directory, 'fixture.model3.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    Version: 3, FileReferences: { Moc: 'fixture.moc3', Textures: textures.map(texture => texture.path) },
  }));
  return { directory, manifestPath, project, textures };
}

describe('Runtime bundle texture reconstruction', () => {
  it('bleeds texture edges into atlas gutters before runtime sampling', async () => {
    const { directory, project } = fixture();
    project.nodes = [project.nodes[0]];
    const atlas = await generateTextureAtlas(
      project,
      (id) => {
        const texture = project.textures.find((item) => item.id === id);
        return texture ? fs.readFileSync(path.join(directory, texture.path)) : null;
      },
      128,
      4
    );
    const canvas = createCanvas(128, 128);
    canvas.getContext('2d').drawImage(await loadImage(atlas.atlasPngBuffers[0].buffer), 0, 0);
    for (const [x, y] of [[3, 4], [4, 4], [96, 4], [4, 70]]) {
      expect([...canvas.getContext('2d').getImageData(x, y, 1, 1).data]).toEqual([
        214, 60, 38, 255,
      ]);
    }
  });

  it('renders an atlas subregion whose texture origin is beyond the output canvas', async () => {
    const { project } = fixture();
    project.nodes = [project.nodes[0]];
    const mesh = project.nodes[0].kind;
    if (mesh.type !== 'ArtMesh') throw new Error('Expected fixture mesh');
    mesh.vertices = [[0, 0], [64, 0], [0, 64], [64, 64]];
    mesh.uvs = [[0.5, 0.75], [0.75, 0.75], [0.5, 1], [0.75, 1]];
    const atlas = createCanvas(256, 256);
    atlas.getContext('2d').fillStyle = 'rgba(255,0,0,0.5)';
    atlas.getContext('2d').fillRect(128, 192, 64, 64);
    const png = await renderFrameToCanvas(64, 64, evaluateProjectJs(project, {}), () => atlas.toBuffer('image/png'), 'transparent');
    const canvas = createCanvas(64, 64), context = canvas.getContext('2d');
    context.drawImage(await loadImage(png), 0, 0);
    for (const [x, y] of [[16, 32], [31, 32], [32, 31], [48, 16]]) {
      const actual = [...context.getImageData(x, y, 1, 1).data];
      expect(actual[0]).toBe(255);
      expect(actual[1]).toBe(0);
      expect(actual[2]).toBe(0);
      expect(Math.abs(actual[3] - 128)).toBeLessThanOrEqual(1);
    }
  });

  it('preserves minified translucent artwork after moving it into an atlas', async () => {
    const { project } = fixture();
    project.nodes = [project.nodes[0]];
    const mesh = project.nodes[0].kind;
    if (mesh.type !== 'ArtMesh') throw new Error('Expected fixture mesh');
    mesh.vertices = [[20.25, 26.25], [29.75, 26.25], [20.25, 30.45], [29.75, 30.45]];
    const artwork = createCanvas(64, 32), context = artwork.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 32);
    gradient.addColorStop(0, '#471525'); gradient.addColorStop(1, '#d35882');
    context.fillStyle = gradient; context.beginPath(); context.ellipse(32, 16, 30, 14, 0, 0, Math.PI*2); context.fill();
    context.fillStyle = 'rgba(255,195,210,0.5)'; context.fillRect(14, 22, 36, 5);
    const expectedPng = await renderFrameToCanvas(64, 64, evaluateProjectJs(project, {}), () => artwork.toBuffer('image/png'), '#ffffff');
    const atlas = createCanvas(256, 256);
    atlas.getContext('2d').drawImage(artwork, 128, 192);
    mesh.uvs = [[0.5, 0.75], [0.75, 0.75], [0.5, 0.875], [0.75, 0.875]];
    const actualPng = await renderFrameToCanvas(64, 64, evaluateProjectJs(project, {}), () => atlas.toBuffer('image/png'), '#ffffff');
    const output = createCanvas(64, 64), outputContext = output.getContext('2d');
    outputContext.drawImage(await loadImage(expectedPng), 0, 0);
    const expected = outputContext.getImageData(0, 0, 64, 64).data;
    outputContext.clearRect(0, 0, 64, 64); outputContext.drawImage(await loadImage(actualPng), 0, 0);
    const actual = outputContext.getImageData(0, 0, 64, 64).data;
    for (let index = 0; index < expected.length; index++) expect(Math.abs(expected[index] - actual[index])).toBeLessThanOrEqual(2);
  });

  it('keeps binary/editor texture IDs and uses each image actual dimensions', () => {
    const { manifestPath, textures } = fixture();
    const imported = importRuntimePackage(manifestPath);
    expect(imported.project.textures).toEqual(textures.map(({ color, ...texture }) => texture));
    expect(lintProjectJs(imported.project)).toEqual([]);
    const ids = new Set(imported.project.textures.map(texture => texture.id));
    for (const node of imported.project.nodes) {
      if (node.kind.type === 'ArtMesh') expect(ids.has(node.kind.texture_id)).toBe(true);
    }
  });

  it('copies imported textures into the destination project directory', () => {
    const { directory, manifestPath, textures } = fixture();
    const imported = importRuntimePackage(manifestPath).project;
    const output = path.join(directory, 'portable.l2dproj');
    expect(copyRuntimePackageTextures(manifestPath, imported, output)).toBe(textures.length);
    for (const texture of imported.textures) {
      expect(fs.readFileSync(path.join(output, texture.path))).toEqual(
        fs.readFileSync(path.join(directory, texture.path))
      );
    }
  });

  it('resolves and renders both imported textures, rather than silently falling back', async () => {
    const { directory, manifestPath, project } = fixture();
    const imported = importRuntimePackage(manifestPath).project;
    const resolver = (id: string) => {
      const texture = imported.textures.find(item => item.id === id);
      return texture ? fs.readFileSync(path.join(directory, texture.path)) : null;
    };
    const png = await renderFrameToCanvas(64, 64, evaluateProjectJs(imported, {}), resolver, '#ffffff');
    const canvas = createCanvas(64, 64);
    canvas.getContext('2d').drawImage(await loadImage(png), 0, 0);
    expect([...canvas.getContext('2d').getImageData(16, 32, 1, 1).data]).toEqual([214, 60, 38, 255]);
    expect([...canvas.getContext('2d').getImageData(48, 32, 1, 1).data]).toEqual([36, 107, 213, 255]);
    expect(imported.nodes).toMatchObject(project.nodes.map(({ parent_id, ...node }) => node));
  });

  it('does not invent dimensions for a missing texture file', () => {
    const { directory, manifestPath } = fixture();
    fs.unlinkSync(path.join(directory, 'second.png'));
    expect(() => importRuntimePackage(manifestPath)).toThrow();
  });

  it('rejects an undecodable texture instead of assuming a 2048 square', () => {
    const { directory, manifestPath } = fixture();
    fs.writeFileSync(path.join(directory, 'second.png'), 'not an image');
    expect(() => importRuntimePackage(manifestPath)).toThrow('Invalid runtime texture: second.png');
  });
});
