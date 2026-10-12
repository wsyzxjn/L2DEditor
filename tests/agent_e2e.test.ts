import { describe, it, expect } from 'vitest';
import { CommandBus, registerStandardCommands } from '../packages/command/dist/index.js';
import { WasmModel, lintProjectJson } from '../packages/schema/wasm-node/l2d_wasm.js';
import { renderFrameToCanvas, createCanvas } from '../packages/renderer/dist/index.js';
import type { Project } from '../packages/schema/dist/index.js';

describe('Agent-First End-to-End Pipeline', () => {
  const initialProject: Project = {
    format_version: 1,
    canvas: {
      width: 1000,
      height: 1000,
      origin_x: 0.5,
      origin_y: 0.5,
      background_color: '#18181b',
    },
    parameters: [],
    nodes: [],
    keyforms: [],
    textures: [],
  };

  it('should support full headless model assembly via commands, undo reversibility, and linting', () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    // 1. Add parameters
    const cmdAddParamX = {
      id: 'cmd_1',
      name: 'parameter.add',
      params: { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 },
    };
    const res1 = bus.execute(cmdAddParamX);
    expect(res1.success).toBe(true);

    // 2. Add Warp Deformer
    const defaultCps: [number, number][] = [];
    for (let r = 0; r <= 2; r++) {
      for (let c = 0; c <= 2; c++) {
        defaultCps.push([400 + c * 100, 400 + r * 100]);
      }
    }

    const cmdAddWarp = {
      id: 'cmd_2',
      name: 'node.add',
      params: {
        id: 'head_warp',
        name: 'Head Warp',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'WarpDeformer',
          cols: 2,
          rows: 2,
          bounds: [400, 400, 200, 200],
          control_points: defaultCps,
        },
      },
    };
    const res2 = bus.execute(cmdAddWarp);
    expect(res2.success).toBe(true);

    // 3. Add ArtMesh child
    const cmdAddMesh = {
      id: 'cmd_3',
      name: 'node.add',
      params: {
        id: 'head_mesh',
        name: 'Head Mesh',
        parent_id: 'head_warp',
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 'tex_head',
          vertices: [
            [400, 400],
            [600, 400],
            [400, 600],
            [600, 600],
          ],
          uvs: [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ],
          indices: [0, 1, 2, 1, 3, 2],
          blend_mode: 'normal',
          opacity: 1.0,
          draw_order: 10,
          mask_ids: [],
        },
      },
    };
    const res3 = bus.execute(cmdAddMesh);
    expect(res3.success).toBe(true);

    // 4. Run macro to setup 3x3 turn XY
    const cmdMacro = {
      id: 'cmd_4',
      name: 'macro.setup_turn_xy',
      params: { target_node_id: 'head_warp' },
    };
    const res4 = bus.execute(cmdMacro);
    expect(res4.success).toBe(true);

    const assembledProject = bus.getProject();
    expect(assembledProject.parameters.length).toBe(2); // ParamAngleX, ParamAngleY
    expect(assembledProject.nodes.length).toBe(2); // head_warp, head_mesh
    expect(assembledProject.keyforms.length).toBe(1);

    // 5. Lint verification via Rust wasm
    const projectJson = JSON.stringify(assembledProject);
    const diagnostics = lintProjectJson(projectJson) as any[];
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBe(0);

    // 6. Multi-angle Wasm evaluation & deterministic rendering
    const model = new WasmModel(projectJson);

    // Angle X = -30
    model.setParameter('ParamAngleX', -30);
    const frameLeft = model.evaluate() as any;
    expect(frameLeft.meshes.length).toBe(1);
    const leftX0 = frameLeft.meshes[0].vertices[0];

    // Angle X = 0 (neutral)
    model.setParameter('ParamAngleX', 0);
    const frameCenter = model.evaluate() as any;
    const centerX0 = frameCenter.meshes[0].vertices[0];

    // Angle X = +30
    model.setParameter('ParamAngleX', 30);
    const frameRight = model.evaluate() as any;
    const rightX0 = frameRight.meshes[0].vertices[0];

    // Verify monotonic coordinate displacement
    expect(leftX0).toBeLessThan(centerX0);
    expect(centerX0).toBeLessThan(rightX0);

    // 7. Render offline snapshot
    const dummyCanvas = createCanvas(100, 100);
    const ctx = dummyCanvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 100, 100);
    const dummyTexBuf = dummyCanvas.toBuffer('image/png');

    const pngBuffer = renderFrameToCanvas(
      assembledProject.canvas.width,
      assembledProject.canvas.height,
      frameRight,
      (texId) => dummyTexBuf,
      '#18181b'
    );
    expect(pngBuffer.length).toBeGreaterThan(1000);
    // PNG signature check
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50); // P
    expect(pngBuffer[2]).toBe(0x4e); // N
    expect(pngBuffer[3]).toBe(0x47); // G

    // 8. Reversibility & Undo parity check
    const preUndoHash = JSON.stringify(bus.getProject());
    bus.undo(); // undo macro
    bus.undo(); // undo mesh
    bus.undo(); // undo warp
    bus.undo(); // undo param
    expect(bus.getProject()).toEqual(initialProject);

    // Redo all
    bus.redo();
    bus.redo();
    bus.redo();
    bus.redo();
    expect(JSON.stringify(bus.getProject())).toBe(preUndoHash);
  });
});
