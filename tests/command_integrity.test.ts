import { describe, expect, it } from 'vitest';
import {
  CommandBus,
  registerStandardCommands,
} from '../packages/command/dist/index.js';
import {
  evaluateAnimationAtFrameJs,
  evaluateProjectJs,
  type Animation,
  type Project,
} from '../packages/schema/dist/index.js';

function baseProject(): Project {
  return {
    format_version: 1,
    canvas: { width: 1000, height: 1000, origin_x: 0.5, origin_y: 0.5, background_color: '#fff' },
    parameters: [],
    nodes: [],
    keyforms: [],
    textures: [],
    glues: [],
    physics: [],
    animations: [],
    parameter_groups: [],
    pose_groups: [],
    expressions: [],
  };
}

function warpNode(id = 'warp'): Project['nodes'][number] {
  return {
    id,
    name: id,
    parent_id: null,
    visible: true,
    locked: false,
    kind: {
      type: 'WarpDeformer',
      cols: 1,
      rows: 1,
      bounds: [0, 0, 100, 100],
      control_points: [[0, 0], [100, 0], [0, 100], [100, 100]],
    },
  };
}

describe('command bus reference integrity', () => {
  it('drops a deleted parameter axis and every dependent reference', () => {
    const project = baseProject();
    project.parameters = [
      { id: 'Axis', name: 'Axis', min: -1, max: 1, default: 0 },
      { id: 'Other', name: 'Other', min: -1, max: 1, default: 0 },
    ];
    project.nodes = [warpNode()];
    const keyforms = [];
    for (const other of [-1, 0, 1]) {
      for (const axis of [-1, 0, 1]) {
        keyforms.push({
          coordinates: [other, axis],
          payload: { kind: 'Warp' as const, control_points: [[axis, 0], [100, 0], [0, 100], [100, 100]] },
        });
      }
    }
    project.keyforms = [{
      target_node_id: 'warp',
      dimensions: [
        { param_id: 'Other', keys: [-1, 0, 1] },
        { param_id: 'Axis', keys: [-1, 0, 1] },
      ],
      keyforms,
    }];
    project.physics = [{
      id: 'physics',
      name: 'Physics',
      inputs: [{ param_id: 'Axis', weight: 1, reflect: false }],
      outputs: [{ param_id: 'Axis', pendulum_index: 0, angle_scale: 1, weight: 1 }],
      pendulums: [{ length: 10, damping: 0.8, mass: 1 }],
    }];
    project.expressions = [{
      id: 'expression',
      name: 'Expression',
      fade_in_time: 0.1,
      fade_out_time: 0.1,
      parameters: [{ id: 'Axis', value: 0.5, blend: 'add' }],
    }];
    project.animations = [{
      id: 'idle',
      name: 'Idle',
      duration_frames: 10,
      fps: 30,
      loop_playback: false,
      tracks: [{
        target_param_id: 'Axis',
        keyframes: [{ frame: 0, value: 0, curve: 'linear' }],
        frozen: false,
      }],
      markers: [],
      form_tracks: [],
    }];
    project.nodes.push({
      id: 'mesh',
      name: 'Mesh',
      parent_id: null,
      visible: true,
      locked: false,
      kind: {
        type: 'ArtMesh',
        texture_id: 'tex',
        vertices: [[0, 0], [1, 0], [0, 1]],
        uvs: [[0, 0], [1, 0], [0, 1]],
        indices: [0, 1, 2],
        opacity: 1,
        draw_order: 0,
        mask_ids: [],
        morph_targets: [{
          id: 'morph',
          name: 'Morph',
          param_id: 'Axis',
          vertex_offsets: [[1, 0], [1, 0], [1, 0]],
        }],
      },
    });

    const bus = new CommandBus(project);
    registerStandardCommands(bus);
    expect(bus.execute({ id: 'delete', name: 'parameter.delete', params: { id: 'Axis' } }).success).toBe(true);
    const next = bus.getProject();
    expect(next.parameters.map((parameter) => parameter.id)).toEqual(['Other']);
    expect(next.keyforms[0].dimensions).toHaveLength(1);
    expect(next.keyforms[0].keyforms).toHaveLength(3);
    expect(next.keyforms[0].keyforms.every((state) => state.coordinates.length === 1)).toBe(true);
    expect(next.physics[0].inputs).toHaveLength(0);
    expect(next.physics[0].outputs).toHaveLength(0);
    expect(next.expressions[0].parameters).toHaveLength(0);
    expect(next.animations[0].tracks).toHaveLength(0);
    const mesh = next.nodes.find((node) => node.id === 'mesh')!;
    if (mesh.kind.type !== 'ArtMesh') throw new Error('Expected mesh');
    expect(mesh.kind.morph_targets).toHaveLength(0);
  });

  it('updates dependent topology for delete, subdivision, and division resampling', () => {
    const project = baseProject();
    project.parameters = [{ id: 'Param', name: 'Param', min: -1, max: 1, default: 0 }];
    project.nodes = [warpNode(), {
      id: 'mesh',
      name: 'Mesh',
      parent_id: null,
      visible: true,
      locked: false,
      kind: {
        type: 'ArtMesh',
        texture_id: 'tex',
        vertices: [[0, 0], [10, 0], [10, 10], [0, 10]],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        indices: [0, 1, 2, 0, 2, 3],
        opacity: 1,
        draw_order: 0,
        mask_ids: [],
        morph_targets: [{
          id: 'morph',
          name: 'Morph',
          param_id: 'Param',
          vertex_offsets: [[1, 0], [2, 0], [3, 0], [4, 0]],
        }],
      },
    }];
    project.keyforms = [
      {
        target_node_id: 'mesh',
        dimensions: [{ param_id: 'Param', keys: [-1, 1] }],
        keyforms: [
          { coordinates: [-1], payload: { kind: 'ArtMesh', vertex_offsets: [[1, 0], [2, 0], [3, 0], [4, 0]] } },
          { coordinates: [1], payload: { kind: 'ArtMesh', vertex_offsets: [[2, 0], [3, 0], [4, 0], [5, 0]] } },
        ],
      },
      {
        target_node_id: 'warp',
        dimensions: [{ param_id: 'Param', keys: [-1, 1] }],
        keyforms: [
          { coordinates: [-1], payload: { kind: 'Warp', control_points: [[-1, 0], [99, 0], [-1, 100], [99, 100]] } },
          { coordinates: [1], payload: { kind: 'Warp', control_points: [[1, 0], [101, 0], [1, 100], [101, 100]] } },
        ],
      },
    ];
    project.glues = [{
      id: 'glue',
      name: 'Glue',
      mesh_a_id: 'mesh',
      mesh_b_id: 'mesh',
      vertex_pairs: [{ index_a: 3, index_b: 3, weight_a: 1, weight_b: 0 }],
    }];

    const bus = new CommandBus(project);
    registerStandardCommands(bus);
    expect(bus.execute({ id: 'del', name: 'mesh.delete_vertex', params: { mesh_id: 'mesh', vertex_index: 1 } }).success).toBe(true);
    let mesh = bus.getProject().nodes.find((node) => node.id === 'mesh')!;
    if (mesh.kind.type !== 'ArtMesh') throw new Error('Expected mesh');
    expect(mesh.kind.vertices).toHaveLength(3);
    expect(mesh.kind.morph_targets[0].vertex_offsets).toHaveLength(3);
    expect((bus.getProject().keyforms[0].keyforms[0].payload as any).vertex_offsets).toHaveLength(3);
    expect(bus.getProject().glues[0].vertex_pairs[0].index_a).toBe(2);

    expect(bus.execute({ id: 'sub', name: 'mesh.subdivide', params: { mesh_id: 'mesh' } }).success).toBe(true);
    mesh = bus.getProject().nodes.find((node) => node.id === 'mesh')!;
    if (mesh.kind.type !== 'ArtMesh') throw new Error('Expected mesh');
    expect(mesh.kind.vertices.length).toBeGreaterThan(3);
    expect(mesh.kind.morph_targets[0].vertex_offsets).toHaveLength(mesh.kind.vertices.length);
    expect((bus.getProject().keyforms[0].keyforms[0].payload as any).vertex_offsets).toHaveLength(mesh.kind.vertices.length);

    expect(bus.execute({
      id: 'divisions',
      name: 'warp.set_divisions',
      params: { node_id: 'warp', cols: 3, rows: 2 },
    }).success).toBe(true);
    const warp = bus.getProject().nodes.find((node) => node.id === 'warp')!;
    if (warp.kind.type !== 'WarpDeformer') throw new Error('Expected warp');
    expect(warp.kind.control_points).toHaveLength((3 + 1) * (2 + 1));
    for (const state of bus.getProject().keyforms[1].keyforms) {
      expect((state.payload as any).control_points).toHaveLength((3 + 1) * (2 + 1));
    }
  });

  it('removes node references and protects hierarchy integrity', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', name: 'A', parent_id: null, visible: true, locked: false, kind: { type: 'Part', opacity: 1 } },
      { id: 'B', name: 'B', parent_id: 'A', visible: true, locked: false, kind: { type: 'Part', opacity: 1 } },
      { id: 'C', name: 'C', parent_id: 'B', visible: true, locked: false, kind: { type: 'Part', opacity: 1 } },
      {
        id: 'mesh',
        name: 'Mesh',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 'tex',
          vertices: [[0, 0], [1, 0], [0, 1]],
          uvs: [[0, 0], [1, 0], [0, 1]],
          indices: [0, 1, 2],
          opacity: 1,
          draw_order: 0,
          mask_ids: ['B'],
        },
      },
      {
        id: 'path',
        name: 'Path',
        parent_id: null,
        visible: true,
        locked: false,
        kind: { type: 'DeformPath', control_points: [[0, 0], [1, 1]], target_mesh_ids: ['mesh'] },
      },
    ];
    project.pose_groups = [{ id: 'pose', name: 'Pose', fade_in_time: 0.1, part_ids: ['B'] }];
    project.animations = [{
      id: 'idle',
      name: 'Idle',
      duration_frames: 1,
      fps: 30,
      loop_playback: false,
      tracks: [],
      markers: [],
      form_tracks: [{ target_node_id: 'B', keyframes: [] }],
    }];
    const bus = new CommandBus(project);
    registerStandardCommands(bus);
    expect(bus.execute({
      id: 'cycle',
      name: 'node.batch_reparent',
      params: { node_ids: ['A'], new_parent_id: 'C' },
    }).success).toBe(false);
    expect(bus.execute({ id: 'delete', name: 'node.batch_delete', params: { node_ids: ['B'] } }).success).toBe(true);
    const next = bus.getProject();
    expect(next.nodes.find((node) => node.id === 'C')?.parent_id).toBe('A');
    const mesh = next.nodes.find((node) => node.id === 'mesh')!;
    if (mesh.kind.type !== 'ArtMesh') throw new Error('Expected mesh');
    expect(mesh.kind.mask_ids).toEqual([]);
    expect(next.pose_groups[0].part_ids).toEqual([]);
    expect(next.animations[0].form_tracks).toEqual([]);
  });

  it('mirrors every multi-dimensional state and deduplicates setup keys', () => {
    const project = baseProject();
    project.parameters = [
      { id: 'X', name: 'X', min: -1, max: 1, default: 0 },
      { id: 'Y', name: 'Y', min: -1, max: 1, default: 0 },
      { id: 'Z', name: 'Z', min: 0, max: 1, default: 0 },
    ];
    project.nodes = [warpNode()];
    const states = [];
    for (const y of [-1, 0, 1]) {
      for (const x of [-1, 0, 1]) {
        states.push({
          coordinates: [x, y],
          payload: { kind: 'Warp' as const, control_points: [[x * 10, 0], [100, 0], [0, 100], [100, 100]] },
        });
      }
    }
    project.keyforms = [{
      target_node_id: 'warp',
      dimensions: [
        { param_id: 'X', keys: [-1, 0, 1] },
        { param_id: 'Y', keys: [-1, 0, 1] },
      ],
      keyforms: states,
    }];
    const bus = new CommandBus(project);
    registerStandardCommands(bus);
    expect(bus.execute({
      id: 'reflect',
      name: 'keyform.reflect_horizontal',
      params: { target_node_id: 'warp', param_id: 'X', source_key: -1, dest_key: 1 },
    }).success).toBe(true);
    const reflected = bus.getProject().keyforms[0].keyforms.filter((state) => state.coordinates[0] === 1);
    expect(reflected).toHaveLength(3);
    expect(new Set(reflected.map((state) => state.coordinates[1]))).toEqual(new Set([-1, 0, 1]));
    expect((reflected[0].payload as any).control_points[0][0]).toBe(110);

    expect(bus.execute({
      id: 'setup',
      name: 'keyform.setup_points',
      params: { target_node_id: 'warp', param_id: 'Z', point_count: 3 },
    }).success).toBe(true);
    expect(bus.getProject().keyforms[0].dimensions[0].keys).toEqual([0, 1]);
    expect(bus.getProject().keyforms[0].keyforms).toHaveLength(2);
  });

  it('inverts parameter keys inside the declared range', () => {
    const project = baseProject();
    project.parameters = [{ id: 'P', name: 'P', min: -10, max: 20, default: 0 }];
    project.nodes = [warpNode()];
    project.keyforms = [{
      target_node_id: 'warp',
      dimensions: [{ param_id: 'P', keys: [-10, 0, 20] }],
      keyforms: [-10, 0, 20].map((key) => ({
        coordinates: [key],
        payload: { kind: 'Warp' as const, control_points: [[0, 0], [100, 0], [0, 100], [100, 100]] },
      })),
    }];
    const bus = new CommandBus(project);
    registerStandardCommands(bus);
    expect(bus.execute({ id: 'inv', name: 'parameter.invert_keys', params: { param_id: 'P' } }).success).toBe(true);
    expect(bus.getProject().keyforms[0].dimensions[0].keys).toEqual([-10, 10, 20]);
    expect(bus.getProject().keyforms[0].keyforms.map((state) => state.coordinates[0]).sort((a, b) => a - b))
      .toEqual([-10, 10, 20]);
  });

  it('does not freeze dry-run parameters and applies atlas data atomically', () => {
    const project = baseProject();
    project.textures = [{ id: 'old', path: 'old.png', width: 10, height: 10 }];
    project.nodes = [{
      id: 'mesh',
      name: 'Mesh',
      parent_id: null,
      visible: true,
      locked: false,
      kind: {
        type: 'ArtMesh',
        texture_id: 'old',
        vertices: [[0, 0], [1, 0], [0, 1]],
        uvs: [[0, 0], [1, 0], [0, 1]],
        indices: [0, 1, 2],
        opacity: 1,
        draw_order: 0,
        mask_ids: [],
      },
    }];
    const bus = new CommandBus(project);
    registerStandardCommands(bus);
    const node = warpNode('dry');
    const dry = bus.dryRun({ id: 'dry', name: 'node.add', params: node });
    expect(dry.success).toBe(true);
    expect(Object.isFrozen(node.kind)).toBe(false);
    expect(Object.isFrozen(node.kind.type === 'WarpDeformer' ? node.kind.control_points : [])).toBe(false);

    const atlas = bus.execute({
      id: 'atlas',
      name: 'atlas.apply',
      params: {
        textures: [{ id: 'atlas', path: 'textures/atlas.png', width: 128, height: 128 }],
        meshes: [{ id: 'mesh', texture_id: 'atlas', uvs: [[0.1, 0.2], [0.3, 0.2], [0.1, 0.4]] }],
      },
    });
    expect(atlas.success).toBe(true);
    const mesh = bus.getProject().nodes[0];
    if (mesh.kind.type !== 'ArtMesh') throw new Error('Expected mesh');
    expect(mesh.kind.texture_id).toBe('atlas');
    expect(mesh.kind.uvs[0]).toEqual([0.1, 0.2]);
    expect(bus.execute({ id: 'deltex', name: 'texture.delete', params: { id: 'atlas' } }).success).toBe(false);
  });

  it('validates node.kind updates and enforces locks on mesh metadata', () => {
    const project = baseProject();
    project.nodes = [{
      id: 'mesh',
      name: 'Mesh',
      parent_id: null,
      visible: true,
      locked: false,
      kind: {
        type: 'ArtMesh',
        texture_id: 'tex',
        vertices: [[0, 0], [1, 0], [0, 1]],
        uvs: [[0, 0], [1, 0], [0, 1]],
        indices: [0, 1, 2],
        opacity: 1,
        draw_order: 0,
        mask_ids: [],
      },
    }];
    const bus = new CommandBus(project);
    registerStandardCommands(bus);
    expect(bus.execute({
      id: 'invalid-kind',
      name: 'node.update',
      params: { id: 'mesh', changes: { kind: { type: 'ArtMesh', texture_id: 'tex' } } },
    }).success).toBe(false);
    expect(bus.execute({
      id: 'valid-kind',
      name: 'node.update',
      params: { id: 'mesh', changes: { kind: { ...project.nodes[0].kind, opacity: 0.5 } } },
    }).success).toBe(true);
    expect(bus.execute({
      id: 'lock',
      name: 'node.batch_update',
      params: { node_ids: ['mesh'], changes: { locked: true } },
    }).success).toBe(true);
    expect(bus.execute({
      id: 'metadata',
      name: 'mesh.set_user_data',
      params: { mesh_id: 'mesh', user_data: 'blocked' },
    }).success).toBe(false);
    expect(bus.execute({
      id: 'morph',
      name: 'mesh.add_morph_target',
      params: {
        mesh_id: 'mesh',
        morph: { id: 'm', name: 'M', param_id: 'P', vertex_offsets: [[0, 0], [0, 0], [0, 0]] },
      },
    }).success).toBe(false);
  });
});

describe('JS evaluator parity', () => {
  it('extrapolates outside warp bounds instead of clamping', () => {
    const project = baseProject();
    project.nodes = [
      {
        ...warpNode(),
        parent_id: null,
      },
      {
        id: 'mesh',
        name: 'Mesh',
        parent_id: 'warp',
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 'tex',
          vertices: [[-50, 50], [0, 50], [0, 100]],
          uvs: [[0, 0], [1, 0], [0, 1]],
          indices: [0, 1, 2],
          opacity: 1,
          draw_order: 0,
          mask_ids: [],
        },
      },
    ];
    if (project.nodes[0].kind.type !== 'WarpDeformer') throw new Error('Expected warp');
    project.nodes[0].kind.control_points = [[0, 0], [200, 0], [0, 200], [200, 200]];
    const frame = evaluateProjectJs(project, {});
    expect(frame.meshes[0].vertices[0]).toBeLessThan(0);
  });

  it('normalizes opacity and colors with unset values defaulting to the node base', () => {
    const project = baseProject();
    project.parameters = [{ id: 'P', name: 'P', min: -1, max: 1, default: 0 }];
    project.nodes = [{
      id: 'mesh',
      name: 'Mesh',
      parent_id: null,
      visible: true,
      locked: false,
      kind: {
        type: 'ArtMesh',
        texture_id: 'tex',
        vertices: [[0, 0], [1, 0], [0, 1]],
        uvs: [[0, 0], [1, 0], [0, 1]],
        indices: [0, 1, 2],
        opacity: 1,
        multiply_color: [1, 1, 1, 1],
        screen_color: [0, 0, 0, 0],
        draw_order: 0,
        mask_ids: [],
      },
    }];
    project.keyforms = [{
      target_node_id: 'mesh',
      dimensions: [{ param_id: 'P', keys: [-1, 1] }],
      keyforms: [
        {
          coordinates: [-1],
          payload: { kind: 'ArtMesh', vertex_offsets: [], opacity: 0, multiply_color: [1, 0, 0, 1] },
        },
        { coordinates: [1], payload: { kind: 'ArtMesh', vertex_offsets: [] } },
      ],
    }];
    const mesh = evaluateProjectJs(project, { P: 0 }).meshes[0];
    expect(mesh.opacity).toBeCloseTo(0.5);
    expect(mesh.multiply_color[1]).toBeCloseTo(0.5);
    expect(mesh.multiply_color[2]).toBeCloseTo(0.5);
  });

  it('evaluates Bezier animation with the same cubic curve as the Rust preview', () => {
    const animation: Animation = {
      id: 'bezier',
      name: 'Bezier',
      duration_frames: 30,
      fps: 30,
      loop_playback: false,
      tracks: [{
        target_param_id: 'P',
        keyframes: [
          { frame: 0, value: 0, curve: 'bezier' },
          { frame: 30, value: 30, curve: 'linear' },
        ],
        frozen: false,
      }],
      markers: [],
      form_tracks: [],
    };
    expect(evaluateAnimationAtFrameJs(animation, 7.5).P).toBeCloseTo(4.6875, 3);
  });
});
