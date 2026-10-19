import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  initializeCanvas,
  writePsdBuffer,
} from '../packages/psd/node_modules/ag-psd/dist/index.js';
import { importPsdBuffer } from '../packages/psd/dist/index.js';

const { createCanvas } = createRequire(
  new URL('../packages/psd/package.json', import.meta.url)
)('@napi-rs/canvas');
initializeCanvas(createCanvas as any);

function layer(name: string, color: string, left: number) {
  const canvas = createCanvas(64, 64);
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  context.fillRect(0, 0, 64, 64);
  return { name, canvas, left, top: 0 };
}

function psd(secondColor: string) {
  return writePsdBuffer({
    width: 256,
    height: 128,
    children: [
      layer('まばたき', '#ff0000', 0),
      layer('Layer 1', secondColor, 64),
      layer('Layer 1', '#00ff00', 128),
    ],
  });
}

describe('PSD non-destructive reload', () => {
  it('preserves rig data and existing mesh geometry while deduplicating Unicode layer IDs', async () => {
    const first = await importPsdBuffer(Buffer.from(psd('#0000ff')));
    const artIds = first.project.nodes
      .filter((node) => node.kind.type === 'ArtMesh')
      .map((node) => node.id);
    expect(artIds.length).toBe(3);
    expect(new Set(artIds).size).toBe(3);
    expect(first.project.nodes.some((node) => node.id.includes('まばたき'))).toBe(true);

    const meshNode = first.project.nodes.find((node) => node.kind.type === 'ArtMesh')!;
    if (meshNode.kind.type !== 'ArtMesh') throw new Error('Expected ArtMesh');
    meshNode.kind.vertices = [[1, 2], [3, 4], [5, 6]];
    meshNode.kind.uvs = [[0, 0], [1, 0], [0, 1]];
    meshNode.kind.indices = [0, 1, 2];
    first.project.nodes.push({
      id: 'deformer',
      name: 'Deformer',
      parent_id: null,
      visible: true,
      locked: false,
      kind: {
        type: 'WarpDeformer',
        cols: 1,
        rows: 1,
        bounds: [0, 0, 10, 10],
        control_points: [[0, 0], [10, 0], [0, 10], [10, 10]],
      },
    });
    first.project.keyforms.push({
      target_node_id: 'deformer',
      dimensions: [],
      keyforms: [{
        coordinates: [],
        payload: { kind: 'Warp', control_points: [[0, 0], [10, 0], [0, 10], [10, 10]] },
      }],
    });
    first.project.physics!.push({
      id: 'physics',
      name: 'Physics',
      inputs: [],
      outputs: [],
      pendulums: [],
    });
    first.project.animations!.push({
      id: 'idle',
      name: 'Idle',
      duration_frames: 1,
      fps: 30,
      loop_playback: false,
      tracks: [],
    });

    const second = await importPsdBuffer(Buffer.from(psd('#ffff00')), {
      existingProject: first.project,
    });
    expect(second.project.nodes.some((node) => node.id === 'deformer')).toBe(true);
    expect(second.project.keyforms.some((binding) => binding.target_node_id === 'deformer')).toBe(true);
    expect(second.project.physics).toHaveLength(1);
    expect(second.project.animations).toHaveLength(1);
    const remeshed = second.project.nodes.find((node) => node.id === meshNode.id)!;
    if (remeshed.kind.type !== 'ArtMesh') throw new Error('Expected ArtMesh');
    expect(remeshed.kind.vertices).toEqual([[1, 2], [3, 4], [5, 6]]);
    expect(second.report.updatedLayers.length).toBe(3);
    expect(second.report.addedLayers).toHaveLength(0);
    expect(new Set(second.project.textures.map((texture) => texture.id)).size)
      .toBe(second.project.textures.length);
  });
});
