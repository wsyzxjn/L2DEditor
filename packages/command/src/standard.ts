import {
  evaluateAnimationAtFrameJs,
  getMeshBoundaryLoops,
  generateStrokeMeshTopology,
  type ModelingTemplate,
  PhysicsSimulatorJs,
  transformPointsByFreeQuad,
  type ArtPathPoint,
  type KeyformBinding,
  type KeyformPayload,
  type Node,
  type Parameter,
  type PhysicsInput,
  type PhysicsPendulum,
  type Project,
  type TextureMeta,
} from '@l2d/schema';
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


  bus.register<{ parent_id: string; visible: boolean }>('node.set_children_visible', (draft, { parent_id, visible }) => {
    for (const child of draft.nodes) {
      if (child.parent_id === parent_id) {
        child.visible = visible;
      }
    }
  });

  bus.register<{ parent_id: string; locked: boolean }>('node.set_children_locked', (draft, { parent_id, locked }) => {
    for (const child of draft.nodes) {
      if (child.parent_id === parent_id) {
        child.locked = locked;
      }
    }
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
    if ((binding as any).coordinates && (binding as any).payload) {
      const targetId = (binding as any).target_node_id;
      const coords = (binding as any).coordinates as number[];
      let existing = draft.keyforms.find((k) => k.target_node_id === targetId);
      if (!existing) {
        existing = { target_node_id: targetId, dimensions: [], keyforms: [] };
        draft.keyforms.push(existing);
      }
      const stateIdx = existing.keyforms.findIndex(
        (s) => s.coordinates.length === coords.length && s.coordinates.every((c, i) => Math.abs(c - coords[i]) < 1e-4)
      );
      const newState = { coordinates: coords, payload: (binding as any).payload };
      if (stateIdx >= 0) existing.keyforms[stateIdx] = newState;
      else existing.keyforms.push(newState);
      return;
    }
    const existingIdx = draft.keyforms.findIndex((k) => k.target_node_id === binding.target_node_id);
    if (existingIdx >= 0) {
      draft.keyforms[existingIdx] = binding;
    } else {
      draft.keyforms.push(binding);
    }
  });

  bus.register<{
    target_node_id: string;
    dimensions: any[];
  }>('keyform.bind', (draft, { target_node_id, dimensions }) => {
    let existing = draft.keyforms.find((k) => k.target_node_id === target_node_id);
    if (!existing) {
      existing = { target_node_id, dimensions, keyforms: [] };
      draft.keyforms.push(existing);
    } else {
      existing.dimensions = dimensions;
    }
  });

  bus.register<{ target_node_id: string }>('keyform.delete', (draft, { target_node_id }) => {
    draft.keyforms = draft.keyforms.filter((k) => k.target_node_id !== target_node_id);
  });


  // Keyform Shape Copy and Paste (with optional horizontal mirror reflection)
  bus.register<{
    target_node_id: string;
    source_coords: number[];
    dest_coords: number[];
    mirror_x?: boolean;
  }>('keyform.copy_paste', (draft, { target_node_id, source_coords, dest_coords, mirror_x }) => {
    const binding = draft.keyforms.find((k) => k.target_node_id === target_node_id);
    if (!binding) throw new Error(`Keyform binding for node '${target_node_id}' not found`);

    const sourceState = binding.keyforms.find((s) =>
      s.coordinates.length === source_coords.length &&
      s.coordinates.every((c, idx) => Math.abs(c - source_coords[idx]) < 1e-4)
    );
    if (!sourceState) throw new Error(`Source keyform state at coordinates ${source_coords} not found`);

    let payload = JSON.parse(JSON.stringify(sourceState.payload));
    if (mirror_x) {
      const targetNode = draft.nodes.find((n) => n.id === target_node_id);
      if (payload.kind === 'Warp') {
        const bounds = targetNode?.kind.type === 'WarpDeformer' ? targetNode.kind.bounds : [0, 0, 1000, 1000];
        const centerX = bounds[0] + bounds[2] / 2;
        payload.control_points = payload.control_points.map(([cx, cy]: [number, number]) => [
          2 * centerX - cx,
          cy,
        ]);
      } else if (payload.kind === 'Rotation') {
        payload.angle_deg = -payload.angle_deg;
      } else if (payload.kind === 'ArtMesh') {
        payload.vertex_offsets = payload.vertex_offsets.map(([dx, dy]: [number, number]) => [
          -dx,
          dy,
        ]);
      }
    }

    const destIdx = binding.keyforms.findIndex((s) =>
      s.coordinates.length === dest_coords.length &&
      s.coordinates.every((c, idx) => Math.abs(c - dest_coords[idx]) < 1e-4)
    );

    if (destIdx >= 0) {
      binding.keyforms[destIdx].payload = payload;
    } else {
      binding.keyforms.push({
        coordinates: dest_coords,
        payload,
      });
    }
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

  bus.register<{ id: string; changes: Partial<Omit<TextureMeta, 'id'>> }>('texture.update', (draft, { id, changes }) => {
    const target = draft.textures.find((t) => t.id === id);
    if (!target) {
      throw new Error(`Texture '${id}' not found`);
    }
    Object.assign(target, changes);
  });

  // 10. Multi-State / Sprite Swap Automation (Pose Switch & State Blending)
  bus.register<{
    base_node_id: string;
    param_id: string;
    states: Array<{
      value: number;
      texture_id: string;
      node_id?: string;
      name?: string;
      draw_order?: number;
    }>;
  }>('macro.sprite_swap', (draft, { base_node_id, param_id, states }) => {
    const baseNode = draft.nodes.find((n) => n.id === base_node_id);
    if (!baseNode || baseNode.kind.type !== 'ArtMesh') {
      throw new Error(`Base node '${base_node_id}' must be an existing ArtMesh`);
    }

    if (!states || states.length === 0) {
      throw new Error('Sprite swap requires at least one state');
    }

    const baseMesh = baseNode.kind;
    const sortedStates = [...states].sort((a, b) => a.value - b.value);
    const keys = sortedStates.map((s) => s.value);

    for (const state of sortedStates) {
      const isBaseState = state.texture_id === baseMesh.texture_id || state.node_id === base_node_id;
      const targetId = state.node_id || (isBaseState ? base_node_id : `${base_node_id}_state_${state.value}`);

      let targetNode = draft.nodes.find((n) => n.id === targetId);
      if (!targetNode) {
        targetNode = {
          id: targetId,
          name: state.name || `${baseNode.name} (${param_id}=${state.value})`,
          parent_id: baseNode.parent_id,
          visible: true,
          locked: false,
          kind: {
            ...JSON.parse(JSON.stringify(baseMesh)),
            texture_id: state.texture_id,
            draw_order: state.draw_order ?? baseMesh.draw_order,
            opacity: 1,
          },
        };
        draft.nodes.push(targetNode);
      } else if (targetNode.kind.type === 'ArtMesh') {
        targetNode.kind.texture_id = state.texture_id;
        if (state.draw_order !== undefined) targetNode.kind.draw_order = state.draw_order;
      }

      let kfBinding = draft.keyforms.find((k) => k.target_node_id === targetId);
      if (!kfBinding) {
        const newBinding: KeyformBinding = {
          target_node_id: targetId,
          dimensions: [{ param_id, keys }],
          keyforms: [],
        };
        draft.keyforms.push(newBinding);
        kfBinding = newBinding;
      } else {
        kfBinding.dimensions = [{ param_id, keys }];
        kfBinding.keyforms = [];
      }

      const verts = (targetNode.kind as any).vertices as [number, number][];
      const zeroOffsets = verts ? verts.map(() => [0, 0] as [number, number]) : [];

      for (const k of keys) {
        const isCurrentState = Math.abs(k - state.value) < 1e-4;
        kfBinding.keyforms.push({
          coordinates: [k],
          payload: {
            kind: 'ArtMesh',
            opacity: isCurrentState ? 1 : 0,
            vertex_offsets: zeroOffsets,
          },
        });
      }
    }
  });

  // Glue
  bus.register<any>('glue.add', (draft, glue) => {
    if (!draft.glues) draft.glues = [];
    draft.glues = draft.glues.filter((g) => g.id !== glue.id);
    draft.glues.push(glue);
  });

  bus.register<any>('glue.bind', (draft, glue) => {
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

  // ============================================================================
  // Cubism 5.3 Deep Alignment Commands
  // ============================================================================

  // 0. Live Sculpting at Active Parameter Coordinate (`keyform.update_at_params`)
  bus.register<{
    target_node_id: string;
    params: Record<string, number>;
    payload: KeyformPayload;
  }>('keyform.update_at_params', (draft, { target_node_id, params, payload }) => {
    const node = draft.nodes.find((n) => n.id === target_node_id);
    if (!node) return;
    const binding = draft.keyforms.find((k) => k.target_node_id === target_node_id);
    if (!binding || binding.dimensions.length === 0) {
      // Update base rest geometry
      if (node.kind.type === 'WarpDeformer' && payload.kind === 'Warp') {
        node.kind.control_points = payload.control_points;
      } else if (node.kind.type === 'RotationDeformer' && payload.kind === 'Rotation') {
        node.kind.origin = payload.origin;
        node.kind.angle_deg = payload.angle_deg;
        node.kind.scale = payload.scale;
      } else if (node.kind.type === 'DeformPath' && payload.kind === 'DeformPath') {
        node.kind.control_points = payload.control_points;
      } else if (node.kind.type === 'ArtPath' && payload.kind === 'ArtPath') {
        node.kind.points = payload.points;
      }
      return;
    }

    // Snap current parameter values to nearest keys in each bound dimension
    const snappedCoords = binding.dimensions.map((dim) => {
      const def = draft.parameters.find((p) => p.id === dim.param_id)?.default ?? 0;
      const cur = params[dim.param_id] ?? def;
      return dim.keys.reduce((prev, k) => (Math.abs(k - cur) < Math.abs(prev - cur) ? k : prev), dim.keys[0]);
    });

    const existing = binding.keyforms.find(
      (s) =>
        s.coordinates.length === snappedCoords.length &&
        s.coordinates.every((c, idx) => Math.abs(c - snappedCoords[idx]) < 1e-4)
    );
    if (existing) {
      existing.payload = payload;
    } else {
      binding.keyforms.push({
        coordinates: snappedCoords,
        payload,
      });
    }
  });

  // 1. CMD_AUTO_BLEND_4_CORNER (Ctrl+4): 4-Corner Automatic Keyform Synthesis
  bus.register<{
    target_node_id: string;
  }>('keyform.synthesize_corners', (draft, { target_node_id }) => {
    const binding = draft.keyforms.find((k) => k.target_node_id === target_node_id);
    if (!binding || binding.dimensions.length < 2) {
      throw new Error(`Node '${target_node_id}' requires at least 2 bound parameter dimensions for 4-corner synthesis`);
    }
    const dimX = binding.dimensions[0];
    const dimY = binding.dimensions[1];
    const paramX = draft.parameters.find((p) => p.id === dimX.param_id);
    const paramY = draft.parameters.find((p) => p.id === dimY.param_id);

    const defX = paramX?.default ?? 0;
    const defY = paramY?.default ?? 0;
    const centerX = dimX.keys.reduce((prev, curr) => (Math.abs(curr - defX) < Math.abs(prev - defX) ? curr : prev), dimX.keys[0]);
    const centerY = dimY.keys.reduce((prev, curr) => (Math.abs(curr - defY) < Math.abs(prev - defY) ? curr : prev), dimY.keys[0]);

    const findState = (x: number, y: number) =>
      binding.keyforms.find(
        (s) => Math.abs(s.coordinates[0] - x) < 1e-4 && Math.abs(s.coordinates[1] - y) < 1e-4
      );

    const centerState = findState(centerX, centerY);
    if (!centerState) {
      throw new Error(`Center keyform state at (${centerX}, ${centerY}) not found on '${target_node_id}'`);
    }

    for (const kx of dimX.keys) {
      if (Math.abs(kx - centerX) < 1e-4) continue;
      for (const ky of dimY.keys) {
        if (Math.abs(ky - centerY) < 1e-4) continue;
        const stateX = findState(kx, centerY);
        const stateY = findState(centerX, ky);
        if (!stateX || !stateY) continue;

        let cornerPayload: KeyformPayload | null = null;
        if (
          centerState.payload.kind === 'Warp' &&
          stateX.payload.kind === 'Warp' &&
          stateY.payload.kind === 'Warp'
        ) {
          const p0 = centerState.payload.control_points;
          const px = stateX.payload.control_points;
          const py = stateY.payload.control_points;
          cornerPayload = {
            kind: 'Warp',
            control_points: p0.map((c0, idx): [number, number] => [
              c0[0] + ((px[idx]?.[0] ?? c0[0]) - c0[0]) + ((py[idx]?.[0] ?? c0[0]) - c0[0]),
              c0[1] + ((px[idx]?.[1] ?? c0[1]) - c0[1]) + ((py[idx]?.[1] ?? c0[1]) - c0[1]),
            ]),
          };
        } else if (
          centerState.payload.kind === 'Rotation' &&
          stateX.payload.kind === 'Rotation' &&
          stateY.payload.kind === 'Rotation'
        ) {
          const p0 = centerState.payload;
          const px = stateX.payload;
          const py = stateY.payload;
          cornerPayload = {
            kind: 'Rotation',
            origin: [
              p0.origin[0] + (px.origin[0] - p0.origin[0]) + (py.origin[0] - p0.origin[0]),
              p0.origin[1] + (px.origin[1] - p0.origin[1]) + (py.origin[1] - p0.origin[1]),
            ],
            angle_deg: p0.angle_deg + (px.angle_deg - p0.angle_deg) + (py.angle_deg - p0.angle_deg),
            scale: [
              p0.scale[0] + (px.scale[0] - p0.scale[0]) + (py.scale[0] - p0.scale[0]),
              p0.scale[1] + (px.scale[1] - p0.scale[1]) + (py.scale[1] - p0.scale[1]),
            ],
          };
        } else if (
          centerState.payload.kind === 'DeformPath' &&
          stateX.payload.kind === 'DeformPath' &&
          stateY.payload.kind === 'DeformPath'
        ) {
          const p0 = centerState.payload.control_points;
          const px = stateX.payload.control_points;
          const py = stateY.payload.control_points;
          cornerPayload = {
            kind: 'DeformPath',
            control_points: p0.map((c0, idx): [number, number] => [
              c0[0] + ((px[idx]?.[0] ?? c0[0]) - c0[0]) + ((py[idx]?.[0] ?? c0[0]) - c0[0]),
              c0[1] + ((px[idx]?.[1] ?? c0[1]) - c0[1]) + ((py[idx]?.[1] ?? c0[1]) - c0[1]),
            ]),
          };
        } else if (
          centerState.payload.kind === 'ArtPath' &&
          stateX.payload.kind === 'ArtPath' &&
          stateY.payload.kind === 'ArtPath'
        ) {
          const p0 = centerState.payload.points;
          const px = stateX.payload.points;
          const py = stateY.payload.points;
          cornerPayload = {
            kind: 'ArtPath',
            points: p0.map((pt0, idx) => ({
              pos: [
                pt0.pos[0] + ((px[idx]?.pos[0] ?? pt0.pos[0]) - pt0.pos[0]) + ((py[idx]?.pos[0] ?? pt0.pos[0]) - pt0.pos[0]),
                pt0.pos[1] + ((px[idx]?.pos[1] ?? pt0.pos[1]) - pt0.pos[1]) + ((py[idx]?.pos[1] ?? pt0.pos[1]) - pt0.pos[1]),
              ],
              width: pt0.width + ((px[idx]?.width ?? pt0.width) - pt0.width) + ((py[idx]?.width ?? pt0.width) - pt0.width),
              opacity: pt0.opacity,
            })),
          };
        } else if (
          centerState.payload.kind === 'ArtMesh' &&
          stateX.payload.kind === 'ArtMesh' &&
          stateY.payload.kind === 'ArtMesh'
        ) {
          const p0 = centerState.payload.vertex_offsets;
          const px = stateX.payload.vertex_offsets;
          const py = stateY.payload.vertex_offsets;
          cornerPayload = {
            kind: 'ArtMesh',
            vertex_offsets: p0.map((o0, idx): [number, number] => [
              o0[0] + ((px[idx]?.[0] ?? o0[0]) - o0[0]) + ((py[idx]?.[0] ?? o0[0]) - o0[0]),
              o0[1] + ((px[idx]?.[1] ?? o0[1]) - o0[1]) + ((py[idx]?.[1] ?? o0[1]) - o0[1]),
            ]),
            opacity: centerState.payload.opacity,
          };
        }

        if (cornerPayload) {
          const existingCorner = findState(kx, ky);
          if (existingCorner) {
            existingCorner.payload = cornerPayload;
          } else {
            binding.keyforms.push({
              coordinates: [kx, ky],
              payload: cornerPayload,
            });
          }
        }
      }
    }
  });

  // 2. CMD_BLEND_SHAPE (Ctrl+Shift+B) & CMD_RESTORE_ORIGINAL_SHAPE
  bus.register<{
    target_node_id: string;
    source_coords: number[];
    dest_coords: number[];
    weight?: number;
  }>('keyform.blend_shape', (draft, { target_node_id, source_coords, dest_coords, weight = 0.5 }) => {
    const binding = draft.keyforms.find((k) => k.target_node_id === target_node_id);
    if (!binding) throw new Error(`Keyform binding for '${target_node_id}' not found`);
    const src = binding.keyforms.find(
      (s) => s.coordinates.length === source_coords.length && s.coordinates.every((c, i) => Math.abs(c - source_coords[i]) < 1e-4)
    );
    const dst = binding.keyforms.find(
      (s) => s.coordinates.length === dest_coords.length && s.coordinates.every((c, i) => Math.abs(c - dest_coords[i]) < 1e-4)
    );
    if (!src || !dst) throw new Error('Source or destination keyform state not found');
    if (src.payload.kind === 'Warp' && dst.payload.kind === 'Warp') {
      const srcCps = src.payload.control_points;
      dst.payload.control_points = dst.payload.control_points.map((p, i): [number, number] => [
        p[0] * (1 - weight) + (srcCps[i]?.[0] ?? p[0]) * weight,
        p[1] * (1 - weight) + (srcCps[i]?.[1] ?? p[1]) * weight,
      ]);
    } else if (src.payload.kind === 'ArtMesh' && dst.payload.kind === 'ArtMesh') {
      const srcOffs = src.payload.vertex_offsets;
      dst.payload.vertex_offsets = dst.payload.vertex_offsets.map((p, i): [number, number] => [
        p[0] * (1 - weight) + (srcOffs[i]?.[0] ?? p[0]) * weight,
        p[1] * (1 - weight) + (srcOffs[i]?.[1] ?? p[1]) * weight,
      ]);
    } else if (src.payload.kind === 'Rotation' && dst.payload.kind === 'Rotation') {
      dst.payload.angle_deg = dst.payload.angle_deg * (1 - weight) + src.payload.angle_deg * weight;
    }
  });

  bus.register<{
    target_node_id: string;
    coordinates: number[];
  }>('keyform.restore_original_shape', (draft, { target_node_id, coordinates }) => {
    const node = draft.nodes.find((n) => n.id === target_node_id);
    const binding = draft.keyforms.find((k) => k.target_node_id === target_node_id);
    if (!node || !binding) return;
    const st = binding.keyforms.find(
      (s) => s.coordinates.length === coordinates.length && s.coordinates.every((c, i) => Math.abs(c - coordinates[i]) < 1e-4)
    );
    if (!st) return;
    if (node.kind.type === 'WarpDeformer') {
      st.payload = { kind: 'Warp', control_points: JSON.parse(JSON.stringify(node.kind.control_points)) };
    } else if (node.kind.type === 'RotationDeformer') {
      st.payload = {
        kind: 'Rotation',
        origin: [...node.kind.origin],
        angle_deg: node.kind.angle_deg,
        scale: [...node.kind.scale],
      };
    } else if (node.kind.type === 'DeformPath') {
      st.payload = { kind: 'DeformPath', control_points: JSON.parse(JSON.stringify(node.kind.control_points)) };
    } else if (node.kind.type === 'ArtPath') {
      st.payload = { kind: 'ArtPath', points: JSON.parse(JSON.stringify(node.kind.points)) };
    } else if (node.kind.type === 'ArtMesh') {
      st.payload = {
        kind: 'ArtMesh',
        vertex_offsets: node.kind.vertices.map(() => [0, 0]),
        opacity: node.kind.opacity,
      };
    }
  });

  // 3. ArtPath Commands (CMD_CREATE_ART_PATH_INDIVISUALLY, CMD_FIT_ART_MESH_CONTOUR, CMD_EDIT_WIDTH_ART_PATH_CONTROL_POINT_THICKEN/THIN)
  bus.register<{
    id: string;
    name: string;
    points: ArtPathPoint[];
    closed?: boolean;
    color?: [number, number, number, number];
    draw_order?: number;
    parent_id?: string | null;
  }>('art_path.create', (draft, params) => {
    draft.nodes.push({
      id: params.id,
      name: params.name,
      parent_id: params.parent_id ?? null,
      visible: true,
      locked: false,
      kind: {
        type: 'ArtPath',
        points: params.points,
        closed: params.closed ?? false,
        color: params.color ?? [0.15, 0.15, 0.18, 1.0],
        blend_mode: 'normal',
        opacity: 1.0,
        draw_order: params.draw_order ?? 100,
        mask_ids: [],
        is_mask_inverted: false,
      },
    });
  });

  bus.register<{
    mesh_id: string;
    art_path_id?: string;
    stroke_width?: number;
    color?: [number, number, number, number];
  }>('art_path.fit_mesh_contour', (draft, { mesh_id, art_path_id, stroke_width = 4.0, color = [0.15, 0.15, 0.18, 1.0] }) => {
    const mesh = draft.nodes.find((n) => n.id === mesh_id);
    if (!mesh || mesh.kind.type !== 'ArtMesh') {
      throw new Error(`ArtMesh '${mesh_id}' not found`);
    }
    const verts = mesh.kind.vertices;
    const inds = mesh.kind.indices;

    const boundary = getMeshBoundaryLoops(inds)[0];
    const orderedPoints: [number, number][] = boundary ? boundary.map(index => [verts[index][0], verts[index][1]]) : verts.map(vertex => [vertex[0], vertex[1]]);

    const pathId = art_path_id || `artpath_${mesh.id}`;
    draft.nodes.push({
      id: pathId,
      name: `${mesh.name || mesh.id} ArtPath`,
      parent_id: mesh.parent_id,
      visible: true,
      locked: false,
      kind: {
        type: 'ArtPath',
        points: orderedPoints.map((pos) => ({ pos, width: stroke_width, opacity: 1.0 })),
        closed: true,
        color,
        blend_mode: 'normal',
        opacity: 1.0,
        draw_order: mesh.kind.draw_order + 1,
        mask_ids: [],
        is_mask_inverted: false,
      },
    });
  });

  bus.register<{
    node_id: string;
    delta?: number;
    scale?: number;
    point_index?: number;
  }>('art_path.adjust_width', (draft, { node_id, delta = 0, scale = 1.0, point_index }) => {
    const node = draft.nodes.find((n) => n.id === node_id);
    if (!node || node.kind.type !== 'ArtPath') return;
    node.kind.points.forEach((pt, idx) => {
      if (point_index === undefined || point_index === idx) {
        pt.width = Math.max(0.5, pt.width * scale + delta);
      }
    });
  });

  // 4. CMD_DELETE_DEFORMER_AND_SET_PARAM: Delete deformer while baking its current deformation into children
  bus.register<{
    deformer_id: string;
  }>('deformer.delete_and_bake_to_children', (draft, { deformer_id }) => {
    const deformer = draft.nodes.find((n) => n.id === deformer_id);
    if (!deformer) return;

    const bakePoint = (pt: [number, number]): [number, number] => {
      if (deformer.kind.type === 'WarpDeformer') {
        const { cols, rows, bounds, control_points } = deformer.kind;
        const [minX, minY, w, h] = bounds;
        if (cols === 0 || rows === 0 || Math.abs(w) < 1e-5 || Math.abs(h) < 1e-5) return pt;
        const u = Math.max(0, Math.min(1, (pt[0] - minX) / w));
        const v = Math.max(0, Math.min(1, (pt[1] - minY) / h));
        const gx = u * cols;
        const gy = v * rows;
        const c0 = Math.min(Math.floor(gx), cols - 1);
        const r0 = Math.min(Math.floor(gy), rows - 1);
        const tx = gx - c0;
        const ty = gy - r0;
        const stride = cols + 1;
        const p00 = control_points[r0 * stride + c0] || pt;
        const p10 = control_points[r0 * stride + c0 + 1] || pt;
        const p01 = control_points[(r0 + 1) * stride + c0] || pt;
        const p11 = control_points[(r0 + 1) * stride + c0 + 1] || pt;
        const topX = p00[0] * (1 - tx) + p10[0] * tx;
        const topY = p00[1] * (1 - tx) + p10[1] * tx;
        const botX = p01[0] * (1 - tx) + p11[0] * tx;
        const botY = p01[1] * (1 - tx) + p11[1] * tx;
        return [topX * (1 - ty) + botX * ty, topY * (1 - ty) + botY * ty];
      } else if (deformer.kind.type === 'RotationDeformer') {
        const { origin, angle_deg, scale } = deformer.kind;
        const dx = (pt[0] - origin[0]) * scale[0];
        const dy = (pt[1] - origin[1]) * scale[1];
        const rad = (angle_deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return [origin[0] + dx * cos - dy * sin, origin[1] + dx * sin + dy * cos];
      }
      return pt;
    };

    for (const child of draft.nodes) {
      if (child.parent_id === deformer_id) {
        if (child.kind.type === 'ArtMesh') {
          child.kind.vertices = child.kind.vertices.map(bakePoint);
        } else if (child.kind.type === 'WarpDeformer') {
          child.kind.control_points = child.kind.control_points.map(bakePoint);
        } else if (child.kind.type === 'ArtPath') {
          child.kind.points.forEach((p) => {
            p.pos = bakePoint(p.pos);
          });
        }
        child.parent_id = deformer.parent_id;
      }
    }
    draft.nodes = draft.nodes.filter((n) => n.id !== deformer_id);
    draft.keyforms = draft.keyforms.filter((k) => k.target_node_id !== deformer_id);
  });

  // 5. Official Cubism 5.3 Physics Presets (`res/values/physics/default_physics_preset40.xml`)
  bus.register<{
    group_id?: string;
    preset:
      | 'hair_short'
      | 'hair_long'
      | 'hair_2stage'
      | 'hair_3stage'
      | 'cloth_light'
      | 'cloth_heavy'
      | 'bust_small'
      | 'bust_large'
      | 'pendulum_10stage'
      | 'pendulum_20stage';
    input_preset?: 'head_input' | 'body_input' | 'bust_input';
    output_param_id?: string;
  }>('physics.apply_preset', (draft, { group_id, preset, input_preset = 'head_input', output_param_id }) => {
    if (!draft.physics) draft.physics = [];

    const inputPresets: Record<string, PhysicsInput[]> = {
      head_input: [
        { param_id: 'ParamAngleX', weight: 0.6, reflect: false },
        { param_id: 'ParamAngleZ', weight: 0.6, reflect: false },
        { param_id: 'ParamBodyAngleX', weight: 0.4, reflect: false },
        { param_id: 'ParamBodyAngleZ', weight: 0.4, reflect: false },
      ],
      body_input: [
        { param_id: 'ParamBodyAngleX', weight: 1.0, reflect: false },
        { param_id: 'ParamBodyAngleZ', weight: 1.0, reflect: false },
      ],
      bust_input: [
        { param_id: 'ParamBodyAngleX', weight: 0.7, reflect: false },
        { param_id: 'ParamBodyAngleZ', weight: 0.3, reflect: false },
      ],
    };

    const modelPresets: Record<string, { name: string; pendulums: PhysicsPendulum[] }> = {
      hair_short: { name: 'Hair (Short) / 髪（短い）', pendulums: [{ length: 3, damping: 0.9, mass: 1.5 }] },
      hair_long: { name: 'Hair (Long) / 髪（長い）', pendulums: [{ length: 15, damping: 0.8, mass: 1.5 }] },
      hair_2stage: {
        name: 'Hair 2-Stage / 髪 2段振り子',
        pendulums: [
          { length: 10, damping: 0.8, mass: 1.5 },
          { length: 8, damping: 0.8, mass: 1.5 },
        ],
      },
      hair_3stage: {
        name: 'Hair 3-Stage / 髪 3段振り子',
        pendulums: [
          { length: 10, damping: 0.9, mass: 1.0 },
          { length: 10, damping: 0.9, mass: 1.0 },
          { length: 8, damping: 0.9, mass: 0.8 },
        ],
      },
      cloth_light: { name: 'Cloth (Light) / 服（軽い）', pendulums: [{ length: 10, damping: 0.6, mass: 1.5 }] },
      cloth_heavy: { name: 'Cloth (Heavy) / 服（重い）', pendulums: [{ length: 10, damping: 0.8, mass: 1.5 }] },
      bust_small: { name: 'Bust (Small) / 胸（小さい）', pendulums: [{ length: 3, damping: 0.9, mass: 1.5 }] },
      bust_large: { name: 'Bust (Large) / 胸（大きい）', pendulums: [{ length: 5, damping: 0.8, mass: 1.5 }] },
      pendulum_10stage: {
        name: '10-Stage Pendulum / 10段',
        pendulums: Array.from({ length: 10 }, () => ({ length: 10, damping: 0.85, mass: 1.2 })),
      },
      pendulum_20stage: {
        name: '20-Stage Pendulum / 20段',
        pendulums: Array.from({ length: 20 }, () => ({ length: 10, damping: 0.85, mass: 1.2 })),
      },
    };

    const chosen = modelPresets[preset] || modelPresets.hair_2stage;
    const inputs = inputPresets[input_preset] || inputPresets.head_input;
    const targetOut =
      output_param_id ||
      draft.parameters.find((p) => p.id.toLowerCase().includes('hair'))?.id ||
      draft.parameters[0]?.id ||
      'ParamHairFront';

    const id = group_id || `physics_${preset}`;
    const group = {
      id,
      name: chosen.name,
      inputs,
      pendulums: chosen.pendulums,
      outputs: chosen.pendulums.map((_, idx) => ({
        param_id: targetOut,
        pendulum_index: idx,
        angle_scale: 0.05,
        weight: Number((1.0 / chosen.pendulums.length).toFixed(2)),
      })),
    };

    const existingIdx = draft.physics.findIndex((g) => g.id === id);
    if (existingIdx >= 0) draft.physics[existingIdx] = group;
    else draft.physics.push(group);
  });

  // 6. CMD_BAKE_PHYSICS: Bake Physics Simulation into Animation Timeline Tracks
  bus.register<{
    animation_id: string;
  }>('animation.bake_physics', (draft, { animation_id }) => {
    const anim = draft.animations?.find((a) => a.id === animation_id);
    if (!anim || !draft.physics || draft.physics.length === 0) return;

    const fps = Math.max(1, anim.fps || 30);
    const duration = Math.max(1, Math.ceil(anim.duration_frames));
    const dt = 1.0 / fps;

    const outputParamIds = new Set<string>();
    for (const g of draft.physics) {
      for (const out of g.outputs) outputParamIds.add(out.param_id);
    }
    for (const t of anim.tracks) {
      if (t.frozen) outputParamIds.delete(t.target_param_id);
    }
    if (outputParamIds.size === 0) return;

    const sim = new PhysicsSimulatorJs();
    const bakedMap = new Map<string, { frame: number; value: number; curve: 'linear' }[]>();
    for (const pid of outputParamIds) bakedMap.set(pid, []);

    for (let f = 0; f <= duration; f++) {
      const frameParams = evaluateAnimationAtFrameJs(anim, f);
      for (const p of draft.parameters) {
        if (frameParams[p.id] === undefined) frameParams[p.id] = p.default;
      }
      const physOut = sim.update(draft, frameParams, dt);
      for (const pid of outputParamIds) {
        bakedMap.get(pid)!.push({
          frame: f,
          value: Number((physOut[pid] ?? 0).toFixed(3)),
          curve: 'linear',
        });
      }
    }

    for (const [pid, keyframes] of bakedMap.entries()) {
      const existing = anim.tracks.find((t) => t.target_param_id === pid);
      if (existing) {
        existing.keyframes = keyframes;
      } else {
        anim.tracks.push({
          target_param_id: pid,
          keyframes,
          frozen: false,
        });
      }
    }
  });

  // 7. Timeline Track Freeze, Markers, and Form Animation (`CMD_SET_FREEZE_*`, `CMD_CREATE_FORMANIMATION_KEY`)
  bus.register<{
    animation_id: string;
    param_id?: string;
    frozen: boolean;
  }>('animation.set_track_freeze', (draft, { animation_id, param_id, frozen }) => {
    const anim = draft.animations?.find((a) => a.id === animation_id);
    if (!anim) return;
    for (const t of anim.tracks) {
      if (!param_id || t.target_param_id === param_id) {
        t.frozen = frozen;
      }
    }
  });

  bus.register<{
    animation_id: string;
    frame: number;
    label: string;
    color?: string;
  }>('animation.add_marker', (draft, { animation_id, frame, label, color }) => {
    const anim = draft.animations?.find((a) => a.id === animation_id);
    if (!anim) return;
    if (!anim.markers) anim.markers = [];
    anim.markers = anim.markers.filter((m) => Math.abs(m.frame - frame) > 1e-4);
    anim.markers.push({ frame, label, color });
    anim.markers.sort((a, b) => a.frame - b.frame);
  });

  bus.register<{
    animation_id: string;
    target_node_id: string;
    frame: number;
    offsets: [number, number][];
  }>('animation.set_form_keyframe', (draft, { animation_id, target_node_id, frame, offsets }) => {
    const anim = draft.animations?.find((a) => a.id === animation_id);
    if (!anim) return;
    if (!anim.form_tracks) anim.form_tracks = [];
    let ft = anim.form_tracks.find((t) => t.target_node_id === target_node_id);
    if (!ft) {
      ft = { target_node_id, keyframes: [] };
      anim.form_tracks.push(ft);
    }
    const idx = ft.keyframes.findIndex((k) => Math.abs(k.frame - frame) < 1e-4);
    if (idx >= 0) ft.keyframes[idx].offsets = offsets;
    else {
      ft.keyframes.push({ frame, offsets, curve: 'linear' });
      ft.keyframes.sort((a, b) => a.frame - b.frame);
    }
  });

  // 8. Scene Hygiene Cleanup (`CMD_PART_PALETTE_CMD_REMOVE_ALL_EMPTY_PARTS`, `CMD_PART_PALETTE_CMD_REMOVE_ALL_EMPTY_DEFORMERS`, `CMD_PARAMETER_PALETTE_DELETE_ALL_EMPTY_PARAMETERS`)
  bus.register<{
    remove_empty_parts?: boolean;
    remove_empty_deformers?: boolean;
    remove_unused_parameters?: boolean;
    remove_empty_parameter_groups?: boolean;
  }>('project.cleanup_empty', (draft, opts = {}) => {
    const removeParts = opts.remove_empty_parts ?? true;
    const removeDeformers = opts.remove_empty_deformers ?? true;
    const removeParams = opts.remove_unused_parameters ?? true;
    const removeGroups = opts.remove_empty_parameter_groups ?? true;

    if (removeParts || removeDeformers) {
      let changed = true;
      while (changed) {
        changed = false;
        const parentIds = new Set(draft.nodes.map((n) => n.parent_id).filter(Boolean));
        const beforeLen = draft.nodes.length;
        draft.nodes = draft.nodes.filter((n) => {
          if (parentIds.has(n.id)) return true;
          if (removeParts && n.kind.type === 'Part') return false;
          if (
            removeDeformers &&
            (n.kind.type === 'WarpDeformer' || n.kind.type === 'RotationDeformer')
          ) {
            return false;
          }
          return true;
        });
        if (draft.nodes.length !== beforeLen) changed = true;
      }
      const remainingNodeIds = new Set(draft.nodes.map((n) => n.id));
      draft.keyforms = draft.keyforms.filter((k) => remainingNodeIds.has(k.target_node_id));
    }

    if (removeParams) {
      const usedParams = new Set<string>();
      for (const kf of draft.keyforms) {
        for (const d of kf.dimensions) usedParams.add(d.param_id);
      }
      for (const n of draft.nodes) {
        if (n.kind.type === 'ArtMesh') {
          for (const m of n.kind.morph_targets || []) usedParams.add(m.param_id);
        }
      }
      for (const p of draft.physics || []) {
        for (const inp of p.inputs) usedParams.add(inp.param_id);
        for (const out of p.outputs) usedParams.add(out.param_id);
      }
      for (const e of draft.expressions || []) {
        for (const ep of e.parameters) usedParams.add(ep.id);
      }
      for (const a of draft.animations || []) {
        for (const t of a.tracks) usedParams.add(t.target_param_id);
      }
      draft.parameters = draft.parameters.filter((p) => usedParams.has(p.id));
    }

    if (removeGroups && draft.parameter_groups) {
      const usedGroups = new Set(draft.parameters.map((p) => p.group_id).filter(Boolean));
      draft.parameter_groups = draft.parameter_groups.filter((g) => usedGroups.has(g.id));
    }
  });

  // 9. Cubism 5.0/5.1 AI Automation Counterparts: `macro.auto_sway` (揺れの動きの自動生成) & `macro.auto_face_motion` (顔の動きの自動生成)
  bus.register<{
    target_node_id: string;
    param_id?: string;
    sway_amplitude?: number;
  }>('macro.auto_sway', (draft, { target_node_id, param_id = 'ParamHairFront', sway_amplitude = 18 }) => {
    const node = draft.nodes.find((n) => n.id === target_node_id);
    if (!node) throw new Error(`Target node '${target_node_id}' not found`);

    if (!draft.parameters.some((p) => p.id === param_id)) {
      draft.parameters.push({ id: param_id, name: 'Sway Parameter', min: -1, max: 1, default: 0 });
    }

    if (node.kind.type === 'WarpDeformer') {
      const { cols, rows, control_points } = node.kind;
      const stride = cols + 1;
      const makeSway = (dir: number): [number, number][] =>
        control_points.map(([cx, cy], idx) => {
          const r = Math.floor(idx / stride);
          const rowWeight = rows > 0 ? (r / rows) ** 1.5 : 1.0;
          return [cx + dir * sway_amplitude * rowWeight, cy];
        });
      const binding: KeyformBinding = {
        target_node_id,
        dimensions: [{ param_id, keys: [-1, 0, 1], extended_interpolation: 'circle' }],
        keyforms: [
          { coordinates: [-1], payload: { kind: 'Warp', control_points: makeSway(-1) } },
          { coordinates: [0], payload: { kind: 'Warp', control_points: control_points.map((p) => [p[0], p[1]]) } },
          { coordinates: [1], payload: { kind: 'Warp', control_points: makeSway(1) } },
        ],
      };
      const idx = draft.keyforms.findIndex((k) => k.target_node_id === target_node_id);
      if (idx >= 0) draft.keyforms[idx] = binding;
      else draft.keyforms.push(binding);
    }

    if (!draft.physics) draft.physics = [];
    const physId = `physics_sway_${param_id}`;
    if (!draft.physics.some((p) => p.id === physId)) {
      draft.physics.push({
        id: physId,
        name: `Auto Sway (${param_id})`,
        inputs: [{ param_id: 'ParamAngleX', weight: 0.8, reflect: false }],
        pendulums: [
          { length: 12, damping: 0.85, mass: 1.2 },
          { length: 10, damping: 0.85, mass: 1.0 },
        ],
        outputs: [
          { param_id, pendulum_index: 0, angle_scale: 0.05, weight: 0.5 },
          { param_id, pendulum_index: 1, angle_scale: 0.05, weight: 0.5 },
        ],
      });
    }
  });

  bus.register<{
    animation_id?: string;
    duration_frames?: number;
  }>('macro.auto_face_motion', (draft, { animation_id = 'auto_face_idle', duration_frames = 120 } = {}) => {
    if (!draft.animations) draft.animations = [];
    const tracks = [
      {
        target_param_id: 'ParamAngleX',
        keyframes: [
          { frame: 0, value: 0, curve: 'bezier' as const },
          { frame: Math.round(duration_frames * 0.25), value: 15, curve: 'bezier' as const },
          { frame: Math.round(duration_frames * 0.75), value: -15, curve: 'bezier' as const },
          { frame: duration_frames, value: 0, curve: 'bezier' as const },
        ],
      },
      {
        target_param_id: 'ParamAngleY',
        keyframes: [
          { frame: 0, value: 0, curve: 'bezier' as const },
          { frame: Math.round(duration_frames * 0.5), value: 10, curve: 'bezier' as const },
          { frame: duration_frames, value: 0, curve: 'bezier' as const },
        ],
      },
      {
        target_param_id: 'ParamEyeLOpen',
        keyframes: [
          { frame: 0, value: 1, curve: 'linear' as const },
          { frame: 40, value: 1, curve: 'linear' as const },
          { frame: 43, value: 0, curve: 'linear' as const },
          { frame: 47, value: 1, curve: 'linear' as const },
          { frame: duration_frames, value: 1, curve: 'linear' as const },
        ],
      },
      {
        target_param_id: 'ParamEyeROpen',
        keyframes: [
          { frame: 0, value: 1, curve: 'linear' as const },
          { frame: 40, value: 1, curve: 'linear' as const },
          { frame: 43, value: 0, curve: 'linear' as const },
          { frame: 47, value: 1, curve: 'linear' as const },
          { frame: duration_frames, value: 1, curve: 'linear' as const },
        ],
      },
    ];
    const anim = {
      id: animation_id,
      name: 'Auto Face Motion (AI Preset)',
      duration_frames,
      fps: 30,
      loop_playback: true,
      tracks,
    };
    const idx = draft.animations.findIndex((a) => a.id === animation_id);
    if (idx >= 0) draft.animations[idx] = anim;
    else draft.animations.push(anim);
  });

  // 10. Perspective & Bilinear 4-Corner Free Deform Handler (`CMD_CREATE_FREE_DEFORM_HANDLER_AS_PERSPECTIVE_MODE`)
  bus.register<{
    node_id: string;
    quad_corners: [[number, number], [number, number], [number, number], [number, number]];
    mode?: 'perspective' | 'bilinear';
  }>('deform.free_quad', (draft, { node_id, quad_corners, mode = 'perspective' }) => {
    const node = draft.nodes.find((n) => n.id === node_id);
    if (!node) throw new Error(`Node '${node_id}' not found`);

    if (node.kind.type === 'ArtMesh') {
      const pts = node.kind.vertices;
      if (pts.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const bounds: [number, number, number, number] = [minX, minY, maxX - minX || 1, maxY - minY || 1];
      node.kind.vertices = transformPointsByFreeQuad(pts, bounds, quad_corners, mode);
    } else if (node.kind.type === 'WarpDeformer') {
      node.kind.control_points = transformPointsByFreeQuad(
        node.kind.control_points,
        node.kind.bounds,
        quad_corners,
        mode
      );
    } else if (node.kind.type === 'ArtPath') {
      const pts = node.kind.points.map((p): [number, number] => p.pos);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const bounds: [number, number, number, number] = [minX, minY, maxX - minX || 1, maxY - minY || 1];
      const transformed = transformPointsByFreeQuad(pts, bounds, quad_corners, mode);
      node.kind.points.forEach((p, idx) => {
        p.pos = transformed[idx];
      });
    }
  });

  // 11. Warp Handler Topology Resampling (`CMD_TWICE_ROW_WARP_HANDLER`, `CMD_HALF_ROW_WARP_HANDLER`, `CMD_TWICE_COLUMN_WARP_HANDLER`, `CMD_HALF_COLUMN_WARP_HANDLER`)
  bus.register<{
    node_id: string;
    op: 'twice_rows' | 'half_rows' | 'twice_cols' | 'half_cols';
  }>('warp.change_topology', (draft, { node_id, op }) => {
    const node = draft.nodes.find((n) => n.id === node_id);
    if (!node || node.kind.type !== 'WarpDeformer') return;

    const oldCols = node.kind.cols;
    const oldRows = node.kind.rows;
    const newCols =
      op === 'twice_cols' ? oldCols * 2 : op === 'half_cols' ? Math.max(1, Math.floor(oldCols / 2)) : oldCols;
    const newRows =
      op === 'twice_rows' ? oldRows * 2 : op === 'half_rows' ? Math.max(1, Math.floor(oldRows / 2)) : oldRows;

    const resampleGrid = (srcPts: [number, number][]): [number, number][] => {
      const stride = oldCols + 1;
      const out: [number, number][] = [];
      for (let r = 0; r <= newRows; r++) {
        const v = r / newRows;
        const gy = v * oldRows;
        const r0 = Math.min(Math.floor(gy), oldRows - 1);
        const ty = gy - r0;
        for (let c = 0; c <= newCols; c++) {
          const u = c / newCols;
          const gx = u * oldCols;
          const c0 = Math.min(Math.floor(gx), oldCols - 1);
          const tx = gx - c0;
          const p00 = srcPts[r0 * stride + c0] || [0, 0];
          const p10 = srcPts[r0 * stride + c0 + 1] || p00;
          const p01 = srcPts[(r0 + 1) * stride + c0] || p00;
          const p11 = srcPts[(r0 + 1) * stride + c0 + 1] || p00;
          const topX = p00[0] * (1 - tx) + p10[0] * tx;
          const topY = p00[1] * (1 - tx) + p10[1] * tx;
          const botX = p01[0] * (1 - tx) + p11[0] * tx;
          const botY = p01[1] * (1 - tx) + p11[1] * tx;
          out.push([topX * (1 - ty) + botX * ty, topY * (1 - ty) + botY * ty]);
        }
      }
      return out;
    };

    node.kind.control_points = resampleGrid(node.kind.control_points);
    node.kind.cols = newCols;
    node.kind.rows = newRows;

    const binding = draft.keyforms.find((k) => k.target_node_id === node_id);
    if (binding) {
      for (const st of binding.keyforms) {
        if (st.payload.kind === 'Warp') {
          st.payload.control_points = resampleGrid(st.payload.control_points);
        }
      }
    }
  });

  // 12. Stroke Mesh Topology Generator (`CMD_TOOL_MODE_MESH_EDIT_STROKE_MESH`)
  bus.register<{
    mesh_id: string;
    stroke_points: [number, number][];
    width?: number;
  }>('mesh.stroke_topology', (draft, { mesh_id, stroke_points, width = 24 }) => {
    const mesh = draft.nodes.find((n) => n.id === mesh_id);
    if (!mesh || mesh.kind.type !== 'ArtMesh') return;
    const topo = generateStrokeMeshTopology(stroke_points, width, [draft.canvas.width, draft.canvas.height]);
    if (topo.vertices.length > 0) {
      mesh.kind.vertices = topo.vertices;
      mesh.kind.uvs = topo.uvs;
      mesh.kind.indices = topo.indices;
    }
  });

  // 13. Cubism 5.1/5.3 Full-Body AI Deformer Tree Builder (`com.live2d.cubism.doc.model.deformer.autoDeformerCreate`)
  bus.register<void>('macro.ai_full_body_deformers', (draft) => {
    const cx = draft.canvas.width / 2;
    const cy = draft.canvas.height / 2;

    const makeGrid = (cols: number, rows: number, bounds: [number, number, number, number]): [number, number][] => {
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

    // Official 24-node DeformerType hierarchy from `G.class` (`CUB3-3787..3809`, `CUBI-1238`)
    const officialHierarchy: {
      id: string;
      name: string;
      parent_id: string | null;
      type: 'Warp' | 'Rotation';
      bounds?: [number, number, number, number];
      origin?: [number, number];
    }[] = [
      { id: 'UPPER_BODY_Z', name: '上半身的曲面Z (Upper Body Z)', parent_id: null, type: 'Warp', bounds: [cx - 300, cy - 200, 600, 500] },
      { id: 'UPPER_BODY_Y', name: '上半身的曲面Y (Upper Body Y)', parent_id: 'UPPER_BODY_Z', type: 'Warp', bounds: [cx - 280, cy - 180, 560, 460] },
      { id: 'BREATH', name: '呼吸 (Breath)', parent_id: 'UPPER_BODY_Y', type: 'Warp', bounds: [cx - 260, cy - 160, 520, 420] },
      { id: 'LOWER_BODY', name: '下半身的曲面 (Lower Body)', parent_id: null, type: 'Warp', bounds: [cx - 300, cy + 200, 600, 400] },
      { id: 'RIGHT_ARM_ROT', name: '右臂旋转 (Right Arm Rot)', parent_id: 'BREATH', type: 'Rotation', origin: [cx - 180, cy - 50] },
      { id: 'LEFT_ARM_ROT', name: '左臂旋转 (Left Arm Rot)', parent_id: 'BREATH', type: 'Rotation', origin: [cx + 180, cy - 50] },
      { id: 'NECK_POS', name: '脖子位置 (Neck Pos)', parent_id: 'BREATH', type: 'Warp', bounds: [cx - 120, cy - 260, 240, 180] },
      { id: 'NECK', name: '脖子曲面 (Neck)', parent_id: 'NECK_POS', type: 'Warp', bounds: [cx - 100, cy - 240, 200, 150] },
      { id: 'FACE_ROT', name: '面部旋转 (Face Rot)', parent_id: 'NECK_POS', type: 'Rotation', origin: [cx, cy - 260] },
      { id: 'FACE', name: '面部曲面 (Face)', parent_id: 'FACE_ROT', type: 'Warp', bounds: [cx - 220, cy - 500, 440, 360] },
      { id: 'NOSE', name: '鼻子曲面 (Nose)', parent_id: 'FACE', type: 'Warp', bounds: [cx - 30, cy - 340, 60, 60] },
      { id: 'MOUTH', name: '嘴部曲面 (Mouth)', parent_id: 'FACE', type: 'Warp', bounds: [cx - 60, cy - 260, 120, 60] },
      { id: 'RIGHT_EAR', name: '右耳曲面 (Right Ear)', parent_id: 'FACE_ROT', type: 'Warp', bounds: [cx - 250, cy - 360, 60, 100] },
      { id: 'LEFT_EAR', name: '左耳曲面 (Left Ear)', parent_id: 'FACE_ROT', type: 'Warp', bounds: [cx + 190, cy - 360, 60, 100] },
      { id: 'RIGHT_EYE_BROWS_POS', name: '右眉毛位置 (Right Brow Pos)', parent_id: 'FACE', type: 'Warp', bounds: [cx - 160, cy - 420, 100, 40] },
      { id: 'RIGHT_EYE_BROWS_ROT', name: '右眉毛角度 (Right Brow Rot)', parent_id: 'RIGHT_EYE_BROWS_POS', type: 'Rotation', origin: [cx - 110, cy - 400] },
      { id: 'RIGHT_EYE_BROWS', name: '右眉毛曲面 (Right Brow)', parent_id: 'RIGHT_EYE_BROWS_ROT', type: 'Warp', bounds: [cx - 160, cy - 420, 100, 40] },
      { id: 'LEFT_EYE_BROWS_POS', name: '左眉毛位置 (Left Brow Pos)', parent_id: 'FACE', type: 'Warp', bounds: [cx + 60, cy - 420, 100, 40] },
      { id: 'LEFT_EYE_BROWS_ROT', name: '左眉毛角度 (Left Brow Rot)', parent_id: 'LEFT_EYE_BROWS_POS', type: 'Rotation', origin: [cx + 110, cy - 400] },
      { id: 'LEFT_EYE_BROWS', name: '左眉毛曲面 (Left Brow)', parent_id: 'LEFT_EYE_BROWS_ROT', type: 'Warp', bounds: [cx + 60, cy - 420, 100, 40] },
      { id: 'RIGHT_EYE', name: '右眼曲面 (Right Eye)', parent_id: 'FACE', type: 'Warp', bounds: [cx - 160, cy - 370, 100, 70] },
      { id: 'RIGHT_EYE_BALL', name: '右眼珠曲面 (Right Eyeball)', parent_id: 'RIGHT_EYE', type: 'Warp', bounds: [cx - 135, cy - 355, 50, 50] },
      { id: 'LEFT_EYE', name: '左眼曲面 (Left Eye)', parent_id: 'FACE', type: 'Warp', bounds: [cx + 60, cy - 370, 100, 70] },
      { id: 'LEFT_EYE_BALL', name: '左眼珠曲面 (Left Eyeball)', parent_id: 'LEFT_EYE', type: 'Warp', bounds: [cx + 85, cy - 355, 50, 50] },
    ];

    for (const def of officialHierarchy) {
      if (!draft.nodes.some((n) => n.id === def.id)) {
        draft.nodes.push({
          id: def.id,
          name: def.name,
          parent_id: def.parent_id,
          visible: true,
          locked: false,
          kind:
            def.type === 'Warp'
              ? {
                  type: 'WarpDeformer',
                  cols: 5,
                  rows: 5,
                  bounds: def.bounds!,
                  control_points: makeGrid(5, 5, def.bounds!),
                  bezier_smooth: true,
                }
              : {
                  type: 'RotationDeformer',
                  origin: def.origin!,
                  angle_deg: 0,
                  scale: [1, 1],
                },
        });
      }
    }

    // Classify ArtMeshes into the 13 PredClass categories and assign parent deformer (`F.class`)
    for (const node of draft.nodes) {
      if (node.kind.type !== 'ArtMesh') continue;
      const label = `${node.id} ${node.name}`.toLowerCase();
      let avgX = cx;
      if (node.kind.vertices.length > 0) {
        avgX = node.kind.vertices.reduce((s, v) => s + v[0], 0) / node.kind.vertices.length;
      }
      const isLeftOnCanvas = avgX < cx; // In character view, canvas left is character's RIGHT side (`A.isOnCanvasLeftSide`)

      if (/brow|眉/.test(label)) {
        node.parent_id = isLeftOnCanvas ? 'RIGHT_EYE_BROWS' : 'LEFT_EYE_BROWS';
      } else if (/eyeball|pupil|iris|眼珠|瞳/.test(label)) {
        node.parent_id = isLeftOnCanvas ? 'RIGHT_EYE_BALL' : 'LEFT_EYE_BALL';
      } else if (/eye|lash|眼/.test(label)) {
        node.parent_id = isLeftOnCanvas ? 'RIGHT_EYE' : 'LEFT_EYE';
      } else if (/nose|鼻/.test(label)) {
        node.parent_id = 'NOSE';
      } else if (/mouth|lip|tongue|teeth|嘴|口/.test(label)) {
        node.parent_id = 'MOUTH';
      } else if (/ear|耳/.test(label)) {
        node.parent_id = isLeftOnCanvas ? 'RIGHT_EAR' : 'LEFT_EAR';
      } else if (/neck|脖|首/.test(label)) {
        node.parent_id = 'NECK';
      } else if (/arm|hand|sleeve|臂|手/.test(label)) {
        node.parent_id = isLeftOnCanvas ? 'RIGHT_ARM_ROT' : 'LEFT_ARM_ROT';
      } else if (/leg|skirt|pants|lower|腿|裙|下半身/.test(label)) {
        node.parent_id = 'LOWER_BODY';
      } else if (/body|torso|chest|shirt|cloth|身体|上半身|胸|服/.test(label)) {
        node.parent_id = 'BREATH';
      } else if (/hair|发|髪/.test(label)) {
        node.parent_id = 'FACE_ROT';
      } else if (/face|cheek|head|脸|顔/.test(label)) {
        node.parent_id = 'FACE';
      }
    }
  });

  // 14. Apply Modeling Template (`CMD_MODELING_TEMPLATE`)
  bus.register<{
    template: ModelingTemplate;
  }>('template.apply', (draft, { template }) => {
    const sx = draft.canvas.width / (template.canvas?.width || draft.canvas.width || 1);
    const sy = draft.canvas.height / (template.canvas?.height || draft.canvas.height || 1);

    for (const pg of template.parameter_groups || []) {
      if (!draft.parameter_groups) draft.parameter_groups = [];
      if (!draft.parameter_groups.some((g) => g.id === pg.id)) {
        draft.parameter_groups.push(JSON.parse(JSON.stringify(pg)));
      }
    }
    for (const p of template.parameters || []) {
      if (!draft.parameters.some((ep) => ep.id === p.id)) {
        draft.parameters.push(JSON.parse(JSON.stringify(p)));
      }
    }
    for (const def of template.deformers || []) {
      if (!draft.nodes.some((n) => n.id === def.id)) {
        const clone: Node = JSON.parse(JSON.stringify(def));
        if (clone.kind.type === 'WarpDeformer') {
          clone.kind.bounds = [
            clone.kind.bounds[0] * sx,
            clone.kind.bounds[1] * sy,
            clone.kind.bounds[2] * sx,
            clone.kind.bounds[3] * sy,
          ];
          clone.kind.control_points = clone.kind.control_points.map(([x, y]) => [x * sx, y * sy]);
        } else if (clone.kind.type === 'RotationDeformer') {
          clone.kind.origin = [clone.kind.origin[0] * sx, clone.kind.origin[1] * sy];
        }
        draft.nodes.push(clone);
      }
    }
    for (const kf of template.keyforms || []) {
      const cloneKf: KeyformBinding = JSON.parse(JSON.stringify(kf));
      for (const st of cloneKf.keyforms) {
        if (st.payload.kind === 'Warp') {
          st.payload.control_points = st.payload.control_points.map(([x, y]) => [x * sx, y * sy]);
        } else if (st.payload.kind === 'Rotation') {
          st.payload.origin = [st.payload.origin[0] * sx, st.payload.origin[1] * sy];
        }
      }
      const idx = draft.keyforms.findIndex((k) => k.target_node_id === cloneKf.target_node_id);
      if (idx >= 0) draft.keyforms[idx] = cloneKf;
      else draft.keyforms.push(cloneKf);
    }
    for (const phys of template.physics || []) {
      if (!draft.physics) draft.physics = [];
      if (!draft.physics.some((p) => p.id === phys.id)) {
        draft.physics.push(JSON.parse(JSON.stringify(phys)));
      }
    }
  });

  // 15. Deform Path Skinning (`CMD_DEFORM_PATH_SKINNING` / `CUB3-1677`: 沿变形路径自动蒙皮生成骨骼链)
  bus.register<{
    path_id: string;
    mesh_id?: string;
  }>('deform_path.auto_skinning', (draft, { path_id, mesh_id }) => {
    const pathNode = draft.nodes.find((n) => n.id === path_id);
    if (!pathNode || pathNode.kind.type !== 'DeformPath') {
      throw new Error(`DeformPath node '${path_id}' not found`);
    }
    const pts = pathNode.kind.control_points;
    if (pts.length < 2) return;

    let prevRotId: string | null = pathNode.parent_id;
    for (let i = 0; i < pts.length - 1; i++) {
      const rotId = `rot_skin_${path_id}_${i + 1}`;
      const paramId = `ParamSkinning_${path_id}_${i + 1}`;
      const origin = pts[i];
      const nextPt = pts[i + 1];
      const dx = nextPt[0] - origin[0];
      const dy = nextPt[1] - origin[1];
      const restAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      if (!draft.parameters.some((p) => p.id === paramId)) {
        draft.parameters.push({
          id: paramId,
          name: `Skinning Angle #${i + 1}`,
          min: -45,
          max: 45,
          default: 0,
        });
      }

      if (!draft.nodes.some((n) => n.id === rotId)) {
        draft.nodes.push({
          id: rotId,
          name: `Skinning Rot #${i + 1}`,
          parent_id: prevRotId,
          visible: true,
          locked: false,
          kind: {
            type: 'RotationDeformer',
            origin,
            angle_deg: 0,
            scale: [1, 1],
          },
        });
      }

      // Bind keyforms for this bone rotation
      const keybinding = {
        target_node_id: rotId,
        dimensions: [{ param_id: paramId, keys: [-45, 0, 45] }],
        keyforms: [
          { coordinates: [-45], payload: { kind: 'Rotation' as const, origin, angle_deg: -45, scale: [1, 1] as [number, number] } },
          { coordinates: [0], payload: { kind: 'Rotation' as const, origin, angle_deg: 0, scale: [1, 1] as [number, number] } },
          { coordinates: [45], payload: { kind: 'Rotation' as const, origin, angle_deg: 45, scale: [1, 1] as [number, number] } },
        ],
      };
      const kfIdx = draft.keyforms.findIndex((k) => k.target_node_id === rotId);
      if (kfIdx >= 0) draft.keyforms[kfIdx] = keybinding;
      else draft.keyforms.push(keybinding);

      prevRotId = rotId;
    }

    // Reparent target mesh to root of skinning chain
    const targetMesh = mesh_id
      ? draft.nodes.find((n) => n.id === mesh_id)
      : draft.nodes.find((n) => pathNode.kind.type === 'DeformPath' && pathNode.kind.target_mesh_ids.includes(n.id));
    if (targetMesh && prevRotId) {
      targetMesh.parent_id = `rot_skin_${path_id}_1`;
    }
  });

  // 16. Four-Corner Synthesis (`CMD_FOUR_CORNER_SYNTHESIS` / `CUB3-1402`: 四隅形状の自動生成)
  // Takes 5 axial keyforms (center, left, right, down, up) across two parameters (e.g. ParamAngleX, ParamAngleY)
  // and automatically synthesizes the 4 diagonal corner keyforms:
  // Corner = Center + (H_displacement) + (V_displacement)
  bus.register<{
    target_node_id: string;
    param_x_id?: string;
    param_y_id?: string;
  }>('macro.synthesize_4_corners', (draft, { target_node_id, param_x_id, param_y_id }) => {
    const kfBinding = draft.keyforms.find((k) => k.target_node_id === target_node_id);
    if (!kfBinding || kfBinding.dimensions.length < 2) {
      throw new Error(`Target node '${target_node_id}' does not have a 2D keyform binding`);
    }
    const px = param_x_id || kfBinding.dimensions[0].param_id;
    const py = param_y_id || kfBinding.dimensions[1].param_id;
    const dimX = kfBinding.dimensions.find((d) => d.param_id === px);
    const dimY = kfBinding.dimensions.find((d) => d.param_id === py);
    if (!dimX || !dimY || dimX.keys.length < 3 || dimY.keys.length < 3) {
      throw new Error(`Dimensions must have at least 3 keys (min, center, max)`);
    }

    const xMin = dimX.keys[0];
    const xMid = dimX.keys[1];
    const xMax = dimX.keys[2];
    const yMin = dimY.keys[0];
    const yMid = dimY.keys[1];
    const yMax = dimY.keys[2];

    const findKf = (kx: number, ky: number) =>
      kfBinding.keyforms.find(
        (k) => Math.abs(k.coordinates[0] - kx) < 1e-4 && Math.abs(k.coordinates[1] - ky) < 1e-4
      );

    const kfCenter = findKf(xMid, yMid);
    const kfLeft = findKf(xMin, yMid);
    const kfRight = findKf(xMax, yMid);
    const kfDown = findKf(xMid, yMin);
    const kfUp = findKf(xMid, yMax);

    if (!kfCenter || !kfLeft || !kfRight || !kfDown || !kfUp) {
      throw new Error('5 axial keyforms (center, left, right, down, up) must be set before synthesizing 4 corners');
    }

    const synthesizeWarp = (hKf: typeof kfLeft, vKf: typeof kfUp): [number, number][] => {
      const cPts = (kfCenter.payload as any).control_points as [number, number][];
      const hPts = (hKf.payload as any).control_points as [number, number][];
      const vPts = (vKf.payload as any).control_points as [number, number][];
      return cPts.map(([cx, cy], idx) => {
        const hx = hPts[idx] ? hPts[idx][0] - cx : 0;
        const hy = hPts[idx] ? hPts[idx][1] - cy : 0;
        const vx = vPts[idx] ? vPts[idx][0] - cx : 0;
        const vy = vPts[idx] ? vPts[idx][1] - cy : 0;
        return [cx + hx + vx, cy + hy + vy];
      });
    };

    const corners: [number, number, typeof kfLeft, typeof kfUp][] = [
      [xMin, yMin, kfLeft, kfDown], // Bottom-Left
      [xMax, yMin, kfRight, kfDown], // Bottom-Right
      [xMin, yMax, kfLeft, kfUp],   // Top-Left
      [xMax, yMax, kfRight, kfUp],   // Top-Right
    ];

    for (const [cx, cy, hKf, vKf] of corners) {
      const existingIdx = kfBinding.keyforms.findIndex(
        (k) => Math.abs(k.coordinates[0] - cx) < 1e-4 && Math.abs(k.coordinates[1] - cy) < 1e-4
      );
      let payload: any;
      if (kfCenter.payload.kind === 'Warp') {
        payload = {
          kind: 'Warp' as const,
          control_points: synthesizeWarp(hKf, vKf),
        };
      } else if (kfCenter.payload.kind === 'Rotation') {
        const cRot = kfCenter.payload;
        const hRot = hKf.payload as typeof cRot;
        const vRot = vKf.payload as typeof cRot;
        payload = {
          kind: 'Rotation' as const,
          origin: [
            cRot.origin[0] + (hRot.origin[0] - cRot.origin[0]) + (vRot.origin[0] - cRot.origin[0]),
            cRot.origin[1] + (hRot.origin[1] - cRot.origin[1]) + (vRot.origin[1] - cRot.origin[1]),
          ],
          angle_deg: cRot.angle_deg + (hRot.angle_deg - cRot.angle_deg) + (vRot.angle_deg - cRot.angle_deg),
          scale: [
            cRot.scale[0] + (hRot.scale[0] - cRot.scale[0]) + (vRot.scale[0] - cRot.scale[0]),
            cRot.scale[1] + (hRot.scale[1] - cRot.scale[1]) + (vRot.scale[1] - cRot.scale[1]),
          ],
        };
      } else if (kfCenter.payload.kind === 'ArtMesh') {
        const cMesh = kfCenter.payload;
        const hMesh = hKf.payload as typeof cMesh;
        const vMesh = vKf.payload as typeof cMesh;
        const offsets: [number, number][] = cMesh.vertex_offsets.map(([cx, cy], idx) => {
          const hx = hMesh.vertex_offsets[idx] ? hMesh.vertex_offsets[idx][0] - cx : 0;
          const hy = hMesh.vertex_offsets[idx] ? hMesh.vertex_offsets[idx][1] - cy : 0;
          const vx = vMesh.vertex_offsets[idx] ? vMesh.vertex_offsets[idx][0] - cx : 0;
          const vy = vMesh.vertex_offsets[idx] ? vMesh.vertex_offsets[idx][1] - cy : 0;
          return [cx + hx + vx, cy + hy + vy];
        });
        payload = {
          kind: 'ArtMesh' as const,
          vertex_offsets: offsets,
          opacity: cMesh.opacity,
          multiply_color: cMesh.multiply_color,
          screen_color: cMesh.screen_color,
          draw_order: cMesh.draw_order,
        };
      }

      if (payload) {
        const newKf = { coordinates: [cx, cy], payload };
        if (existingIdx >= 0) kfBinding.keyforms[existingIdx] = newKf;
        else kfBinding.keyforms.push(newKf);
      }
    }
  });

  // 17. Deform Brush / Soft Selection (`CMD_TOOL_MODE_DEFORM_BRUSH` / `CUB3-1891`: 変形ブラシツール)
  bus.register<{
    node_id: string;
    center: [number, number];
    radius: number;
    delta: [number, number];
    falloff?: 'smooth' | 'linear' | 'gaussian';
  }>('deform.soft_brush', (draft, { node_id, center, radius, delta, falloff = 'smooth' }) => {
    const node = draft.nodes.find((n) => n.id === node_id);
    if (!node) throw new Error(`Node '${node_id}' not found`);
    const r = Math.max(1, radius);
    const [cx, cy] = center;
    const [dx, dy] = delta;

    const computeWeight = (px: number, py: number): number => {
      const dist = Math.hypot(px - cx, py - cy);
      if (dist >= r) return 0;
      const t = dist / r;
      if (falloff === 'linear') return 1.0 - t;
      if (falloff === 'gaussian') return Math.exp(-3.0 * t * t);
      // smooth cubic Hermite: (1 - 3t^2 + 2t^3)
      return 1.0 - 3.0 * t * t + 2.0 * t * t * t;
    };

    if (node.kind.type === 'WarpDeformer') {
      node.kind.control_points = node.kind.control_points.map(([px, py]) => {
        const w = computeWeight(px, py);
        return [px + dx * w, py + dy * w];
      });
    } else if (node.kind.type === 'ArtMesh') {
      node.kind.vertices = node.kind.vertices.map(([px, py]) => {
        const w = computeWeight(px, py);
        return [px + dx * w, py + dy * w];
      });
    } else if (node.kind.type === 'DeformPath') {
      node.kind.control_points = node.kind.control_points.map(([px, py]) => {
        const w = computeWeight(px, py);
        return [px + dx * w, py + dy * w];
      });
    }
  });

  // 18. Manual Mesh Vertex Insertion (`CMD_TOOL_MODE_MESH_ADD_VERTEX` / `CUB3-1120`: メッシュ頂点追加)
  bus.register<{
    node_id: string;
    pos: [number, number];
    uv?: [number, number];
  }>('mesh.add_vertex', (draft, { node_id, pos, uv }) => {
    const node = draft.nodes.find((n) => n.id === node_id);
    if (!node || node.kind.type !== 'ArtMesh') {
      throw new Error(`ArtMesh node '${node_id}' not found`);
    }
    const mesh = node.kind;
    const newIdx = mesh.vertices.length;
    mesh.vertices.push(pos);
    mesh.uvs.push(uv || [
      Math.max(0, Math.min(1, pos[0] / (draft.canvas.width || 1))),
      Math.max(0, Math.min(1, pos[1] / (draft.canvas.height || 1))),
    ]);

    // If we have existing triangles, find closest triangle and subdivide into 3 triangles
    if (mesh.indices.length >= 3) {
      let bestTriIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const i0 = mesh.indices[i];
        const i1 = mesh.indices[i + 1];
        const i2 = mesh.indices[i + 2];
        const p0 = mesh.vertices[i0] || pos;
        const p1 = mesh.vertices[i1] || pos;
        const p2 = mesh.vertices[i2] || pos;
        const cx = (p0[0] + p1[0] + p2[0]) / 3.0;
        const cy = (p0[1] + p1[1] + p2[1]) / 3.0;
        const d = Math.hypot(pos[0] - cx, pos[1] - cy);
        if (d < bestDist) {
          bestDist = d;
          bestTriIdx = i;
        }
      }
      const origI0 = mesh.indices[bestTriIdx];
      const origI1 = mesh.indices[bestTriIdx + 1];
      const origI2 = mesh.indices[bestTriIdx + 2];
      // Replace original triangle with (origI0, origI1, newIdx) and append other 2
      mesh.indices[bestTriIdx] = origI0;
      mesh.indices[bestTriIdx + 1] = origI1;
      mesh.indices[bestTriIdx + 2] = newIdx;
      mesh.indices.push(origI1, origI2, newIdx);
      mesh.indices.push(origI2, origI0, newIdx);
    }
  });

  // 19. Delaunay Edge Flip / Swap (`CMD_MESH_FLIP_EDGE` / `CUB3-1122`: 辺の反転)
  bus.register<{
    node_id: string;
    edge: [number, number];
  }>('mesh.flip_edge', (draft, { node_id, edge }) => {
    const node = draft.nodes.find((n) => n.id === node_id);
    if (!node || node.kind.type !== 'ArtMesh') {
      throw new Error(`ArtMesh node '${node_id}' not found`);
    }
    const mesh = node.kind;
    const [vA, vB] = edge;

    // Find the two triangles sharing edge (vA, vB)
    let t0 = -1;
    let t1 = -1;
    let c0 = -1;
    let c1 = -1;

    for (let i = 0; i < mesh.indices.length; i += 3) {
      const tri = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
      const hasA = tri.includes(vA);
      const hasB = tri.includes(vB);
      if (hasA && hasB) {
        const other = tri.find((idx) => idx !== vA && idx !== vB)!;
        if (t0 === -1) {
          t0 = i;
          c0 = other;
        } else if (t1 === -1) {
          t1 = i;
          c1 = other;
          break;
        }
      }
    }

    if (t0 >= 0 && t1 >= 0 && c0 >= 0 && c1 >= 0) {
      // Flip edge: replace (vA, vB, c0) and (vB, vA, c1) with (c0, c1, vA) and (c1, c0, vB)
      mesh.indices[t0] = c0;
      mesh.indices[t0 + 1] = c1;
      mesh.indices[t0 + 2] = vA;
      mesh.indices[t1] = c1;
      mesh.indices[t1 + 1] = c0;
      mesh.indices[t1 + 2] = vB;
    }
  });

  // 20. Glue Weight Paint Brush (`CMD_TOOL_MODE_GLUE_WEIGHT_PAINT` / `CUB3-1784`: グルーのウェイト調整)
  bus.register<{
    glue_id: string;
    center: [number, number];
    radius: number;
    weight_delta: number; // positive increases weight_a, negative increases weight_b
    falloff?: 'smooth' | 'linear';
  }>('glue.paint_weights', (draft, { glue_id, center, radius, weight_delta, falloff = 'smooth' }) => {
    const glue = (draft.glues || []).find((g) => g.id === glue_id);
    if (!glue) throw new Error(`Glue binding '${glue_id}' not found`);
    const meshA = draft.nodes.find((n) => n.id === glue.mesh_a_id);
    const meshB = draft.nodes.find((n) => n.id === glue.mesh_b_id);
    if (!meshA || !meshB || meshA.kind.type !== 'ArtMesh' || meshB.kind.type !== 'ArtMesh') {
      return;
    }
    const r = Math.max(1, radius);
    const [cx, cy] = center;

    for (const pair of glue.vertex_pairs) {
      const pA = meshA.kind.vertices[pair.index_a];
      const pB = meshB.kind.vertices[pair.index_b];
      if (!pA || !pB) continue;
      const midX = (pA[0] + pB[0]) * 0.5;
      const midY = (pA[1] + pB[1]) * 0.5;
      const dist = Math.hypot(midX - cx, midY - cy);
      if (dist < r) {
        const t = dist / r;
        const wFactor = falloff === 'linear' ? 1.0 - t : 1.0 - 3.0 * t * t + 2.0 * t * t * t;
        const step = weight_delta * wFactor;
        pair.weight_a = Math.max(0.0, Math.min(1.0, pair.weight_a + step));
        pair.weight_b = Math.max(0.0, Math.min(1.0, 1.0 - pair.weight_a));
      }
    }
  });

  // 21. Automatic Mesh Generation with Density Presets (CMD_AUTOMATIC_MESH_GENERATOR / CUB3-1125: メッシュの自動生成)
  bus.register<{
    node_id: string;
    density_preset?: 'fine' | 'standard' | 'coarse' | number;
  }>('mesh.auto_generate_mesh', (draft, { node_id, density_preset = 'standard' }) => {
    const node = draft.nodes.find((n) => n.id === node_id);
    if (!node || node.kind.type !== 'ArtMesh') {
      throw new Error(`ArtMesh node '${node_id}' not found`);
    }
    const mesh = node.kind;
    if (mesh.vertices.length === 0) return;

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of mesh.vertices) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const w = Math.max(10, maxX - minX);
    const h = Math.max(10, maxY - minY);

    let cols = 3;
    let rows = 3;
    if (density_preset === 'fine' || density_preset === 4) {
      cols = 6;
      rows = 6;
    } else if (density_preset === 'coarse' || density_preset === 1) {
      cols = 1;
      rows = 1;
    } else if (typeof density_preset === 'number') {
      cols = Math.max(1, Math.min(16, Math.round(density_preset)));
      rows = cols;
    }

    const newVertices: [number, number][] = [];
    const newUvs: [number, number][] = [];
    const newIndices: number[] = [];
    const cw = draft.canvas.width || 1920;
    const ch = draft.canvas.height || 1080;

    for (let r = 0; r <= rows; r++) {
      const vy = minY + (h * r) / rows;
      for (let c = 0; c <= cols; c++) {
        const vx = minX + (w * c) / cols;
        newVertices.push([vx, vy]);
        newUvs.push([
          Math.max(0, Math.min(1, vx / cw)),
          Math.max(0, Math.min(1, vy / ch)),
        ]);
      }
    }

    const stride = cols + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i0 = r * stride + c;
        const i1 = i0 + 1;
        const i2 = (r + 1) * stride + c;
        const i3 = i2 + 1;
        if ((r + c) % 2 === 0) {
          newIndices.push(i0, i1, i2);
          newIndices.push(i1, i3, i2);
        } else {
          newIndices.push(i0, i1, i3);
          newIndices.push(i0, i3, i2);
        }
      }
    }

    mesh.vertices = newVertices;
    mesh.uvs = newUvs;
    mesh.indices = newIndices;
  });

  // 22. Batch Node Reparenting (`CMD_BATCH_REPARENT` / `CUB3-1250`: 親デフォーマ一括設定)
  bus.register<{
    node_ids: string[];
    new_parent_id: string | null;
  }>('node.batch_reparent', (draft, { node_ids, new_parent_id }) => {
    for (const nid of node_ids) {
      const node = draft.nodes.find((n) => n.id === nid);
      if (node && nid !== new_parent_id) {
        node.parent_id = new_parent_id;
      }
    }
  });

  // 23. Batch Node Update (visibility, locked, opacity)
  bus.register<{
    node_ids: string[];
    changes: { visible?: boolean; locked?: boolean; opacity?: number };
  }>('node.batch_update', (draft, { node_ids, changes }) => {
    for (const nid of node_ids) {
      const node = draft.nodes.find((n) => n.id === nid);
      if (node) {
        if (changes.visible !== undefined) node.visible = changes.visible;
        if (changes.locked !== undefined) node.locked = changes.locked;
        if (changes.opacity !== undefined) {
          if (node.kind.type === 'ArtMesh') node.kind.opacity = changes.opacity;
          else if (node.kind.type === 'Part') node.kind.opacity = changes.opacity;
        }
      }
    }
  });

  // 24. Batch Node Delete (`CMD_BATCH_DELETE` / `CUB3-1252`: 複数オブジェクト一括削除)
  bus.register<{
    node_ids: string[];
  }>('node.batch_delete', (draft, { node_ids }) => {
    const toDelete = new Set(node_ids);
    draft.nodes = draft.nodes.filter((n) => !toDelete.has(n.id));
    draft.keyforms = draft.keyforms.filter((k) => !toDelete.has(k.target_node_id));
    if (draft.glues) {
      draft.glues = draft.glues.filter((g) => !toDelete.has(g.mesh_a_id) && !toDelete.has(g.mesh_b_id));
    }
  });

}
