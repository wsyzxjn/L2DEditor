import { describe, it, expect } from 'vitest';
import { CommandBus, registerStandardCommands } from '../packages/command/dist/index.js';
import { WasmModel, lintProjectJson } from '../packages/schema/wasm-node/l2d_wasm.js';
import { renderFrameToCanvas, createCanvas, generateTextureAtlas, exportRuntimePackage, createSyntheticWavBuffer, analyzeWavForLipSync } from '../packages/renderer/dist/index.js';
import type { Project } from '../packages/schema/dist/index.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Agent-First Full Feature Pipeline', () => {
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
    glues: [],
    physics: [],
    animations: [],
  };

  it('should support full headless model assembly, deform path, physics, atlas, and runtime export', () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    // 1. Add parameters (including physics-driven hair parameter)
    bus.execute({
      id: 'cmd_1',
      name: 'parameter.add',
      params: { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 },
    });
    bus.execute({
      id: 'cmd_2',
      name: 'parameter.add',
      params: { id: 'ParamHairFront', name: 'Hair Front Sway', min: -1, max: 1, default: 0 },
    });

    // 2. Add Warp Deformer
    const defaultCps: [number, number][] = [];
    for (let r = 0; r <= 2; r++) {
      for (let c = 0; c <= 2; c++) {
        defaultCps.push([400 + c * 100, 400 + r * 100]);
      }
    }

    bus.execute({
      id: 'cmd_3',
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
    });

    // 3. Add ArtMesh with texture
    bus.execute({
      id: 'cmd_4',
      name: 'texture.add',
      params: { id: 'tex_head', path: 'textures/head.png', width: 200, height: 200 },
    });

    bus.execute({
      id: 'cmd_5',
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
    });

    // 4. Add DeformPath targeting head_mesh
    bus.execute({
      id: 'cmd_6',
      name: 'deform_path.create',
      params: {
        id: 'hair_spine_path',
        name: 'Hair Spine Path',
        control_points: [
          [500, 400],
          [500, 600],
        ],
        target_mesh_ids: ['head_mesh'],
      },
    });

    // 5. Add Physics group linking AngleX -> HairFront
    bus.execute({
      id: 'cmd_7',
      name: 'physics.add_group',
      params: {
        id: 'hair_physics',
        name: 'Hair Physics Group',
        inputs: [{ param_id: 'ParamAngleX', weight: 1.0, reflect: false }],
        outputs: [{ param_id: 'ParamHairFront', pendulum_index: 0, angle_scale: 0.05, weight: 1.0 }],
        pendulums: [{ length: 80.0, damping: 0.85, mass: 1.2 }],
      },
    });

    // 6. Run macro to setup 3x3 turn XY
    bus.execute({
      id: 'cmd_8',
      name: 'macro.setup_turn_xy',
      params: { target_node_id: 'head_warp' },
    });

    const assembled = bus.getProject();
    expect(assembled.nodes.length).toBe(3); // warp, mesh, deform_path
    expect(assembled.physics?.length).toBe(1);

    // 7. Verify Lint passes
    const projectJson = JSON.stringify(assembled);
    const diags = lintProjectJson(projectJson) as any[];
    const errors = diags.filter((d) => d.severity === 'error');
    expect(errors.length).toBe(0);

    // 8. Test Texture Atlas Packing
    const dummyCanvas = createCanvas(200, 200);
    const ctx = dummyCanvas.getContext('2d');
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(0, 0, 200, 200);
    const texBuf = dummyCanvas.toBuffer('image/png');

    const atlasRes = generateTextureAtlas(assembled, () => texBuf, 1024, 4);
    expect(atlasRes.atlasPngBuffers.length).toBe(1);
    expect(atlasRes.atlasPngBuffers[0].buffer.length).toBeGreaterThan(500);

    // Remapped UVs must be scaled to atlas coordinate space
    const remappedMesh = atlasRes.updatedProject.nodes.find((n) => n.id === 'head_mesh')!;
    if (remappedMesh.kind.type === 'ArtMesh') {
      expect(remappedMesh.kind.texture_id).toBe('tex_atlas_00');
      expect(remappedMesh.kind.uvs[1][0]).toBeLessThanOrEqual(1.0);
    }

    // 9. Test Standard Runtime Export Package
    const tempExportDir = path.join('/tmp', `l2d_export_${Date.now()}`);
    const exportRes = exportRuntimePackage(assembled, () => texBuf, tempExportDir, {
      modelName: 'chara_test',
      atlasSize: 1024,
    });

    expect(fs.existsSync(exportRes.model3JsonPath)).toBe(true);
    expect(fs.existsSync(path.join(tempExportDir, 'chara_test.physics3.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempExportDir, 'chara_test.cdi3.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempExportDir, 'textures/texture_00.png'))).toBe(true);

    const model3Content = JSON.parse(fs.readFileSync(exportRes.model3JsonPath, 'utf-8'));
    expect(model3Content.Version).toBe(3);
    expect(model3Content.FileReferences.Physics).toBe('chara_test.physics3.json');
    expect(model3Content.FileReferences.Textures[0]).toBe('textures/texture_00.png');

    // 10. Reversibility check
    bus.undo(); // macro
    bus.undo(); // physics
    bus.undo(); // deform path
    bus.undo(); // mesh
    bus.undo(); // texture
    bus.undo(); // warp
    bus.undo(); // param 2
    bus.undo(); // param 1
    expect(bus.getProject()).toEqual(initialProject);
  });

  it('should verify Part opacity inheritance, clipping mask, and multiply/screen color filters', () => {
    const projectWithFeatures: Project = {
      format_version: 1,
      canvas: {
        width: 400,
        height: 400,
        origin_x: 0.5,
        origin_y: 0.5,
        background_color: '#000000',
      },
      parameters: [],
      nodes: [
        {
          id: 'folder_body',
          name: 'Body Folder',
          parent_id: null,
          visible: true,
          locked: false,
          kind: { type: 'Part', opacity: 0.5, collapsed: false },
        },
        {
          id: 'mask_eye_white',
          name: 'Eye White Mask',
          parent_id: 'folder_body',
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_white',
            vertices: [[50, 50], [150, 50], [50, 150], [150, 150]],
            uvs: [[0, 0], [1, 0], [0, 1], [1, 1]],
            indices: [0, 1, 2, 1, 3, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 1,
            mask_ids: [],
          },
        },
        {
          id: 'mesh_pupil',
          name: 'Eye Pupil',
          parent_id: 'folder_body',
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_pupil',
            vertices: [[0, 0], [200, 0], [0, 200], [200, 200]],
            uvs: [[0, 0], [1, 0], [0, 1], [1, 1]],
            indices: [0, 1, 2, 1, 3, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            multiply_color: [0.5, 0.5, 1.0, 1.0], // blue tint
            screen_color: [0.2, 0.0, 0.0, 1.0],  // reddish highlight
            draw_order: 2,
            mask_ids: ['mask_eye_white'], // clipped to eye white!
            is_mask_inverted: false,
          },
        },
      ],
      keyforms: [],
      textures: [
        { id: 'tex_white', path: 'textures/white.png', width: 100, height: 100 },
        { id: 'tex_pupil', path: 'textures/pupil.png', width: 200, height: 200 },
      ],
    };

    const model = new WasmModel(JSON.stringify(projectWithFeatures));
    const frame = model.evaluate() as any;

    expect(frame.meshes.length).toBe(2);
    // Part opacity 0.5 should inherit to both meshes
    expect(frame.meshes[0].opacity).toBeCloseTo(0.5, 3);
    expect(frame.meshes[1].opacity).toBeCloseTo(0.5, 3);

    // Pupil mesh must have mask_ids containing mask_eye_white
    expect(frame.meshes[1].mask_ids).toContain('mask_eye_white');
    expect(frame.meshes[1].multiply_color[0]).toBeCloseTo(0.5, 2);

    // Render snapshot with dummy textures
    const dummyC = createCanvas(100, 100);
    const ctx = dummyC.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);
    const buf = dummyC.toBuffer('image/png');

    const png = renderFrameToCanvas(
      projectWithFeatures.canvas.width,
      projectWithFeatures.canvas.height,
      frame,
      () => buf,
      '#000000'
    );
    expect(png.length).toBeGreaterThan(500);
  });


  it('should analyze audio WAV buffer and generate lip-sync keyframes and export userdata3.json', () => {
    // 1. Generate 1-second 440Hz test WAV
    const wavBuf = createSyntheticWavBuffer(1.0, 440, 44100);
    expect(wavBuf.length).toBeGreaterThan(1000);

    // 2. Analyze for LipSync at 30 fps
    const result = analyzeWavForLipSync(wavBuf, 30);
    expect(result.fps).toBe(30);
    expect(result.durationFrames).toBe(30);
    expect(result.keyframes.length).toBe(30);
    // Non-silent audio should generate mouth open values > 0
    expect(result.keyframes[15].value).toBeGreaterThan(0.05);

    // 3. Test UserData export in runtime package
    const projectWithUserData: Project = {
      format_version: 1,
      canvas: { width: 800, height: 800, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [{ id: 'ParamMouthOpen', name: 'Mouth Open', min: 0, max: 1, default: 0 }],
      nodes: [
        {
          id: 'mesh_head',
          name: 'Head Mesh',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[0, 0], [100, 0], [0, 100]],
            uvs: [[0, 0], [1, 0], [0, 1]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 1,
            mask_ids: [],
            user_data: 'costume_summer_tag',
            hit_area_name: 'Head',
          },
        },
      ],
      keyforms: [],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
    };

    const dummyC = createCanvas(100, 100);
    const ctx = dummyC.getContext('2d');
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, 100, 100);
    const texBuf = dummyC.toBuffer('image/png');

    const tempDir = path.join('/tmp', `l2d_userdata_test_${Date.now()}`);
    const exportRes = exportRuntimePackage(projectWithUserData, () => texBuf, tempDir, {
      modelName: 'userdata_model',
    });

    const userdataPath = path.join(tempDir, 'userdata_model.userdata3.json');
    expect(fs.existsSync(userdataPath)).toBe(true);

    const userdataJson = JSON.parse(fs.readFileSync(userdataPath, 'utf-8'));
    expect(userdataJson.Version).toBe(3);
    expect(userdataJson.UserData[0].Id).toBe('mesh_head');
    expect(userdataJson.UserData[0].Value).toBe('costume_summer_tag');

    // model3.json must reference the userdata3.json
    const model3Json = JSON.parse(fs.readFileSync(exportRes.model3JsonPath, 'utf-8'));
    expect(model3Json.FileReferences.UserData).toBe('userdata_model.userdata3.json');
    expect(model3Json.HitAreas[0].Name).toBe('Head');
  });

});
