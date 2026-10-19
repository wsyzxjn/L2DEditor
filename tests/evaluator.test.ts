import { describe, expect, it } from 'vitest';
import { evaluateProjectJs, type Project } from '../packages/schema/dist/index.js';

describe('JavaScript evaluator parity', () => {
  it('falls back to the mesh draw order when a keyform stores null', () => {
    const project: Project = {
      format_version: 1,
      canvas: { width: 16, height: 16, origin_x: 0.5, origin_y: 0.5, background_color: '#ffffff' },
      parameters: [],
      textures: [],
      nodes: [{
        id: 'mesh',
        name: 'Mesh',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 'texture',
          vertices: [[0, 0], [1, 0], [0, 1]],
          uvs: [[0, 0], [1, 0], [0, 1]],
          indices: [0, 1, 2],
          opacity: 1,
          draw_order: 81,
          blend_mode: 'normal',
          mask_ids: [],
        },
      }],
      keyforms: [{
        target_node_id: 'mesh',
        dimensions: [{ param_id: 'Param', keys: [0] }],
        keyforms: [{
          coordinates: [0],
          payload: {
            kind: 'ArtMesh',
            vertex_offsets: [[0, 0], [0, 0], [0, 0]],
            draw_order: null,
          },
        }],
      }],
    };
    expect(evaluateProjectJs(project, {}).meshes[0].draw_order).toBe(81);
  });
});
