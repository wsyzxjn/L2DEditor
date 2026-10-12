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
    if (parent_id === id) {
      throw new Error('A node cannot be parented to itself');
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
}
