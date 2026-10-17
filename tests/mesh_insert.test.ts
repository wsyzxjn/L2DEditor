import { describe, it, expect } from 'vitest';
import { CommandBus, registerStandardCommands } from '../packages/command/dist/index.js';
import { evaluateProjectJs, triangleWeights, type Project } from '../packages/schema/dist/index.js';

function fixture(): Project {
  return {
    format_version: 1, canvas: { width: 1000, height: 1000, origin_x: 0.5, origin_y: 0.5, background_color: '#ffffff' },
    parameters: [{ id: 'open', name: 'Open', min: 0, max: 1, default: 0 }],
    textures: [{ id: 'eye', path: 'eye.png', width: 400, height: 200 }],
    nodes: [{ id: 'eye', name: 'Eye', parent_id: null, visible: true, locked: false, kind: {
      type: 'ArtMesh', texture_id: 'eye', vertices: [[100, 200], [140, 200], [140, 220], [100, 220]],
      uvs: [[0.2, 0.1], [0.8, 0.1], [0.8, 0.9], [0.2, 0.9]], indices: [0, 1, 2, 0, 2, 3], blend_mode: 'normal', opacity: 1, draw_order: 0, mask_ids: [],
      morph_targets: [{ id: 'morph', name: 'Morph', param_id: 'open', vertex_offsets: [[0, 0], [4, 0], [4, 2], [0, 2]] }],
    } }],
    keyforms: [{ target_node_id: 'eye', dimensions: [{ param_id: 'open', keys: [0, 1] }], keyforms: [
      { coordinates: [0], payload: { kind: 'ArtMesh', vertex_offsets: [[0, 0], [0, 0], [0, 0], [0, 0]] } },
      { coordinates: [1], payload: { kind: 'ArtMesh', vertex_offsets: [[0, 0], [8, 0], [8, 4], [0, 4]] } },
    ] }],
  };
}

describe('mesh vertex insertion', () => {
  it('interpolates cropped UVs, keyforms and morphs and splits both faces of a shared edge atomically', () => {
    const initial = fixture();
    const bus = new CommandBus(initial); registerStandardCommands(bus);
    const command = { id: 'insert', name: 'mesh.add_vertex', params: { node_id: 'eye', pos: [120, 210] } };
    expect(bus.dryRun(command).success).toBe(true);
    expect(bus.getProject()).toEqual(initial);
    expect(bus.canUndo()).toBe(false);
    expect(bus.execute(command).success).toBe(true);
    const mesh = bus.getProject().nodes[0].kind;
    if (mesh.type !== 'ArtMesh') throw new Error('Expected mesh');
    expect(mesh.uvs[4][0]).toBeCloseTo(0.5); expect(mesh.uvs[4][1]).toBeCloseTo(0.5);
    expect(mesh.indices).toHaveLength(12);
    expect(mesh.morph_targets![0].vertex_offsets[4]).toEqual([2, 1]);
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices.slice(i, i + 3).map(index => mesh.vertices[index]);
      expect((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])).toBeGreaterThan(0);
    }
    const animated = evaluateProjectJs(bus.getProject(), { open: 1 }).meshes[0];
    expect(animated.vertices[8]).toBeCloseTo((animated.vertices[0] + animated.vertices[4]) / 2);
    expect(animated.vertices[9]).toBeCloseTo((animated.vertices[1] + animated.vertices[5]) / 2);
    const edited = bus.getProject(); bus.undo(); expect(bus.getProject()).toEqual(initial);
    bus.redo(); expect(bus.getProject()).toEqual(edited);
  });

  it('uses the containing face instead of the nearest centroid, and rejects invalid insertions without mutation', () => {
    const project = fixture(); project.keyforms = [];
    const mesh = project.nodes[0].kind;
    if (mesh.type !== 'ArtMesh') throw new Error('Expected mesh');
    mesh.morph_targets = [];
    mesh.vertices = [[0, 0], [100, 0], [0, 1], [5, 2], [6, 2], [5, 3]];
    mesh.uvs = [[0, 0], [1, 0], [0, 1], [0, 0], [1, 0], [0, 1]];
    mesh.indices = [0, 1, 2, 3, 4, 5];
    const bus = new CommandBus(project); registerStandardCommands(bus);
    expect(bus.execute({ id: 'valid', name: 'mesh.add_vertex', params: { node_id: 'eye', pos: [5, 0.5] } }).success).toBe(true);
    const updated = bus.getProject();
    const kind = updated.nodes[0].kind;
    if (kind.type !== 'ArtMesh') throw new Error('Expected mesh');
    expect(kind.indices.slice(-3)).toEqual([3, 4, 5]);
    for (const pos of [[500, 500], [0, 0], [NaN, 1]]) {
      expect(bus.execute({ id: 'invalid', name: 'mesh.add_vertex', params: { node_id: 'eye', pos } }).success).toBe(false);
      expect(bus.getProject()).toEqual(updated);
    }
    expect(() => registerStandardCommands(bus)).toThrow('already registered');
    expect(triangleWeights([0, 0], [0, 0], [1, 1], [2, 2])).toBeNull();
  });
});

describe('sprite swap geometry preservation', () => {
  it('adds an opacity dimension without discarding existing shape keys and validates states atomically', () => {
    const project = fixture();
    const opaqueShape = project.keyforms[0].keyforms[1].payload;
    if (opaqueShape.kind === 'ArtMesh') opaqueShape.opacity = 0.4;
    project.parameters.push({ id: 'state', name: 'State', min: 0, max: 1, default: 1 });
    project.textures.push({ id: 'closed', path: 'closed.png', width: 400, height: 200 });
    const bus = new CommandBus(project); registerStandardCommands(bus);
    const states = [{ value: 1, texture_id: 'eye', node_id: 'eye' }, { value: 0, texture_id: 'closed', node_id: 'eye_sprite_closed', offset: [2, 3] }];
    const command = { id: 'swap', name: 'macro.sprite_swap', params: { base_node_id: 'eye', param_id: 'state', states } };
    expect(bus.execute(command).success).toBe(true);
    const binding = bus.getProject().keyforms.find(binding => binding.target_node_id === 'eye_sprite_closed')!;
    expect(binding.dimensions.map(dimension => dimension.param_id)).toEqual(['open', 'state']);
    const rendered = evaluateProjectJs(bus.getProject(), { open: 1, state: 0 });
    const closed = rendered.meshes.find(mesh => mesh.id === 'eye_sprite_closed')!;
    const original = evaluateProjectJs(project, { open: 1 }).meshes[0];
    expect(closed.opacity).toBeCloseTo(original.opacity);
    expect(closed.vertices[0]).toBeCloseTo(original.vertices[0] + 2);
    expect(closed.vertices[1]).toBeCloseTo(original.vertices[1] + 3);
    expect(bus.execute(command).success).toBe(true); // Reapply with no accumulated translation.
    expect(evaluateProjectJs(bus.getProject(), { open: 1, state: 0 }).meshes.find(mesh => mesh.id === closed.id)?.vertices).toEqual(closed.vertices);
    expect(evaluateProjectJs(bus.getProject(), { open: 1, state: 0 }).meshes.find(mesh => mesh.id === closed.id)?.opacity).toBeCloseTo(closed.opacity);
    const valid = bus.getProject();
    for (const invalid of [
      [states[0], { ...states[1], value: 1 }],
      [states[0], { ...states[1], texture_id: 'missing' }],
      [states[1]],
    ]) {
      expect(bus.execute({ ...command, params: { ...command.params, states: invalid } }).success).toBe(false);
      expect(bus.getProject()).toEqual(valid);
    }
  });
});
