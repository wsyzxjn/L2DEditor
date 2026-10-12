import type { Project, Parameter, Node, KeyformBinding, TextureMeta } from '@l2d/schema';
import { CommandBus } from './bus.js';

export function registerStandardCommands(bus: CommandBus): void {
  // Canvas & Project
  bus.register<{ width?: number; height?: number; background_color?: string }>(
    'canvas.update',
    (draft, params) => {
      if (params.width !== undefined) draft.canvas.width = params.width;
      if (params.height !== undefined) draft.canvas.height = params.height;
      if (params.background_color !== undefined) draft.canvas.background_color = params.background_color;
    }
  );

  // Parameters
  bus.register<Parameter>('parameter.add', (draft, param) => {
    if (draft.parameters.some((p) => p.id === param.id)) {
      throw new Error(`Parameter with ID '${param.id}' already exists`);
    }
    draft.parameters.push(param);
  });

  bus.register<{ id: string; changes: Partial<Parameter> }>('parameter.update', (draft, { id, changes }) => {
    const target = draft.parameters.find((p) => p.id === id);
    if (!target) {
      throw new Error(`Parameter '${id}' not found`);
    }
    Object.assign(target, changes);
  });

  bus.register<{ id: string }>('parameter.delete', (draft, { id }) => {
    draft.parameters = draft.parameters.filter((p) => p.id !== id);
    // Remove this parameter dimension from all keyform bindings
    for (const kf of draft.keyforms) {
      kf.dimensions = kf.dimensions.filter((d) => d.param_id !== id);
    }
  });

  // Parameter Groups
  bus.register<any>('parameter_group.add', (draft, group) => {
    if (!draft.parameter_groups) draft.parameter_groups = [];
    draft.parameter_groups = draft.parameter_groups.filter((g) => g.id !== group.id);
    draft.parameter_groups.push(group);
  });

  // Standard Parameter Dictionary Template
  bus.register<void>('parameter.apply_standard_template', (draft) => {
    const standardGroups = [
      { id: 'group_angle', name: 'Angle / 头部朝向' },
      { id: 'group_eye', name: 'Eye / 眼睛' },
      { id: 'group_brow', name: 'Eyebrow / 眉毛' },
      { id: 'group_mouth', name: 'Mouth / 嘴部' },
      { id: 'group_body', name: 'Body / 身体' },
      { id: 'group_hair', name: 'Hair / 发丝物理' },
    ];

    if (!draft.parameter_groups) draft.parameter_groups = [];
    for (const g of standardGroups) {
      if (!draft.parameter_groups.some((p) => p.id === g.id)) {
        draft.parameter_groups.push({ ...g, collapsed: false });
      }
    }

    const standardParams = [
      { id: 'ParamAngleX', name: 'Angle X (头部 左右)', min: -30, max: 30, default: 0, group_id: 'group_angle' },
      { id: 'ParamAngleY', name: 'Angle Y (头部 上下)', min: -30, max: 30, default: 0, group_id: 'group_angle' },
      { id: 'ParamAngleZ', name: 'Angle Z (头部 倾斜)', min: -30, max: 30, default: 0, group_id: 'group_angle' },
      { id: 'ParamEyeLOpen', name: 'Eye L Open (左眼 开闭)', min: 0, max: 1, default: 1, group_id: 'group_eye' },
      { id: 'ParamEyeLSmile', name: 'Eye L Smile (左眼 微笑)', min: 0, max: 1, default: 0, group_id: 'group_eye' },
      { id: 'ParamEyeROpen', name: 'Eye R Open (右眼 开闭)', min: 0, max: 1, default: 1, group_id: 'group_eye' },
      { id: 'ParamEyeRSmile', name: 'Eye R Smile (右眼 微笑)', min: 0, max: 1, default: 0, group_id: 'group_eye' },
      { id: 'ParamEyeBallX', name: 'EyeBall X (眼珠 左右)', min: -1, max: 1, default: 0, group_id: 'group_eye' },
      { id: 'ParamEyeBallY', name: 'EyeBall Y (眼珠 上下)', min: -1, max: 1, default: 0, group_id: 'group_eye' },
      { id: 'ParamBrowLY', name: 'Brow L Y (左眉 上下)', min: -1, max: 1, default: 0, group_id: 'group_brow' },
      { id: 'ParamBrowRY', name: 'Brow R Y (右眉 上下)', min: -1, max: 1, default: 0, group_id: 'group_brow' },
      { id: 'ParamMouthForm', name: 'Mouth Form (嘴型 变形)', min: -1, max: 1, default: 0, group_id: 'group_mouth' },
      { id: 'ParamMouthOpen', name: 'Mouth Open (张嘴 开闭)', min: 0, max: 1, default: 0, group_id: 'group_mouth' },
      { id: 'ParamBodyAngleX', name: 'Body X (身体 左右)', min: -10, max: 10, default: 0, group_id: 'group_body' },
      { id: 'ParamBodyAngleY', name: 'Body Y (身体 上下)', min: -10, max: 10, default: 0, group_id: 'group_body' },
      { id: 'ParamBodyAngleZ', name: 'Body Z (身体 倾斜)', min: -10, max: 10, default: 0, group_id: 'group_body' },
      { id: 'ParamBreath', name: 'Breath (呼吸)', min: 0, max: 1, default: 0, group_id: 'group_body' },
      { id: 'ParamHairFront', name: 'Hair Front (前发 摇动)', min: -1, max: 1, default: 0, group_id: 'group_hair' },
      { id: 'ParamHairSide', name: 'Hair Side (侧发 摇动)', min: -1, max: 1, default: 0, group_id: 'group_hair' },
      { id: 'ParamHairBack', name: 'Hair Back (后发 摇动)', min: -1, max: 1, default: 0, group_id: 'group_hair' },
    ];

    for (const p of standardParams) {
      if (!draft.parameters.some((param) => param.id === p.id)) {
        draft.parameters.push({ ...p, repeats: false, locked: false });
      }
    }
  });

  bus.register<{ id: string }>('parameter_group.delete', (draft, { id }) => {
    if (draft.parameter_groups) {
      draft.parameter_groups = draft.parameter_groups.filter((g) => g.id !== id);
    }
    for (const p of draft.parameters) {
      if (p.group_id === id) p.group_id = undefined;
    }
  });

  bus.register<{ id: string }>('parameter_group.toggle_collapse', (draft, { id }) => {
    const group = draft.parameter_groups?.find((g) => g.id === id);
    if (group) {
      group.collapsed = !group.collapsed;
    }
  });

  bus.register<{ param_id: string; group_id: string | null }>('parameter.set_group', (draft, { param_id, group_id }) => {
    const p = draft.parameters.find((param) => param.id === param_id);
    if (p) {
      p.group_id = group_id || undefined;
    }
  });

  bus.register<{ param_id: string; target_index: number }>('parameter.reorder', (draft, { param_id, target_index }) => {
    const idx = draft.parameters.findIndex((p) => p.id === param_id);
    if (idx >= 0) {
      const [p] = draft.parameters.splice(idx, 1);
      const clamped = Math.max(0, Math.min(draft.parameters.length, target_index));
      draft.parameters.splice(clamped, 0, p);
    }
  });

  bus.register<{ param_id: string; locked: boolean }>('parameter.set_locked', (draft, { param_id, locked }) => {
    const p = draft.parameters.find((param) => param.id === param_id);
    if (p) {
      p.locked = locked;
    }
  });

  bus.register<{ group_id: string; locked: boolean }>('parameter_group.set_all_locked', (draft, { group_id, locked }) => {
    for (const p of draft.parameters) {
      if (p.group_id === group_id) {
        p.locked = locked;
      }
    }
  });

  bus.register<{ group_id: string; param_ids: string[] }>('parameter_group.assign_parameters', (draft, { group_id, param_ids }) => {
    for (const p of draft.parameters) {
      if (param_ids.includes(p.id)) {
        p.group_id = group_id;
      }
    }
  });

  // Hit Areas & User Data
  bus.register<{ mesh_id: string; hit_area_name: string | null }>('mesh.set_hit_area', (draft, { mesh_id, hit_area_name }) => {
    const node = draft.nodes.find((n) => n.id === mesh_id);
    if (node && node.kind.type === 'ArtMesh') {
      node.kind.hit_area_name = hit_area_name || undefined;
    }
  });

  bus.register<{ mesh_id: string; user_data: string | null }>('mesh.set_user_data', (draft, { mesh_id, user_data }) => {
    const node = draft.nodes.find((n) => n.id === mesh_id);
    if (node && node.kind.type === 'ArtMesh') {
      node.kind.user_data = user_data || undefined;
    }
  });

  // Nodes (Deformers, ArtMeshes, Parts)
  bus.register<Node>('node.add', (draft, node) => {
    if (draft.nodes.some((n) => n.id === node.id)) {
      throw new Error(`Node with ID '${node.id}' already exists`);
    }
    draft.nodes.push(node);
  });

  bus.register<{ id: string; changes: Partial<Omit<Node, 'id' | 'kind'>> }>('node.update', (draft, { id, changes }) => {
    const target = draft.nodes.find((n) => n.id === id);
    if (!target) {
      throw new Error(`Node '${id}' not found`);
    }
    Object.assign(target, changes);
  });

  bus.register<{ id: string; parent_id: string | null }>('node.reparent', (draft, { id, parent_id }) => {
    const target = draft.nodes.find((n) => n.id === id);
    if (!target) {
      throw new Error(`Node '${id}' not found`);
    }
    if (parent_id) {
      if (parent_id === id) {
        throw new Error('A node cannot be parented to itself');
      }
      let curr: string | null | undefined = parent_id;
      const visited = new Set<string>();
      while (curr) {
        if (curr === id) {
          throw new Error(`Hierarchy cycle detected: node '${parent_id}' is a descendant of '${id}'`);
        }
        if (visited.has(curr)) break;
        visited.add(curr);
        const pNode = draft.nodes.find((n) => n.id === curr);
        curr = pNode ? pNode.parent_id : null;
      }
    }
    target.parent_id = parent_id;
  });

  bus.register<{ id: string }>('node.delete', (draft, { id }) => {
    // Reparent direct children to deleted node's parent
    const target = draft.nodes.find((n) => n.id === id);
    const parentOfDeleted = target ? target.parent_id : null;
    for (const child of draft.nodes) {
      if (child.parent_id === id) {
        child.parent_id = parentOfDeleted;
      }
    }
    draft.nodes = draft.nodes.filter((n) => n.id !== id);
    draft.keyforms = draft.keyforms.filter((k) => k.target_node_id !== id);
  });

  bus.register<{ node_id: string; target_index: number }>('node.reorder', (draft, { node_id, target_index }) => {
    const idx = draft.nodes.findIndex((n) => n.id === node_id);
    if (idx >= 0) {
      const [n] = draft.nodes.splice(idx, 1);
      const clamped = Math.max(0, Math.min(draft.nodes.length, target_index));
      draft.nodes.splice(clamped, 0, n);
    }
  });

  // Keyforms
  bus.register<KeyformBinding>('keyform.set', (draft, binding) => {
    const existingIdx = draft.keyforms.findIndex((k) => k.target_node_id === binding.target_node_id);
    if (existingIdx >= 0) {
      draft.keyforms[existingIdx] = binding;
    } else {
      draft.keyforms.push(binding);
    }
  });

  bus.register<{ target_node_id: string }>('keyform.delete', (draft, { target_node_id }) => {
    draft.keyforms = draft.keyforms.filter((k) => k.target_node_id !== target_node_id);
  });

  // Keyform Horizontal Reflection / Mirroring
  bus.register<{
    target_node_id: string;
    param_id: string;
    source_key: number;
    dest_key: number;
  }>('keyform.reflect_horizontal', (draft, params) => {
    const binding = draft.keyforms.find((k) => k.target_node_id === params.target_node_id);
    if (!binding) {
      throw new Error(`Keyform binding for node '${params.target_node_id}' not found`);
    }
    const dimIdx = binding.dimensions.findIndex((d) => d.param_id === params.param_id);
    if (dimIdx < 0) {
      throw new Error(`Parameter dimension '${params.param_id}' not found on keyform`);
    }

    // Ensure dest_key is listed in keys
    const dim = binding.dimensions[dimIdx];
    if (!dim.keys.includes(params.dest_key)) {
      dim.keys.push(params.dest_key);
      dim.keys.sort((a, b) => a - b);
    }

    // Find state at source_key
    const sourceState = binding.keyforms.find((s) => Math.abs(s.coordinates[dimIdx] - params.source_key) < 1e-4);
    if (!sourceState) {
      throw new Error(`Keyform state at source key ${params.source_key} not found`);
    }

    // Compute mirrored payload
    const targetNode = draft.nodes.find((n) => n.id === params.target_node_id);
    let reflectedPayload = JSON.parse(JSON.stringify(sourceState.payload));

    if (reflectedPayload.kind === 'Warp') {
      const bounds = targetNode?.kind.type === 'WarpDeformer' ? targetNode.kind.bounds : [0, 0, 1000, 1000];
      const centerX = bounds[0] + bounds[2] / 2;
      reflectedPayload.control_points = reflectedPayload.control_points.map(([cx, cy]: [number, number]) => [
        2 * centerX - cx,
        cy,
      ]);
    } else if (reflectedPayload.kind === 'Rotation') {
      reflectedPayload.angle_deg = -reflectedPayload.angle_deg;
    } else if (reflectedPayload.kind === 'ArtMesh') {
      reflectedPayload.vertex_offsets = reflectedPayload.vertex_offsets.map(([dx, dy]: [number, number]) => [
        -dx,
        dy,
      ]);
    }

    const destCoords = [...sourceState.coordinates];
    destCoords[dimIdx] = params.dest_key;

    const destIdx = binding.keyforms.findIndex((s) => Math.abs(s.coordinates[dimIdx] - params.dest_key) < 1e-4);
    if (destIdx >= 0) {
      binding.keyforms[destIdx].payload = reflectedPayload;
    } else {
      binding.keyforms.push({
        coordinates: destCoords,
        payload: reflectedPayload,
      });
    }
  });


  // Keyform Quick Setup Points (2-point or 3-point keyform generation)
  bus.register<{
    target_node_id: string;
    param_id: string;
    point_count: 2 | 3;
  }>('keyform.setup_points', (draft, { target_node_id, param_id, point_count }) => {
    const param = draft.parameters.find((p) => p.id === param_id);
    if (!param) throw new Error(`Parameter '${param_id}' not found`);

    const node = draft.nodes.find((n) => n.id === target_node_id);
    if (!node) throw new Error(`Node '${target_node_id}' not found`);

    const keys = point_count === 2
      ? [param.min, param.max]
      : [param.min, param.default, param.max];

    let basePayload: any;
    if (node.kind.type === 'WarpDeformer') {
      basePayload = { kind: 'Warp', control_points: node.kind.control_points };
    } else if (node.kind.type === 'RotationDeformer') {
      basePayload = { kind: 'Rotation', origin: node.kind.origin, angle_deg: node.kind.angle_deg, scale: node.kind.scale };
    } else if (node.kind.type === 'ArtMesh') {
      basePayload = { kind: 'ArtMesh', vertex_offsets: node.kind.vertices.map(() => [0, 0]), opacity: node.kind.opacity };
    } else if (node.kind.type === 'DeformPath') {
      basePayload = { kind: 'DeformPath', control_points: node.kind.control_points };
    }

    const keyforms = keys.map((k) => ({
      coordinates: [k],
      payload: JSON.parse(JSON.stringify(basePayload)),
    }));

    const binding = {
      target_node_id,
      dimensions: [{ param_id, keys }],
      keyforms,
    };

    const existingIdx = draft.keyforms.findIndex((k) => k.target_node_id === target_node_id);
    if (existingIdx >= 0) {
      draft.keyforms[existingIdx] = binding;
    } else {
      draft.keyforms.push(binding);
    }
  });

  // Reverse Mesh Triangle Winding
  bus.register<{ mesh_id: string }>('mesh.reverse_winding', (draft, { mesh_id }) => {
    const target = draft.nodes.find((n) => n.id === mesh_id);
    if (target && target.kind.type === 'ArtMesh') {
      const indices = target.kind.indices;
      for (let i = 0; i < indices.length; i += 3) {
        const tmp = indices[i + 1];
        indices[i + 1] = indices[i + 2];
        indices[i + 2] = tmp;
      }
    }
  });

  // Textures
  bus.register<TextureMeta>('texture.add', (draft, texture) => {
    if (!draft.textures.some((t) => t.id === texture.id)) {
      draft.textures.push(texture);
    }
  });

  // Glue
  bus.register<any>('glue.add', (draft, glue) => {
    if (!draft.glues) draft.glues = [];
    draft.glues = draft.glues.filter((g) => g.id !== glue.id);
    draft.glues.push(glue);
  });

  bus.register<{ id: string }>('glue.delete', (draft, { id }) => {
    if (draft.glues) {
      draft.glues = draft.glues.filter((g) => g.id !== id);
    }
  });

  bus.register<{
    glue_id: string;
    threshold?: number;
  }>('glue.auto_bind_pairs', (draft, { glue_id, threshold = 15 }) => {
    const glue = draft.glues?.find((g) => g.id === glue_id);
    if (!glue) return;

    const nodeA = draft.nodes.find((n) => n.id === glue.mesh_a_id);
    const nodeB = draft.nodes.find((n) => n.id === glue.mesh_b_id);
    if (!nodeA || !nodeB || nodeA.kind.type !== 'ArtMesh' || nodeB.kind.type !== 'ArtMesh') return;

    const vertsA = nodeA.kind.vertices;
    const vertsB = nodeB.kind.vertices;
    const pairs: any[] = [];

    for (let i = 0; i < vertsA.length; i++) {
      const pa = vertsA[i];
      let bestJ = -1;
      let bestDist = threshold;

      for (let j = 0; j < vertsB.length; j++) {
        const pb = vertsB[j];
        const dist = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestJ = j;
        }
      }

      if (bestJ >= 0) {
        pairs.push({
          index_a: i,
          index_b: bestJ,
          weight_a: 0.5,
          weight_b: 0.5,
        });
      }
    }

    glue.vertex_pairs = pairs;
  });

  // Morph Targets / BlendShapes
  bus.register<{
    mesh_id: string;
    morph: any;
  }>('mesh.add_morph_target', (draft, { mesh_id, morph }) => {
    const target = draft.nodes.find((n) => n.id === mesh_id);
    if (target && target.kind.type === 'ArtMesh') {
      if (!target.kind.morph_targets) target.kind.morph_targets = [];
      target.kind.morph_targets = target.kind.morph_targets.filter((m) => m.id !== morph.id);
      target.kind.morph_targets.push(morph);
    }
  });

  bus.register<{
    mesh_id: string;
    morph_id: string;
  }>('mesh.remove_morph_target', (draft, { mesh_id, morph_id }) => {
    const target = draft.nodes.find((n) => n.id === mesh_id);
    if (target && target.kind.type === 'ArtMesh' && target.kind.morph_targets) {
      target.kind.morph_targets = target.kind.morph_targets.filter((m) => m.id !== morph_id);
    }
  });

  // Physics
  bus.register<any>('physics.add_group', (draft, group) => {
    if (!draft.physics) draft.physics = [];
    draft.physics = draft.physics.filter((p) => p.id !== group.id);
    draft.physics.push(group);
  });

  bus.register<{ id: string }>('physics.delete_group', (draft, { id }) => {
    if (draft.physics) {
      draft.physics = draft.physics.filter((p) => p.id !== id);
    }
  });

  // Pose Groups
  bus.register<any>('pose.add_group', (draft, group) => {
    if (!draft.pose_groups) draft.pose_groups = [];
    draft.pose_groups = draft.pose_groups.filter((g) => g.id !== group.id);
    draft.pose_groups.push(group);
  });

  bus.register<{ id: string }>('pose.delete_group', (draft, { id }) => {
    if (draft.pose_groups) {
      draft.pose_groups = draft.pose_groups.filter((g) => g.id !== id);
    }
  });

  // Expressions
  bus.register<any>('expression.add', (draft, expr) => {
    if (!draft.expressions) draft.expressions = [];
    draft.expressions = draft.expressions.filter((e) => e.id !== expr.id);
    draft.expressions.push(expr);
  });

  bus.register<{ id: string }>('expression.delete', (draft, { id }) => {
    if (draft.expressions) {
      draft.expressions = draft.expressions.filter((e) => e.id !== id);
    }
  });

  // Animations / Timeline
  bus.register<any>('animation.add', (draft, anim) => {
    if (!draft.animations) draft.animations = [];
    draft.animations = draft.animations.filter((a) => a.id !== anim.id);
    draft.animations.push(anim);
  });

  bus.register<{ id: string }>('animation.delete', (draft, { id }) => {
    if (draft.animations) {
      draft.animations = draft.animations.filter((a) => a.id !== id);
    }
  });

  bus.register<{
    animation_id: string;
    param_id: string;
    frame: number;
    value: number;
    curve?: 'linear' | 'stepped' | 'bezier';
  }>('animation.set_keyframe', (draft, params) => {
    if (!draft.animations) draft.animations = [];
    let anim = draft.animations.find((a) => a.id === params.animation_id);
    if (!anim) {
      anim = {
        id: params.animation_id,
        name: 'Motion 1',
        duration_frames: 60,
        fps: 30,
        loop_playback: true,
        tracks: [],
      };
      draft.animations.push(anim);
    }
    let track = anim.tracks.find((t) => t.target_param_id === params.param_id);
    if (!track) {
      track = { target_param_id: params.param_id, keyframes: [] };
      anim.tracks.push(track);
    }
    const existingIdx = track.keyframes.findIndex((k) => Math.abs(k.frame - params.frame) < 1e-4);
    const kf = {
      frame: params.frame,
      value: params.value,
      curve: params.curve || 'linear',
    };
    if (existingIdx >= 0) {
      track.keyframes[existingIdx] = kf;
    } else {
      track.keyframes.push(kf);
      track.keyframes.sort((a, b) => a.frame - b.frame);
    }
  });

  // Interactive Mesh Editing
  bus.register<{
    mesh_id: string;
    vertex: [number, number];
    uv: [number, number];
  }>('mesh.add_vertex', (draft, { mesh_id, vertex, uv }) => {
    const target = draft.nodes.find((n) => n.id === mesh_id);
    if (target && target.kind.type === 'ArtMesh') {
      target.kind.vertices.push(vertex);
      target.kind.uvs.push(uv);
    }
  });

  bus.register<{
    mesh_id: string;
    vertex_index: number;
    position: [number, number];
  }>('mesh.move_vertex', (draft, { mesh_id, vertex_index, position }) => {
    const target = draft.nodes.find((n) => n.id === mesh_id);
    if (target && target.kind.type === 'ArtMesh' && vertex_index < target.kind.vertices.length) {
      target.kind.vertices[vertex_index] = position;
    }
  });

  bus.register<{
    mesh_id: string;
    vertex_index: number;
  }>('mesh.delete_vertex', (draft, { mesh_id, vertex_index }) => {
    const target = draft.nodes.find((n) => n.id === mesh_id);
    if (target && target.kind.type === 'ArtMesh' && vertex_index < target.kind.vertices.length) {
      target.kind.vertices.splice(vertex_index, 1);
      target.kind.uvs.splice(vertex_index, 1);
      // Remove triangles touching this vertex and re-index
      const newIndices: number[] = [];
      for (let i = 0; i < target.kind.indices.length; i += 3) {
        const i0 = target.kind.indices[i];
        const i1 = target.kind.indices[i + 1];
        const i2 = target.kind.indices[i + 2];
        if (i0 !== vertex_index && i1 !== vertex_index && i2 !== vertex_index) {
          newIndices.push(
            i0 > vertex_index ? i0 - 1 : i0,
            i1 > vertex_index ? i1 - 1 : i1,
            i2 > vertex_index ? i2 - 1 : i2
          );
        }
      }
      target.kind.indices = newIndices;
    }
  });


  bus.register<{
    mesh_id: string;
  }>('mesh.subdivide', (draft, { mesh_id }) => {
    const target = draft.nodes.find((n) => n.id === mesh_id);
    if (!target || target.kind.type !== 'ArtMesh') return;

    const vertices = target.kind.vertices;
    const uvs = target.kind.uvs;
    const indices = target.kind.indices;

    const edgeMap = new Map<string, number>();

    const getMidpoint = (idxA: number, idxB: number): number => {
      const key = idxA < idxB ? `${idxA}_${idxB}` : `${idxB}_${idxA}`;
      if (edgeMap.has(key)) {
        return edgeMap.get(key)!;
      }
      const pa = vertices[idxA];
      const pb = vertices[idxB];
      const midPos: [number, number] = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];

      const uva = uvs[idxA];
      const uvb = uvs[idxB];
      const midUv: [number, number] = [(uva[0] + uvb[0]) / 2, (uva[1] + uvb[1]) / 2];

      const newIdx = vertices.length;
      vertices.push(midPos);
      uvs.push(midUv);
      edgeMap.set(key, newIdx);
      return newIdx;
    };

    const newIndices: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      const m01 = getMidpoint(i0, i1);
      const m12 = getMidpoint(i1, i2);
      const m20 = getMidpoint(i2, i0);

      newIndices.push(i0, m01, m20);
      newIndices.push(m01, i1, m12);
      newIndices.push(m20, m12, i2);
      newIndices.push(m01, m12, m20);
    }

    target.kind.indices = newIndices;
  });

  bus.register<{
    node_id: string;
    cols: number;
    rows: number;
  }>('warp.set_divisions', (draft, { node_id, cols, rows }) => {
    const target = draft.nodes.find((n) => n.id === node_id);
    if (!target || target.kind.type !== 'WarpDeformer') return;

    const [bx, by, bw, bh] = target.kind.bounds;
    const nextCps: [number, number][] = [];

    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const y = by + bh * v;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const x = bx + bw * u;
        nextCps.push([x, y]);
      }
    }

    target.kind.cols = cols;
    target.kind.rows = rows;
    target.kind.control_points = nextCps;
  });

  bus.register<{
    mesh_id: string;
    axis: 'horizontal' | 'vertical';
  }>('mesh.flip_uv', (draft, { mesh_id, axis }) => {
    const target = draft.nodes.find((n) => n.id === mesh_id);
    if (target && target.kind.type === 'ArtMesh') {
      for (const uv of target.kind.uvs) {
        if (axis === 'horizontal') {
          uv[0] = 1.0 - uv[0];
        } else {
          uv[1] = 1.0 - uv[1];
        }
      }
    }
  });

  // Deform Path
  bus.register<{
    id: string;
    name: string;
    control_points: [number, number][];
    target_mesh_ids: string[];
    parent_id?: string | null;
  }>('deform_path.create', (draft, params) => {
    draft.nodes.push({
      id: params.id,
      name: params.name,
      parent_id: params.parent_id || null,
      visible: true,
      locked: false,
      kind: {
        type: 'DeformPath',
        control_points: params.control_points,
        target_mesh_ids: params.target_mesh_ids,
      },
    });
  });

  // Macro: setup_turn_xy (Creates ParamAngleX & ParamAngleY if missing, and binds 3x3 grid keyforms)
  bus.register<{
    target_node_id: string;
    param_x_id?: string;
    param_y_id?: string;
    x_range?: [number, number];
    y_range?: [number, number];
  }>('macro.setup_turn_xy', (draft, params) => {
    const paramX = params.param_x_id || 'ParamAngleX';
    const paramY = params.param_y_id || 'ParamAngleY';
    const xMin = params.x_range ? params.x_range[0] : -30;
    const xMax = params.x_range ? params.x_range[1] : 30;
    const yMin = params.y_range ? params.y_range[0] : -30;
    const yMax = params.y_range ? params.y_range[1] : 30;

    // Ensure parameters exist
    if (!draft.parameters.some((p) => p.id === paramX)) {
      draft.parameters.push({ id: paramX, name: 'Angle X', min: xMin, max: xMax, default: 0 });
    }
    if (!draft.parameters.some((p) => p.id === paramY)) {
      draft.parameters.push({ id: paramY, name: 'Angle Y', min: yMin, max: yMax, default: 0 });
    }

    const targetNode = draft.nodes.find((n) => n.id === params.target_node_id);
    if (!targetNode) {
      throw new Error(`Target node '${params.target_node_id}' not found`);
    }

    // Build 3x3 keyform grid
    const xKeys = [xMin, 0, xMax];
    const yKeys = [yMin, 0, yMax];
    const keyformStates: KeyformBinding['keyforms'] = [];

    if (targetNode.kind.type === 'WarpDeformer') {
      const defaultCps = targetNode.kind.control_points;
      for (const y of yKeys) {
        for (const x of xKeys) {
          // Simple perspective projection shift as initial default for AngleX/Y
          const shiftedCps = defaultCps.map(([cx, cy]): [number, number] => {
            const shiftX = (x / (xMax || 1)) * 15;
            const shiftY = (y / (yMax || 1)) * 15;
            return [cx + shiftX, cy + shiftY];
          });
          keyformStates.push({
            coordinates: [x, y],
            payload: { kind: 'Warp', control_points: shiftedCps },
          });
        }
      }
    } else if (targetNode.kind.type === 'RotationDeformer') {
      const origin = targetNode.kind.origin;
      for (const y of yKeys) {
        for (const x of xKeys) {
          keyformStates.push({
            coordinates: [x, y],
            payload: {
              kind: 'Rotation',
              origin,
              angle_deg: targetNode.kind.angle_deg + x * 0.5,
              scale: targetNode.kind.scale,
            },
          });
        }
      }
    }

    const binding: KeyformBinding = {
      target_node_id: params.target_node_id,
      dimensions: [
        { param_id: paramX, keys: xKeys },
        { param_id: paramY, keys: yKeys },
      ],
      keyforms: keyformStates,
    };

    const idx = draft.keyforms.findIndex((k) => k.target_node_id === params.target_node_id);
    if (idx >= 0) {
      draft.keyforms[idx] = binding;
    } else {
      draft.keyforms.push(binding);
    }
  });

  // Macro: auto_rig (Scans ArtMeshes, categorizes layers by semantics, builds standard deformer tree & keyforms)
  bus.register<any>('macro.auto_rig', (draft) => {
    const artMeshes = draft.nodes.filter((n) => n.kind.type === 'ArtMesh');
    if (artMeshes.length === 0) return;

    // Helper: compute bounding box of meshes matching filter
    const getMeshBounds = (filter: (name: string) => boolean): [number, number, number, number] | null => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let count = 0;
      for (const m of artMeshes) {
        if (filter(m.name.toLowerCase() + ' ' + m.id.toLowerCase())) {
          count++;
          if (m.kind.type === 'ArtMesh') {
            for (const [vx, vy] of m.kind.vertices) {
              if (vx < minX) minX = vx;
              if (vx > maxX) maxX = vx;
              if (vy < minY) minY = vy;
              if (vy > maxY) maxY = vy;
            }
          }
        }
      }
      if (count === 0 || minX === Infinity) return null;
      const pad = 20;
      return [minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2];
    };

    const genPoints = (cols: number, rows: number, bounds: [number, number, number, number]): [number, number][] => {
      const [bx, by, bw, bh] = bounds;
      const pts: [number, number][] = [];
      for (let r = 0; r <= rows; r++) {
        const y = by + (bh * r) / rows;
        for (let c = 0; c <= cols; c++) {
          const x = bx + (bw * c) / cols;
          pts.push([x, y]);
        }
      }
      return pts;
    };

    // 1. Head Warp enclosing everything
    let headBounds = getMeshBounds(() => true) || [600, 200, 720, 800];
    const headWarpId = 'warp_head';
    if (!draft.nodes.some((n) => n.id === headWarpId)) {
      draft.nodes.unshift({
        id: headWarpId,
        name: 'Head Warp',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'WarpDeformer',
          cols: 4,
          rows: 4,
          bounds: headBounds,
          control_points: genPoints(4, 4, headBounds),
          bezier_smooth: true,
        },
      });
    }

    // 2. Specialized sub-warp deformers
    const categories = [
      { id: 'warp_face', name: 'Face Warp', cols: 3, rows: 3, regex: /face|cheek|chin|head_base|脸|顔/i },
      { id: 'warp_eye_l', name: 'Eye Left Warp', cols: 2, rows: 2, regex: /eye.*l|l.*eye|左眼/i },
      { id: 'warp_eye_r', name: 'Eye Right Warp', cols: 2, rows: 2, regex: /eye.*r|r.*eye|右眼/i },
      { id: 'warp_mouth', name: 'Mouth Warp', cols: 2, rows: 2, regex: /mouth|lip|teeth|tongue|嘴/i },
      { id: 'warp_hair_front', name: 'Hair Front Warp', cols: 3, rows: 3, regex: /hair.*front|front.*hair|前发|前髪/i },
    ];

    for (const cat of categories) {
      const bounds = getMeshBounds((str) => cat.regex.test(str));
      if (bounds) {
        if (!draft.nodes.some((n) => n.id === cat.id)) {
          draft.nodes.push({
            id: cat.id,
            name: cat.name,
            parent_id: headWarpId,
            visible: true,
            locked: false,
            kind: {
              type: 'WarpDeformer',
              cols: cat.cols,
              rows: cat.rows,
              bounds,
              control_points: genPoints(cat.cols, cat.rows, bounds),
              bezier_smooth: true,
            },
          });
        }
      }
    }

    // 3. Reparent ArtMeshes into matching deformers
    for (const mesh of artMeshes) {
      const name = (mesh.name + ' ' + mesh.id).toLowerCase();
      let assigned = false;
      for (const cat of categories) {
        if (cat.regex.test(name) && draft.nodes.some((n) => n.id === cat.id)) {
          mesh.parent_id = cat.id;
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        mesh.parent_id = headWarpId;
      }
    }

    // 4. Setup Turn XY on Head Warp
    const busDummy = { draft };
    const setupTurnFn = (bus as any).handlers.get('macro.setup_turn_xy');
    if (setupTurnFn) {
      setupTurnFn(draft, { target_node_id: headWarpId });
    }
  });


  // Warp Soft-Selection Brush Tool
  bus.register<{
    node_id: string;
    center: [number, number];
    delta: [number, number];
    radius: number;
  }>('warp.brush_deform', (draft, { node_id, center, delta, radius }) => {
    const target = draft.nodes.find((n) => n.id === node_id);
    if (!target || target.kind.type !== 'WarpDeformer') return;

    const cps = target.kind.control_points;
    for (let i = 0; i < cps.length; i++) {
      const [cx, cy] = cps[i];
      const dist = Math.hypot(cx - center[0], cy - center[1]);
      if (dist < radius) {
        const t = dist / radius;
        const factor = Math.cos((t * Math.PI) / 2);
        cps[i] = [cx + delta[0] * factor, cy + delta[1] * factor];
      }
    }
  });

  // Parameter Keys Inversion
  bus.register<{
    param_id: string;
  }>('parameter.invert_keys', (draft, { param_id }) => {
    for (const kf of draft.keyforms) {
      const dimIdx = kf.dimensions.findIndex((d) => d.param_id === param_id);
      if (dimIdx >= 0) {
        for (const s of kf.keyforms) {
          s.coordinates[dimIdx] = -s.coordinates[dimIdx];
        }
        kf.dimensions[dimIdx].keys = kf.dimensions[dimIdx].keys.map((k) => -k).sort((a, b) => a - b);
      }
    }
  });


  // Parameter Swap Keys (swaps shape states between two parameter key values)
  bus.register<{
    param_id: string;
    key_a: number;
    key_b: number;
  }>('parameter.swap_keys', (draft, { param_id, key_a, key_b }) => {
    for (const kf of draft.keyforms) {
      const dimIdx = kf.dimensions.findIndex((d) => d.param_id === param_id);
      if (dimIdx >= 0) {
        const stateA = kf.keyforms.find((s) => Math.abs(s.coordinates[dimIdx] - key_a) < 1e-4);
        const stateB = kf.keyforms.find((s) => Math.abs(s.coordinates[dimIdx] - key_b) < 1e-4);
        if (stateA && stateB) {
          const tmpPayload = stateA.payload;
          stateA.payload = stateB.payload;
          stateB.payload = tmpPayload;
        }
      }
    }
  });

  // Create Enclosing Warp Deformer fitted around an ArtMesh
  bus.register<{
    mesh_id: string;
    cols?: number;
    rows?: number;
    padding?: number;
  }>('warp.create_enclosing_mesh', (draft, { mesh_id, cols = 3, rows = 3, padding = 15 }) => {
    const mesh = draft.nodes.find((n) => n.id === mesh_id);
    if (!mesh || mesh.kind.type !== 'ArtMesh') return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [vx, vy] of mesh.kind.vertices) {
      if (vx < minX) minX = vx;
      if (vx > maxX) maxX = vx;
      if (vy < minY) minY = vy;
      if (vy > maxY) maxY = vy;
    }

    const bounds: [number, number, number, number] = [
      minX - padding,
      minY - padding,
      (maxX - minX) + padding * 2,
      (maxY - minY) + padding * 2,
    ];

    const [bx, by, bw, bh] = bounds;
    const cps: [number, number][] = [];
    for (let r = 0; r <= rows; r++) {
      const y = by + (bh * r) / rows;
      for (let c = 0; c <= cols; c++) {
        const x = bx + (bw * c) / cols;
        cps.push([x, y]);
      }
    }

    const warpId = `warp_${mesh.id}`;
    const warpNode: any = {
      id: warpId,
      name: `${mesh.name || mesh.id} Warp`,
      parent_id: mesh.parent_id,
      visible: true,
      locked: false,
      kind: {
        type: 'WarpDeformer',
        cols,
        rows,
        bounds,
        control_points: cps,
        bezier_smooth: true,
      },
    };

    draft.nodes.push(warpNode);
    mesh.parent_id = warpId;
  });

}
