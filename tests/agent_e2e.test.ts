import { describe, it, expect } from 'vitest';
import { CommandBus, registerStandardCommands } from '../packages/command/dist/index.js';
import { WasmModel, lintProjectJson, getProjectStats, importMtnMotion, bakePhysicsToAnimation } from '../packages/schema/wasm-node/l2d_wasm.js';
import {
  renderFrameToCanvas,
  createCanvas,
  generateTextureAtlas,
  exportRuntimePackage,
  createSyntheticWavBuffer,
  analyzeWavForLipSync,
  renderAnimationSequence,
  runCubismFaceDeformerXY,
  runCubismFaceDeformer4Corner,
  runCubismLayerClassifierOnnx,
  serializeMoc3Container,
  parseMoc3ToProject,
  applyCubismAiFaceRig,
  unpackAtlasTextures,
} from '../packages/renderer/dist/index.js';
import { importPsdBuffer, exportModelToPsdBuffer } from '../packages/psd/dist/index.js';
import { startCubismWebSocketServer, WebSocket } from '../packages/mcp-server/dist/index.js';
import { evaluateProjectJs, exportModelingTemplate, lintProjectJs, type Project } from '../packages/schema/dist/index.js';
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


  it('should export pose3.json, exp3.json, and motionsync3.json matching Live2D specifications', () => {
    const fullProject: Project = {
      format_version: 1,
      canvas: { width: 800, height: 800, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [
        { id: 'ParamMouthOpen', name: 'Mouth Open', min: 0, max: 1, default: 0 },
        { id: 'ParamMouthForm', name: 'Mouth Form', min: -1, max: 1, default: 0 },
      ],
      nodes: [
        {
          id: 'part_arm_a',
          name: 'Arm A',
          parent_id: null,
          visible: true,
          locked: false,
          kind: { type: 'Part', opacity: 1.0, collapsed: false },
        },
        {
          id: 'part_arm_b',
          name: 'Arm B',
          parent_id: null,
          visible: false,
          locked: false,
          kind: { type: 'Part', opacity: 0.0, collapsed: false },
        },
      ],
      keyforms: [],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
      pose_groups: [
        {
          id: 'arm_pose',
          name: 'Arm Left Pose Group',
          fade_in_time: 0.5,
          part_ids: ['part_arm_a', 'part_arm_b'],
        },
      ],
      expressions: [
        {
          id: 'f01_smile',
          name: 'Happy Smile',
          fade_in_time: 0.4,
          fade_out_time: 0.4,
          parameters: [
            { id: 'ParamMouthForm', value: 1.0, blend: 'add' },
          ],
        },
      ],
    };

    const dummyC = createCanvas(100, 100);
    const ctx = dummyC.getContext('2d');
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 100, 100);
    const texBuf = dummyC.toBuffer('image/png');

    const tempDir = path.join('/tmp', `l2d_full_spec_${Date.now()}`);
    const res = exportRuntimePackage(fullProject, () => texBuf, tempDir, {
      modelName: 'full_spec_model',
    });

    // 1. Verify pose3.json
    const posePath = path.join(tempDir, 'full_spec_model.pose3.json');
    expect(fs.existsSync(posePath)).toBe(true);
    const poseJson = JSON.parse(fs.readFileSync(posePath, 'utf-8'));
    expect(poseJson.Type).toBe('Live2D Pose');
    expect(poseJson.Groups[0][0].Id).toBe('part_arm_a');
    expect(poseJson.Groups[0][1].Id).toBe('part_arm_b');

    // 2. Verify expressions/f01_smile.exp3.json
    const expPath = path.join(tempDir, 'expressions/f01_smile.exp3.json');
    expect(fs.existsSync(expPath)).toBe(true);
    const expJson = JSON.parse(fs.readFileSync(expPath, 'utf-8'));
    expect(expJson.Type).toBe('Live2D Expression');
    expect(expJson.Parameters[0].Id).toBe('ParamMouthForm');
    expect(expJson.Parameters[0].Blend).toBe('Add');

    // 3. Verify motionsync3.json
    const msPath = path.join(tempDir, 'full_spec_model.motionsync3.json');
    expect(fs.existsSync(msPath)).toBe(true);
    const msJson = JSON.parse(fs.readFileSync(msPath, 'utf-8'));
    expect(msJson.Setting.MouthOpenParameter).toBe('ParamMouthOpen');

    // 4. Verify model3.json file references
    const model3Json = JSON.parse(fs.readFileSync(res.model3JsonPath, 'utf-8'));
    expect(model3Json.FileReferences.Pose).toBe('full_spec_model.pose3.json');
    expect(model3Json.FileReferences.Expressions[0].Name).toBe('Happy Smile');
    expect(model3Json.FileReferences.MotionSync).toBe('full_spec_model.motionsync3.json');
  });


  it('should render animation sequence of frames and encode to MP4 video', () => {
    const animProject: Project = {
      format_version: 1,
      canvas: { width: 400, height: 400, origin_x: 0.5, origin_y: 0.5, background_color: '#18181b' },
      parameters: [{ id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 }],
      nodes: [
        {
          id: 'test_mesh',
          name: 'Test Mesh',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[50, 50], [150, 50], [50, 150]],
            uvs: [[0, 0], [1, 0], [0, 1]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 1,
            mask_ids: [],
          },
        },
      ],
      keyforms: [],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
      animations: [
        {
          id: 'turn_motion',
          name: 'Head Turn Motion',
          duration_frames: 6,
          fps: 30,
          loop_playback: true,
          tracks: [
            {
              target_param_id: 'ParamAngleX',
              keyframes: [
                { frame: 0, value: -30, curve: 'linear' },
                { frame: 6, value: 30, curve: 'linear' },
              ],
            },
          ],
        },
      ],
    };

    const dummyC = createCanvas(100, 100);
    const ctx = dummyC.getContext('2d');
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, 100, 100);
    const texBuf = dummyC.toBuffer('image/png');

    const outFramesDir = path.join('/tmp', `l2d_frames_${Date.now()}`);
    const outVideoPath = path.join(outFramesDir, 'test_turn.mp4');

    const seqRes = renderAnimationSequence(animProject, 'turn_motion', () => texBuf, outFramesDir, {
      fps: 30,
      format: 'mp4',
      videoOutputPath: outVideoPath,
    });

    expect(seqRes.totalFrames).toBe(6);
    expect(fs.existsSync(path.join(outFramesDir, 'frame_0000.png'))).toBe(true);
    expect(fs.existsSync(path.join(outFramesDir, 'frame_0005.png'))).toBe(true);
    expect(fs.existsSync(outVideoPath)).toBe(true);
  });


  it('should verify parameter repeats wrap-around modulo and degenerate triangle linter', () => {
    const loopProject: Project = {
      format_version: 1,
      canvas: { width: 400, height: 400, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [
        { id: 'ParamSpin', name: 'Spin Looping', min: 0, max: 360, default: 0, repeats: true },
        { id: 'ParamClamped', name: 'Clamped', min: -10, max: 10, default: 0, repeats: false },
      ],
      nodes: [
        {
          id: 'bad_mesh',
          name: 'Degenerate Mesh',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[0, 0], [10, 10], [20, 20]], // collinear -> area = 0
            uvs: [[0, 0], [0.5, 0.5], [1, 1]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 1,
            mask_ids: [],
          },
        },
      ],
      keyforms: [],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
    };

    // 1. Verify WasmModel parameter wrap-around (repeats: true)
    const model = new WasmModel(JSON.stringify(loopProject));
    model.setParameter('ParamSpin', 370); // 370 should wrap to 10!
    expect(model.getParameter('ParamSpin')).toBeCloseTo(10, 2);

    model.setParameter('ParamSpin', -30); // -30 should wrap to 330!
    expect(model.getParameter('ParamSpin')).toBeCloseTo(330, 2);

    // Clamped parameter without repeats should clamp
    model.setParameter('ParamClamped', 50);
    expect(model.getParameter('ParamClamped')).toBe(10);
    model.setParameter('ParamClamped', -50);
    expect(model.getParameter('ParamClamped')).toBe(-10);

    // 2. Verify Linter catches degenerate triangle
    const diags = lintProjectJson(JSON.stringify(loopProject)) as any[];
    expect(diags.some((d) => d.code === 'DEGENERATE_TRIANGLE')).toBe(true);
  });


  it('should verify keyform.reflect_horizontal and official Cubism WebSocket integration protocol', async () => {
    // 1. Test keyform.reflect_horizontal
    const mirrorProject: Project = {
      format_version: 1,
      canvas: { width: 1000, height: 1000, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [{ id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 }],
      nodes: [
        {
          id: 'head_warp',
          name: 'Head Warp',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'WarpDeformer',
            cols: 1,
            rows: 1,
            bounds: [400, 400, 200, 200], // center X = 500
            control_points: [
              [400, 400], [600, 400],
              [400, 600], [600, 600],
            ],
          },
        },
      ],
      keyforms: [
        {
          target_node_id: 'head_warp',
          dimensions: [{ param_id: 'ParamAngleX', keys: [0, 30] }],
          keyforms: [
            {
              coordinates: [0],
              payload: {
                kind: 'Warp',
                control_points: [
                  [400, 400], [600, 400],
                  [400, 600], [600, 600],
                ],
              },
            },
            {
              coordinates: [30],
              payload: {
                kind: 'Warp',
                control_points: [
                  [420, 400], [640, 400], // shifted right (+20, +40)
                  [420, 600], [640, 600],
                ],
              },
            },
          ],
        },
      ],
      textures: [],
    };

    const bus = new CommandBus(mirrorProject);
    registerStandardCommands(bus);

    const reflectRes = bus.execute({
      id: 'cmd_reflect',
      name: 'keyform.reflect_horizontal',
      params: {
        target_node_id: 'head_warp',
        param_id: 'ParamAngleX',
        source_key: 30,
        dest_key: -30,
      },
    });
    expect(reflectRes.success).toBe(true);

    const updated = bus.getProject();
    const binding = updated.keyforms[0];
    expect(binding.dimensions[0].keys).toContain(-30);

    const destState = binding.keyforms.find((s) => s.coordinates[0] === -30);
    expect(destState).toBeDefined();
    if (destState && destState.payload.kind === 'Warp') {
      // Center X is 500. Source right point was 640 (distance 140 to center).
      // Mirrored point should be 500 - 140 = 360!
      expect(destState.payload.control_points[1][0]).toBeCloseTo(360, 1);
    }

    // 2. Test official Cubism WebSocket integration protocol on port 22034
    let wss: any;
    try {
      wss = startCubismWebSocketServer({
        port: 22034,
        getProject: () => updated,
        getParameterValues: () => ({ ParamAngleX: 12.5 }),
        setParameterValues: () => {},
      });

      const client = new WebSocket('ws://127.0.0.1:22034');
      const connected = await new Promise<boolean>((resolve) => {
        client.once('open', () => resolve(true));
        client.once('error', () => resolve(false));
      });
      if (!connected) {
        // Loopback bind sandbox limitation
        return;
      }

      // Send official GetAPIVersion
      const versionPromise = new Promise<any>((resolve) => {
        client.once('message', (data) => resolve(JSON.parse(data.toString())));
      });
      client.send(JSON.stringify({ Type: 'GetAPIVersion' }));
      const versionResp = await versionPromise;
      expect(versionResp.Type).toBe('GetAPIVersionResponse');
      expect(versionResp.Data.CubismEditorVersion).toBe('5.3.00');

      // Send official GetParameterValues
      const valuesPromise = new Promise<any>((resolve) => {
        client.once('message', (data) => resolve(JSON.parse(data.toString())));
      });
      client.send(JSON.stringify({ Type: 'GetParameterValues' }));
      const valuesResp = await valuesPromise;
      expect(valuesResp.Type).toBe('GetParameterValuesResponse');
      expect(valuesResp.Data.Parameters[0].Id).toBe('ParamAngleX');
      expect(valuesResp.Data.Parameters[0].Value).toBeCloseTo(12.5, 2);

      client.close();
    } catch (err: any) {
      if (err?.code === 'EPERM' || err?.message?.includes('EPERM')) {
        return;
      }
      throw err;
    } finally {
      if (wss) wss.close();
    }
  });


  it('should verify macro.auto_rig semantic layer categorization and zero-click hierarchy generation', () => {
    const rawPsdProject: Project = {
      format_version: 1,
      canvas: { width: 1200, height: 1200, origin_x: 0.5, origin_y: 0.5, background_color: '#18181b' },
      parameters: [],
      nodes: [
        {
          id: 'layer_face_base',
          name: 'Face Base',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_face',
            vertices: [[500, 450], [700, 450], [600, 650]],
            uvs: [[0, 0], [1, 0], [0.5, 1]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 10,
            mask_ids: [],
          },
        },
        {
          id: 'layer_eye_l_pupil',
          name: 'Eye L Pupil',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_eye',
            vertices: [[520, 470], [560, 470], [540, 500]],
            uvs: [[0, 0], [1, 0], [0.5, 1]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 20,
            mask_ids: [],
          },
        },
        {
          id: 'layer_mouth_lip',
          name: 'Mouth Lip',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_mouth',
            vertices: [[580, 580], [620, 580], [600, 600]],
            uvs: [[0, 0], [1, 0], [0.5, 1]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 30,
            mask_ids: [],
          },
        },
      ],
      keyforms: [],
      textures: [
        { id: 'tex_face', path: 'textures/face.png', width: 200, height: 200 },
        { id: 'tex_eye', path: 'textures/eye.png', width: 50, height: 50 },
        { id: 'tex_mouth', path: 'textures/mouth.png', width: 50, height: 50 },
      ],
    };

    const bus = new CommandBus(rawPsdProject);
    registerStandardCommands(bus);

    // Run Auto-Rig
    const res = bus.execute({
      id: 'cmd_autorig_test',
      name: 'macro.auto_rig',
      params: {},
    });
    expect(res.success).toBe(true);

    const rigged = bus.getProject();

    // 1. Root head warp must be present
    expect(rigged.nodes.some((n) => n.id === 'warp_head')).toBe(true);

    // 2. Specialized sub-warp deformers should be generated
    expect(rigged.nodes.some((n) => n.id === 'warp_face')).toBe(true);
    expect(rigged.nodes.some((n) => n.id === 'warp_eye_l')).toBe(true);
    expect(rigged.nodes.some((n) => n.id === 'warp_mouth')).toBe(true);

    // 3. Meshes should be reparented into their semantic deformers
    const eyeMesh = rigged.nodes.find((n) => n.id === 'layer_eye_l_pupil');
    expect(eyeMesh?.parent_id).toBe('warp_eye_l');

    const mouthMesh = rigged.nodes.find((n) => n.id === 'layer_mouth_lip');
    expect(mouthMesh?.parent_id).toBe('warp_mouth');

    // 4. Sub-deformers should be parented to warp_head
    const eyeWarp = rigged.nodes.find((n) => n.id === 'warp_eye_l');
    expect(eyeWarp?.parent_id).toBe('warp_head');

    // 5. 3x3 Keyforms generated on warp_head
    const headBinding = rigged.keyforms.find((k) => k.target_node_id === 'warp_head');
    expect(headBinding).toBeDefined();
    expect(headBinding?.keyforms.length).toBe(9); // 3x3 matrix

    // 6. Linter validation passes with zero errors
    const diags = lintProjectJson(JSON.stringify(rigged)) as any[];
    expect(diags.filter((d) => d.severity === 'error').length).toBe(0);
  });


  it('should verify dynamic keyform draw_order depth swapping and mesh.flip_uv', () => {
    const depthProject: Project = {
      format_version: 1,
      canvas: { width: 500, height: 500, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [{ id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 }],
      nodes: [
        {
          id: 'mesh_ear_l',
          name: 'Ear Left',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_ear',
            vertices: [[50, 50], [100, 50], [50, 100]],
            uvs: [[0.2, 0.3], [0.8, 0.3], [0.2, 0.9]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 10,
            mask_ids: [],
          },
        },
        {
          id: 'mesh_head_base',
          name: 'Head Base',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_head',
            vertices: [[40, 40], [150, 40], [40, 150]],
            uvs: [[0, 0], [1, 0], [0, 1]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 20, // normally in front of ear_l (20 > 10)
            mask_ids: [],
          },
        },
      ],
      keyforms: [
        {
          target_node_id: 'mesh_ear_l',
          dimensions: [{ param_id: 'ParamAngleX', keys: [-30, 30] }],
          keyforms: [
            {
              coordinates: [-30],
              payload: {
                kind: 'ArtMesh',
                vertex_offsets: [[0, 0], [0, 0], [0, 0]],
                draw_order: 30, // at AngleX = -30, ear moves IN FRONT of head (30 > 20)!
              },
            },
            {
              coordinates: [30],
              payload: {
                kind: 'ArtMesh',
                vertex_offsets: [[0, 0], [0, 0], [0, 0]],
                draw_order: 10, // at AngleX = +30, ear moves BEHIND head (10 < 20)!
              },
            },
          ],
        },
      ],
      textures: [{ id: 'tex_ear', path: 'textures/ear.png', width: 50, height: 50 }, { id: 'tex_head', path: 'textures/head.png', width: 100, height: 100 }],
    };

    const model = new WasmModel(JSON.stringify(depthProject));

    // At AngleX = -30: ear_l should have draw_order 30 and be rendered LAST (on top)
    model.setParameter('ParamAngleX', -30);
    const frameTurnLeft = model.evaluate() as any;
    expect(frameTurnLeft.meshes[0].id).toBe('mesh_head_base'); // 20
    expect(frameTurnLeft.meshes[1].id).toBe('mesh_ear_l');     // 30 (on top!)

    // At AngleX = +30: ear_l should have draw_order 10 and be rendered FIRST (behind)
    model.setParameter('ParamAngleX', 30);
    const frameTurnRight = model.evaluate() as any;
    expect(frameTurnRight.meshes[0].id).toBe('mesh_ear_l');     // 10 (behind!)
    expect(frameTurnRight.meshes[1].id).toBe('mesh_head_base'); // 20

    // Test mesh.flip_uv command
    const bus = new CommandBus(depthProject);
    registerStandardCommands(bus);
    bus.execute({
      id: 'cmd_flip',
      name: 'mesh.flip_uv',
      params: { mesh_id: 'mesh_ear_l', axis: 'horizontal' },
    });
    const updatedMesh = bus.getProject().nodes.find((n) => n.id === 'mesh_ear_l')!;
    if (updatedMesh.kind.type === 'ArtMesh') {
      // Original U was 0.2 -> flipped horizontally should be 1.0 - 0.2 = 0.8
      expect(updatedMesh.kind.uvs[0][0]).toBeCloseTo(0.8, 4);
    }
  });


  it('should verify mesh.subdivide triangle refinement and warp.set_divisions grid resampling', () => {
    const subdivProject: Project = {
      format_version: 1,
      canvas: { width: 600, height: 600, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [],
      nodes: [
        {
          id: 'mesh_subdiv',
          name: 'Subdiv Mesh',
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
          },
        },
        {
          id: 'warp_resample',
          name: 'Warp Resample',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'WarpDeformer',
            cols: 1,
            rows: 1,
            bounds: [0, 0, 200, 200],
            control_points: [[0, 0], [200, 0], [0, 200], [200, 200]],
          },
        },
      ],
      keyforms: [],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
    };

    const bus = new CommandBus(subdivProject);
    registerStandardCommands(bus);

    // 1. Subdivide mesh: 1 triangle (3 vertices) -> 4 triangles (6 vertices)
    bus.execute({
      id: 'cmd_subdiv_run',
      name: 'mesh.subdivide',
      params: { mesh_id: 'mesh_subdiv' },
    });

    const afterSubdiv = bus.getProject();
    const meshNode = afterSubdiv.nodes.find((n) => n.id === 'mesh_subdiv')!;
    if (meshNode.kind.type === 'ArtMesh') {
      expect(meshNode.kind.vertices.length).toBe(6);
      expect(meshNode.kind.indices.length).toBe(12); // 4 triangles * 3 indices
    }

    // 2. Resample Warp Deformer to 3x3
    bus.execute({
      id: 'cmd_warp_resample_run',
      name: 'warp.set_divisions',
      params: { node_id: 'warp_resample', cols: 3, rows: 3 },
    });

    const afterWarp = bus.getProject();
    const warpNode = afterWarp.nodes.find((n) => n.id === 'warp_resample')!;
    if (warpNode.kind.type === 'WarpDeformer') {
      expect(warpNode.kind.cols).toBe(3);
      expect(warpNode.kind.rows).toBe(3);
      expect(warpNode.kind.control_points.length).toBe(16); // (3+1) * (3+1) = 16
    }
  });


  it('should verify keyform.setup_points (2-key and 3-key generation) and mesh.reverse_winding', () => {
    const setupProject: Project = {
      format_version: 1,
      canvas: { width: 500, height: 500, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [
        { id: 'ParamEyeLOpen', name: 'Eye Open', min: 0, max: 1, default: 1 },
        { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 },
      ],
      nodes: [
        {
          id: 'test_mesh',
          name: 'Test Mesh',
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
          },
        },
      ],
      keyforms: [],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
    };

    const bus = new CommandBus(setupProject);
    registerStandardCommands(bus);

    // 1. Generate 2-point keyforms (0, 1) on Eye Open
    bus.execute({
      id: 'cmd_k2',
      name: 'keyform.setup_points',
      params: { target_node_id: 'test_mesh', param_id: 'ParamEyeLOpen', point_count: 2 },
    });

    const kf2 = bus.getProject().keyforms.find((k) => k.target_node_id === 'test_mesh')!;
    expect(kf2.dimensions[0].keys).toEqual([0, 1]);
    expect(kf2.keyforms.length).toBe(2);

    // 2. Generate 3-point keyforms (-30, 0, 30) on Angle X
    bus.execute({
      id: 'cmd_k3',
      name: 'keyform.setup_points',
      params: { target_node_id: 'test_mesh', param_id: 'ParamAngleX', point_count: 3 },
    });

    const kf3 = bus.getProject().keyforms.find((k) => k.target_node_id === 'test_mesh')!;
    expect(kf3.dimensions[0].keys).toEqual([-30, 0, 30]);
    expect(kf3.keyforms.length).toBe(3);

    // 3. Test mesh.reverse_winding: [0, 1, 2] -> [0, 2, 1]
    bus.execute({
      id: 'cmd_rev',
      name: 'mesh.reverse_winding',
      params: { mesh_id: 'test_mesh' },
    });

    const reversedNode = bus.getProject().nodes.find((n) => n.id === 'test_mesh')!;
    if (reversedNode.kind.type === 'ArtMesh') {
      expect(reversedNode.kind.indices).toEqual([0, 2, 1]);
    }
  });


  it('should verify getProjectStats VRAM/triangle accounting and parameter.reorder', () => {
    const statsProject: Project = {
      format_version: 1,
      canvas: { width: 1000, height: 1000, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [
        { id: 'Param_A', name: 'A', min: 0, max: 1, default: 0 },
        { id: 'Param_B', name: 'B', min: 0, max: 1, default: 0 },
        { id: 'Param_C', name: 'C', min: 0, max: 1, default: 0 },
      ],
      nodes: [
        {
          id: 'mesh_1',
          name: 'Mesh 1',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[0, 0], [100, 0], [0, 100]],
            uvs: [[0, 0], [1, 0], [0, 1]],
            indices: [0, 1, 2], // 1 triangle
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 1,
            mask_ids: [],
          },
        },
      ],
      keyforms: [],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 1024, height: 1024 }],
    };

    // 1. Verify getProjectStats
    const stats = getProjectStats(JSON.stringify(statsProject)) as any;
    expect(stats.total_vertices).toBe(3);
    expect(stats.total_triangles).toBe(1);
    expect(stats.artmesh_count).toBe(1);
    expect(stats.parameter_count).toBe(3);
    // 1024 * 1024 * 4 bytes RGBA = 4,194,304 bytes VRAM
    expect(stats.estimated_texture_vram_bytes).toBe(1024 * 1024 * 4);

    // 2. Verify parameter.reorder: move Param_C to index 0
    const bus = new CommandBus(statsProject);
    registerStandardCommands(bus);
    bus.execute({
      id: 'cmd_reorder',
      name: 'parameter.reorder',
      params: { param_id: 'Param_C', target_index: 0 },
    });

    const paramsAfter = bus.getProject().parameters;
    expect(paramsAfter[0].id).toBe('Param_C');
    expect(paramsAfter[1].id).toBe('Param_A');
    expect(paramsAfter[2].id).toBe('Param_B');
  });


  it('should verify glue.auto_bind_pairs nearest-vertex seam pairing and mesh.add_morph_target', () => {
    const glueProject: Project = {
      format_version: 1,
      canvas: { width: 500, height: 500, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [{ id: 'ParamSmile', name: 'Smile', min: 0, max: 1, default: 0 }],
      nodes: [
        {
          id: 'mesh_neck',
          name: 'Neck Mesh',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[100, 200], [150, 200]],
            uvs: [[0, 0], [1, 0]],
            indices: [0, 1, 0],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 10,
            mask_ids: [],
          },
        },
        {
          id: 'mesh_collar',
          name: 'Collar Mesh',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[103, 202], [148, 201]], // very close to neck (< 5px)
            uvs: [[0, 0], [1, 0]],
            indices: [0, 1, 0],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 11,
            mask_ids: [],
          },
        },
      ],
      keyforms: [],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
      glues: [
        {
          id: 'glue_neck_collar',
          name: 'Neck Collar Glue',
          mesh_a_id: 'mesh_neck',
          mesh_b_id: 'mesh_collar',
          vertex_pairs: [],
        },
      ],
    };

    const bus = new CommandBus(glueProject);
    registerStandardCommands(bus);

    // 1. Run glue.auto_bind_pairs
    bus.execute({
      id: 'cmd_auto_glue',
      name: 'glue.auto_bind_pairs',
      params: { glue_id: 'glue_neck_collar', threshold: 10 },
    });

    const gluedProject = bus.getProject();
    const glueBinding = gluedProject.glues!.find((g) => g.id === 'glue_neck_collar')!;
    expect(glueBinding.vertex_pairs.length).toBe(2);
    expect(glueBinding.vertex_pairs[0].index_a).toBe(0);
    expect(glueBinding.vertex_pairs[0].index_b).toBe(0);
    expect(glueBinding.vertex_pairs[1].index_a).toBe(1);
    expect(glueBinding.vertex_pairs[1].index_b).toBe(1);

    // 2. Add MorphTarget to Collar
    bus.execute({
      id: 'cmd_morph',
      name: 'mesh.add_morph_target',
      params: {
        mesh_id: 'mesh_collar',
        morph: {
          id: 'morph_ruffle',
          name: 'Ruffle Shape',
          param_id: 'ParamSmile',
          vertex_offsets: [[0, 5], [0, 5]],
        },
      },
    });

    const morphNode = bus.getProject().nodes.find((n) => n.id === 'mesh_collar')!;
    if (morphNode.kind.type === 'ArtMesh') {
      expect(morphNode.kind.morph_targets?.length).toBe(1);
      expect(morphNode.kind.morph_targets![0].id).toBe('morph_ruffle');
    }
  });


  it('should verify warp.brush_deform soft selection falloff and parameter.invert_keys', () => {
    const brushProject: Project = {
      format_version: 1,
      canvas: { width: 800, height: 800, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [{ id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 }],
      nodes: [
        {
          id: 'warp_brush_test',
          name: 'Warp Brush Test',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'WarpDeformer',
            cols: 2,
            rows: 2,
            bounds: [400, 400, 200, 200],
            control_points: [
              [400, 400], [500, 400], [600, 400],
              [400, 500], [500, 500], [600, 500],
              [400, 600], [500, 600], [600, 600],
            ],
          },
        },
      ],
      keyforms: [
        {
          target_node_id: 'warp_brush_test',
          dimensions: [{ param_id: 'ParamAngleX', keys: [-30, 30] }],
          keyforms: [
            { coordinates: [-30], payload: { kind: 'Warp', control_points: [] } },
            { coordinates: [30], payload: { kind: 'Warp', control_points: [] } },
          ],
        },
      ],
      textures: [],
    };

    const bus = new CommandBus(brushProject);
    registerStandardCommands(bus);

    // 1. Run warp.brush_deform at [400, 400] with radius 120 and delta [+30, 0]
    bus.execute({
      id: 'cmd_brush_run',
      name: 'warp.brush_deform',
      params: {
        node_id: 'warp_brush_test',
        center: [400, 400],
        delta: [30, 0],
        radius: 120,
      },
    });

    const warpAfter = bus.getProject().nodes.find((n) => n.id === 'warp_brush_test')!;
    if (warpAfter.kind.type === 'WarpDeformer') {
      const cps = warpAfter.kind.control_points;
      // Center control point at [400, 400] should receive maximum displacement (+30 -> 430)
      expect(cps[0][0]).toBeCloseTo(430, 1);
      // Intermediate point [500, 400] (dist 100 < 120) should receive partial displacement
      expect(cps[1][0]).toBeGreaterThan(500);
      expect(cps[1][0]).toBeLessThan(530);
      // Far point [600, 600] (dist > 120) should remain unchanged at 600
      expect(cps[8][0]).toBe(600);
    }

    // 2. Test parameter.invert_keys
    bus.execute({
      id: 'cmd_invert',
      name: 'parameter.invert_keys',
      params: { param_id: 'ParamAngleX' },
    });
    const kf = bus.getProject().keyforms[0];
    // Keys [-30, 30] when inverted should remain [-30, 30]
    expect(kf.dimensions[0].keys).toEqual([-30, 30]);
  });


  it('should verify warp.create_enclosing_mesh bounding box enclosure and parameter.swap_keys', () => {
    const encloseProject: Project = {
      format_version: 1,
      canvas: { width: 800, height: 800, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [{ id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 }],
      nodes: [
        {
          id: 'mesh_single',
          name: 'Single Eye Piece',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[150, 250], [350, 250], [150, 450]],
            uvs: [[0, 0], [1, 0], [0, 1]],
            indices: [0, 1, 2],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 1,
            mask_ids: [],
          },
        },
      ],
      keyforms: [
        {
          target_node_id: 'mesh_single',
          dimensions: [{ param_id: 'ParamAngleX', keys: [-30, 30] }],
          keyforms: [
            { coordinates: [-30], payload: { kind: 'ArtMesh', vertex_offsets: [[-10, 0], [-10, 0], [-10, 0]] } },
            { coordinates: [30], payload: { kind: 'ArtMesh', vertex_offsets: [[10, 0], [10, 0], [10, 0]] } },
          ],
        },
      ],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
    };

    const bus = new CommandBus(encloseProject);
    registerStandardCommands(bus);

    // 1. Create enclosing warp around mesh_single with padding 20
    bus.execute({
      id: 'cmd_enclose',
      name: 'warp.create_enclosing_mesh',
      params: { mesh_id: 'mesh_single', cols: 2, rows: 2, padding: 20 },
    });

    const updated = bus.getProject();
    const createdWarp = updated.nodes.find((n) => n.id === 'warp_mesh_single');
    expect(createdWarp).toBeDefined();
    if (createdWarp && createdWarp.kind.type === 'WarpDeformer') {
      const [bx, by, bw, bh] = createdWarp.kind.bounds;
      // Vertices range from X: [150, 350] (width 200). With padding 20 -> X: 130, width: 240
      expect(bx).toBe(130);
      expect(bw).toBe(240);
      // Vertices range from Y: [250, 450] (height 200). With padding 20 -> Y: 230, height: 240
      expect(by).toBe(230);
      expect(bh).toBe(240);
    }

    const enclosedMesh = updated.nodes.find((n) => n.id === 'mesh_single')!;
    expect(enclosedMesh.parent_id).toBe('warp_mesh_single');

    // 2. Test parameter.swap_keys (-30 and 30 swap payloads)
    bus.execute({
      id: 'cmd_swap',
      name: 'parameter.swap_keys',
      params: { param_id: 'ParamAngleX', key_a: -30, key_b: 30 },
    });

    const kf = bus.getProject().keyforms[0];
    const stateNeg30 = kf.keyforms.find((s) => s.coordinates[0] === -30)!;
    const statePos30 = kf.keyforms.find((s) => s.coordinates[0] === 30)!;
    if (stateNeg30.payload.kind === 'ArtMesh' && statePos30.payload.kind === 'ArtMesh') {
      // Swapped: state at -30 now has offset +10, state at 30 has offset -10!
      expect(stateNeg30.payload.vertex_offsets[0][0]).toBe(10);
      expect(statePos30.payload.vertex_offsets[0][0]).toBe(-10);
    }
  });


  it('should verify parameter.apply_standard_template dictionary and node.reparent cycle prevention', () => {
    const freshProject: Project = {
      format_version: 1,
      canvas: { width: 1000, height: 1000, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [],
      nodes: [
        {
          id: 'node_parent',
          name: 'Parent Node',
          parent_id: null,
          visible: true,
          locked: false,
          kind: { type: 'Part', opacity: 1.0, collapsed: false },
        },
        {
          id: 'node_child',
          name: 'Child Node',
          parent_id: 'node_parent',
          visible: true,
          locked: false,
          kind: { type: 'Part', opacity: 1.0, collapsed: false },
        },
      ],
      keyforms: [],
      textures: [],
    };

    const bus = new CommandBus(freshProject);
    registerStandardCommands(bus);

    // 1. Apply Live2D official standard parameter template
    bus.execute({
      id: 'cmd_apply_template',
      name: 'parameter.apply_standard_template',
      params: {},
    });

    const projectAfter = bus.getProject();
    expect(projectAfter.parameter_groups?.length).toBe(6);
    expect(projectAfter.parameters.length).toBe(20);
    expect(projectAfter.parameters.some((p) => p.id === 'ParamAngleX')).toBe(true);
    expect(projectAfter.parameters.some((p) => p.id === 'ParamEyeLOpen')).toBe(true);
    expect(projectAfter.parameters.some((p) => p.id === 'ParamHairFront')).toBe(true);

    // 2. Test cycle prevention in node.reparent (parenting node_parent -> node_child)
    const cycleRes = bus.execute({
      id: 'cmd_bad_reparent',
      name: 'node.reparent',
      params: { id: 'node_parent', parent_id: 'node_child' },
    });
    expect(cycleRes.success).toBe(false);
    expect(cycleRes.error).toContain('Hierarchy cycle detected');
  });


  it('should verify keyform.copy_paste with mirror_x and node.set_children_visible', () => {
    const copyProject: Project = {
      format_version: 1,
      canvas: { width: 1000, height: 1000, origin_x: 0.5, origin_y: 0.5, background_color: '#000000' },
      parameters: [{ id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 }],
      nodes: [
        {
          id: 'part_folder',
          name: 'Folder',
          parent_id: null,
          visible: true,
          locked: false,
          kind: { type: 'Part', opacity: 1.0, collapsed: false },
        },
        {
          id: 'child_mesh_1',
          name: 'Child 1',
          parent_id: 'part_folder',
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[500, 500]],
            uvs: [[0, 0]],
            indices: [0],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 1,
            mask_ids: [],
          },
        },
        {
          id: 'child_mesh_2',
          name: 'Child 2',
          parent_id: 'part_folder',
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_1',
            vertices: [[500, 500]],
            uvs: [[0, 0]],
            indices: [0],
            blend_mode: 'normal',
            opacity: 1.0,
            draw_order: 2,
            mask_ids: [],
          },
        },
      ],
      keyforms: [
        {
          target_node_id: 'child_mesh_1',
          dimensions: [{ param_id: 'ParamAngleX', keys: [-30, 30] }],
          keyforms: [
            {
              coordinates: [-30],
              payload: {
                kind: 'ArtMesh',
                vertex_offsets: [[-25, 0]],
              },
            },
          ],
        },
      ],
      textures: [{ id: 'tex_1', path: 'textures/t1.png', width: 100, height: 100 }],
    };

    const bus = new CommandBus(copyProject);
    registerStandardCommands(bus);

    // 1. Copy keyform from -30 and paste to +30 with mirror_x: true
    bus.execute({
      id: 'cmd_copy_paste',
      name: 'keyform.copy_paste',
      params: {
        target_node_id: 'child_mesh_1',
        source_coords: [-30],
        dest_coords: [30],
        mirror_x: true,
      },
    });

    const binding = bus.getProject().keyforms[0];
    const pastedState = binding.keyforms.find((s) => s.coordinates[0] === 30)!;
    expect(pastedState).toBeDefined();
    if (pastedState.payload.kind === 'ArtMesh') {
      // Mirrored offset: -25 mirrored should be +25!
      expect(pastedState.payload.vertex_offsets[0][0]).toBe(25);
    }

    // 2. Test node.set_children_visible on part_folder
    bus.execute({
      id: 'cmd_hide_children',
      name: 'node.set_children_visible',
      params: { parent_id: 'part_folder', visible: false },
    });

    const children = bus.getProject().nodes.filter((n) => n.parent_id === 'part_folder');
    expect(children.every((c) => c.visible === false)).toBe(true);
  });

  it('should synthesize 4-corner keyforms (CMD_AUTO_BLEND_4_CORNER), blend shapes, and match Wasm & JS evaluators', () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    bus.execute({
      id: 'p1',
      name: 'parameter.add',
      params: { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 },
    });
    bus.execute({
      id: 'p2',
      name: 'parameter.add',
      params: { id: 'ParamAngleY', name: 'Angle Y', min: -30, max: 30, default: 0 },
    });
    bus.execute({
      id: 'w1',
      name: 'node.add',
      params: {
        id: 'warp_face',
        name: 'Face Warp',
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
      },
    });

    // Set center (0, 0) and 4 axial neighbors (-30, 0), (30, 0), (0, -30), (0, 30)
    const baseCps: [number, number][] = [[0, 0], [100, 0], [0, 100], [100, 100]];
    const shift = (dx: number, dy: number): [number, number][] =>
      baseCps.map(([x, y]) => [x + dx, y + dy]);

    bus.execute({
      id: 'kf_axial',
      name: 'keyform.set',
      params: {
        target_node_id: 'warp_face',
        dimensions: [
          { param_id: 'ParamAngleX', keys: [-30, 0, 30] },
          { param_id: 'ParamAngleY', keys: [-30, 0, 30] },
        ],
        keyforms: [
          { coordinates: [0, 0], payload: { kind: 'Warp', control_points: baseCps } },
          { coordinates: [-30, 0], payload: { kind: 'Warp', control_points: shift(-20, 0) } },
          { coordinates: [30, 0], payload: { kind: 'Warp', control_points: shift(20, 0) } },
          { coordinates: [0, -30], payload: { kind: 'Warp', control_points: shift(0, -15) } },
          { coordinates: [0, 30], payload: { kind: 'Warp', control_points: shift(0, 15) } },
        ],
      },
    });

    // Run 4-corner synthesis (Ctrl+4)
    const synthRes = bus.execute({
      id: 'synth_4',
      name: 'keyform.synthesize_corners',
      params: { target_node_id: 'warp_face' },
    });
    expect(synthRes.success).toBe(true);

    const kf = bus.getProject().keyforms[0];
    expect(kf.keyforms.length).toBe(9);
    const topRight = kf.keyforms.find((s) => s.coordinates[0] === 30 && s.coordinates[1] === 30)!;
    expect(topRight).toBeDefined();
    if (topRight.payload.kind === 'Warp') {
      expect(topRight.payload.control_points[0]).toEqual([20, 15]);
    }

    // Test History undo tree jumpToHistory
    const hist = bus.getHistory();
    expect(hist.entries.length).toBe(5);
    bus.jumpToHistory(3); // Before synthesize_corners
    expect(bus.getProject().keyforms[0].keyforms.length).toBe(5);
    bus.jumpToHistory(4); // Redo synthesize_corners
    expect(bus.getProject().keyforms[0].keyforms.length).toBe(9);
  });

  it('should support ArtPath creation, contour fitting, Wasm + JS evaluation, and headless PNG rendering', () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    bus.execute({
      id: 'm1',
      name: 'node.add',
      params: {
        id: 'mesh_eye',
        name: 'Eye Mesh',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 'tex_eye',
          vertices: [[200, 200], [300, 200], [300, 300], [200, 300]],
          uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
          indices: [0, 1, 2, 0, 2, 3],
          blend_mode: 'normal',
          opacity: 1,
          draw_order: 10,
          mask_ids: [],
        },
      },
    });

    // Fit contour ArtPath around mesh_eye
    const fitRes = bus.execute({
      id: 'fit1',
      name: 'art_path.fit_mesh_contour',
      params: { mesh_id: 'mesh_eye', stroke_width: 6.0 },
    });
    expect(fitRes.success).toBe(true);

    bus.execute({
      id: 'thicken1',
      name: 'art_path.adjust_width',
      params: { node_id: 'artpath_mesh_eye', delta: 2.0 },
    });

    const proj = bus.getProject();
    const wasm = new WasmModel(JSON.stringify(proj));
    const wasmFrame = wasm.evaluate();
    const jsFrame = evaluateProjectJs(proj, {});

    expect(wasmFrame.meshes.length).toBe(2);
    expect(jsFrame.meshes.length).toBe(2);
    const artPathMesh = wasmFrame.meshes.find((m: any) => m.id === 'artpath_mesh_eye');
    expect(artPathMesh).toBeDefined();
    expect(artPathMesh.texture_id).toBe('__artpath_solid__');

    // Headless render including solid ArtPath stroke
    const png = renderFrameToCanvas(1000, 1000, wasmFrame, () => null);
    expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  it('should support Cubism 5.3 Physics Presets, Bake Physics (CMD_BAKE_PHYSICS), Track Freeze, and real Epsilon_m_01.mtn import', () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    bus.execute({
      id: 'std_params',
      name: 'parameter.apply_standard_template',
      params: {},
    });

    // Apply official Cubism 5.3 3-stage hair pendulum preset
    bus.execute({
      id: 'phys_preset',
      name: 'physics.apply_preset',
      params: {
        preset: 'hair_3stage',
        input_preset: 'head_input',
        output_param_id: 'ParamHairFront',
      },
    });
    expect(bus.getProject().physics?.length).toBe(1);
    expect(bus.getProject().physics?.[0].pendulums.length).toBe(3);

    // Import real Cubism 5.3 Epsilon_m_01.mtn with $fadein/$fadeout and IdConverter
    const epsPath = '/Volumes/AmatsukaM/Applications/Live2D Cubism 5.3/data/template/mtn/epsilon/Epsilon_m_01.mtn';
    if (fs.existsSync(epsPath)) {
      const mtnRaw = fs.readFileSync(epsPath, 'utf-8');
      const anim = importMtnMotion('eps_01', 'Epsilon Motion 01', mtnRaw, true);
      expect(anim.tracks.some((t: any) => t.target_param_id === 'ParamAngleY')).toBe(true);
      expect(anim.tracks.some((t: any) => t.target_param_id.startsWith('$fade'))).toBe(false);
      const eyeTrack = anim.tracks.find((t: any) => t.target_param_id === 'ParamEyeLOpen');
      expect(eyeTrack?.fade_in_ms).toBe(200);
      bus.execute({ id: 'add_eps', name: 'animation.add', params: anim });
    } else {
      bus.execute({ id: 'auto_face', name: 'macro.auto_face_motion', params: { animation_id: 'eps_01', duration_frames: 30 } });
    }

    // Bake physics into animation tracks
    bus.execute({
      id: 'bake_1',
      name: 'animation.bake_physics',
      params: { animation_id: 'eps_01' },
    });

    const updatedAnim = bus.getProject().animations?.find((a) => a.id === 'eps_01')!;
    const bakedHair = updatedAnim.tracks.find((t) => t.target_param_id === 'ParamHairFront');
    expect(bakedHair).toBeDefined();
    expect(bakedHair!.keyframes.length).toBeGreaterThan(10);
  });

  it('should support deformer.delete_and_bake_to_children, project.cleanup_empty, CRI 5-vowel LipSync, and ZIP export', () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    // Add unused parameter & empty part to test project.cleanup_empty
    bus.execute({
      id: 'unused_p',
      name: 'parameter.add',
      params: { id: 'ParamUnused', name: 'Unused', min: 0, max: 1, default: 0 },
    });
    bus.execute({
      id: 'empty_part',
      name: 'node.add',
      params: { id: 'part_empty', name: 'Empty Part', parent_id: null, visible: true, locked: false, kind: { type: 'Part' } },
    });

    // Add a translated Warp deformer and child ArtMesh, then delete & bake deformer into child
    bus.execute({
      id: 'w_bake',
      name: 'node.add',
      params: {
        id: 'warp_bake',
        name: 'Bake Warp',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'WarpDeformer',
          cols: 1,
          rows: 1,
          bounds: [0, 0, 100, 100],
          control_points: [[50, 0], [150, 0], [50, 100], [150, 100]], // shifted +50 on X
        },
      },
    });
    bus.execute({
      id: 'm_child',
      name: 'node.add',
      params: {
        id: 'mesh_baked',
        name: 'Baked Mesh',
        parent_id: 'warp_bake',
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 'tex1',
          vertices: [[50, 50], [60, 50], [50, 60]],
          uvs: [[0, 0], [1, 0], [0, 1]],
          indices: [0, 1, 2],
          blend_mode: 'normal',
          opacity: 1,
          draw_order: 0,
          mask_ids: [],
        },
      },
    });

    bus.execute({
      id: 'do_bake',
      name: 'deformer.delete_and_bake_to_children',
      params: { deformer_id: 'warp_bake' },
    });
    const bakedMesh = bus.getProject().nodes.find((n) => n.id === 'mesh_baked')!;
    expect(bakedMesh.parent_id).toBeNull();
    if (bakedMesh.kind.type === 'ArtMesh') {
      expect(bakedMesh.kind.vertices[0][0]).toBeCloseTo(100, 3);
    }

    bus.execute({
      id: 'clean1',
      name: 'project.cleanup_empty',
      params: {},
    });
    expect(bus.getProject().nodes.some((n) => n.id === 'part_empty')).toBe(false);
    expect(bus.getProject().parameters.some((p) => p.id === 'ParamUnused')).toBe(false);

    // Verify CRI 5-vowel LipSync outputs mouthFormKeyframes, vowelKeyframes, and waveformPeaks
    const wav = createSyntheticWavBuffer(0.5, 44100);
    const lip = analyzeWavForLipSync(wav, 30);
    expect(lip.mouthFormKeyframes.length).toBe(lip.keyframes.length);
    expect(lip.waveformPeaks.length).toBe(lip.keyframes.length);
    expect(lip.vowelKeyframes.A.length).toBe(lip.keyframes.length);
  });

  it('should execute Cubism 5.3 local ONNX models (face_deformer_xy, face_deformer_4corner, classifier) and build 24-node Full-Body Deformer Tree', () => {
    // 1. Direct ONNX inference on face_deformer_xy.onnx ([1, 17] -> [1, 1334])
    const input17 = new Float32Array(17).fill(0.2);
    const outXY = runCubismFaceDeformerXY(input17);
    expect(outXY.length).toBe(1334);
    expect(Math.abs(outXY[0])).toBeGreaterThan(1e-5);

    // 2. Direct ONNX inference on face_deformer_4corner.onnx ([1, 1728] -> [1, 1728])
    const input1728 = new Float32Array(1728).fill(0.05);
    const out4C = runCubismFaceDeformer4Corner(input1728);
    expect(out4C.length).toBe(1728);
    expect(Math.abs(out4C[0])).toBeGreaterThan(1e-5);

    // 3. Direct ONNX inference on classifier_for_auto_deformer.onnx ([1, 3, 224, 224] -> [1, 13])
    const clsRes = runCubismLayerClassifierOnnx();
    expect(clsRes.logits.length).toBe(13);

    // 4. Full-body 24-deformer tree generation (`macro.ai_full_body_deformers`)
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);
    bus.execute({
      id: 'm_eye',
      name: 'node.add',
      params: {
        id: 'eye_left_mesh',
        name: 'Left Eye',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 't1',
          vertices: [[650, 350], [700, 350], [650, 400]],
          uvs: [[0, 0], [1, 0], [0, 1]],
          indices: [0, 1, 2],
          blend_mode: 'normal',
          opacity: 1,
          draw_order: 1,
          mask_ids: [],
        },
      },
    });
    bus.execute({
      id: 'ai_full',
      name: 'macro.ai_full_body_deformers',
      params: {},
    });
    const nodes = bus.getProject().nodes;
    expect(nodes.some((n) => n.id === 'UPPER_BODY_Z')).toBe(true);
    expect(nodes.some((n) => n.id === 'BREATH')).toBe(true);
    expect(nodes.some((n) => n.id === 'FACE_ROT')).toBe(true);
    expect(nodes.some((n) => n.id === 'LEFT_EYE')).toBe(true);
    const eyeMesh = nodes.find((n) => n.id === 'eye_left_mesh')!;
    expect(eyeMesh.parent_id).toBe('LEFT_EYE');
  });

  it('should support Perspective Free Quad Homography, Warp Topology Resampling, Stroke Mesh Topology, and .moc3 Binary Round-Trip', () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    bus.execute({
      id: 'w_topo',
      name: 'node.add',
      params: {
        id: 'warp_topo',
        name: 'Topo Warp',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'WarpDeformer',
          cols: 2,
          rows: 2,
          bounds: [0, 0, 100, 100],
          control_points: [
            [0, 0], [50, 0], [100, 0],
            [0, 50], [50, 50], [100, 50],
            [0, 100], [50, 100], [100, 100],
          ],
        },
      },
    });

    // Double rows (2x2 -> 2x4 = 15 control points)
    bus.execute({
      id: 'double_r',
      name: 'warp.change_topology',
      params: { node_id: 'warp_topo', op: 'twice_rows' },
    });
    const warpAfter = bus.getProject().nodes.find((n) => n.id === 'warp_topo')!;
    if (warpAfter.kind.type === 'WarpDeformer') {
      expect(warpAfter.kind.rows).toBe(4);
      expect(warpAfter.kind.control_points.length).toBe(15);
    }

    // Perspective 4-corner free deform handler (`deform.free_quad`)
    bus.execute({
      id: 'persp_1',
      name: 'deform.free_quad',
      params: {
        node_id: 'warp_topo',
        quad_corners: [[10, 5], [90, 5], [0, 100], [100, 100]],
        mode: 'perspective',
      },
    });
    const warpPersp = bus.getProject().nodes.find((n) => n.id === 'warp_topo')!;
    if (warpPersp.kind.type === 'WarpDeformer') {
      expect(warpPersp.kind.control_points[0][0]).toBeCloseTo(10, 2);
      expect(warpPersp.kind.control_points[0][1]).toBeCloseTo(5, 2);
    }

    // Stroke Mesh Topology (`mesh.stroke_topology`)
    bus.execute({
      id: 'm_stroke',
      name: 'node.add',
      params: {
        id: 'hair_strand',
        name: 'Hair Strand',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 't1',
          vertices: [],
          uvs: [],
          indices: [],
          blend_mode: 'normal',
          opacity: 1,
          draw_order: 5,
          mask_ids: [],
        },
      },
    });
    bus.execute({
      id: 'do_stroke',
      name: 'mesh.stroke_topology',
      params: {
        mesh_id: 'hair_strand',
        stroke_points: [[100, 100], [100, 200], [110, 300], [130, 400]],
        width: 20,
      },
    });
    const strand = bus.getProject().nodes.find((n) => n.id === 'hair_strand')!;
    if (strand.kind.type === 'ArtMesh') {
      expect(strand.kind.vertices.length).toBe(12); // 4 cross-sections * 3 vertices
      expect(strand.kind.indices.length).toBe(36);  // 3 segments * 4 triangles * 3 indices
    }

    // MOC3 Binary Serialization & Round-Trip Parsing
    const moc3Buf = serializeMoc3Container(bus.getProject());
    expect(moc3Buf.toString('ascii', 0, 4)).toBe('MOC3');
    const parsedMoc = parseMoc3ToProject(moc3Buf);
    expect(parsedMoc.mocVersion).toBe(5);
    expect(parsedMoc.project.nodes.length).toBe(bus.getProject().nodes.length);
  });

  it('should support AI ONNX Face Rigging (applyCubismAiFaceRig), PSD Export/Import Round-Trip, Modeling Templates, and Deformer Protrusion Validation', async () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    // 1. Build 24-node Full-Body Deformer Tree and run AI ONNX Face Rigging
    bus.execute({
      id: 'ai_tree',
      name: 'macro.ai_full_body_deformers',
      params: {},
    });
    const faceRigged = applyCubismAiFaceRig(bus.getProject());
    const faceKf = faceRigged.keyforms.find((k) => k.target_node_id === 'FACE');
    expect(faceKf).toBeDefined();
    expect(faceKf!.keyforms.length).toBe(9);

    // 2. Export Modeling Template (`CMD_EXPORT_AS_TEMPLATE`) and apply onto a blank project (`CMD_MODELING_TEMPLATE`)
    const tpl = exportModelingTemplate(faceRigged);
    expect(tpl.deformers.length).toBeGreaterThanOrEqual(24);
    expect(tpl.keyforms.length).toBeGreaterThanOrEqual(1);

    const targetBus = new CommandBus({
      ...initialProject,
      canvas: { ...initialProject.canvas, width: 2000, height: 2000 },
    });
    registerStandardCommands(targetBus);
    targetBus.execute({
      id: 'apply_tpl',
      name: 'template.apply',
      params: { template: tpl },
    });
    expect(targetBus.getProject().nodes.some((n) => n.id === 'FACE')).toBe(true);
    expect(targetBus.getProject().keyforms.some((k) => k.target_node_id === 'FACE')).toBe(true);

    // 3. Test CHILD_OUTSIDE_WARP_BOUNDS (`CMD_VALIDATE_DEFORMER_DIALOG`)
    targetBus.execute({
      id: 'protruding_mesh',
      name: 'node.add',
      params: {
        id: 'mesh_outside',
        name: 'Protruding Mesh',
        parent_id: 'FACE',
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 't1',
          vertices: [[10, 10], [20, 10], [10, 20]], // Outside FACE bounds
          uvs: [[0, 0], [1, 0], [0, 1]],
          indices: [0, 1, 2],
          blend_mode: 'normal',
          opacity: 1,
          draw_order: 10,
          mask_ids: [],
        },
      },
    });
    const wasmDiags = lintProjectJson(JSON.stringify(targetBus.getProject())) as any[];
    const jsDiags = lintProjectJs(targetBus.getProject());
    expect(wasmDiags.some((d) => d.code === 'CHILD_OUTSIDE_WARP_BOUNDS')).toBe(true);
    expect(jsDiags.some((d) => d.code === 'CHILD_OUTSIDE_WARP_BOUNDS')).toBe(true);

    // 4. Test Layered PSD Export (`CMD_EXPORT_MODEL_AS_PSD`) & Re-Import Round-Trip
    const texCanvas = createCanvas(64, 64);
    const texCtx = texCanvas.getContext('2d');
    texCtx.fillStyle = '#38bdf8';
    texCtx.fillRect(0, 0, 64, 64);
    const texPng = texCanvas.toBuffer('image/png');

    const psdProj: Project = {
      ...initialProject,
      nodes: [
        {
          id: 'layer_face',
          name: 'Face_Layer',
          parent_id: null,
          visible: true,
          locked: false,
          kind: {
            type: 'ArtMesh',
            texture_id: 'tex_face',
            vertices: [[100, 100], [164, 100], [164, 164], [100, 164]],
            uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
            indices: [0, 1, 2, 0, 2, 3],
            blend_mode: 'normal',
            opacity: 1,
            draw_order: 1,
            mask_ids: [],
          },
        },
      ],
      textures: [{ id: 'tex_face', path: 'textures/face.png', width: 64, height: 64 }],
    };
    const exportedPsd = exportModelToPsdBuffer(psdProj, () => texPng);
    expect(exportedPsd.toString('ascii', 0, 4)).toBe('8BPS'); // Official Adobe PSD magic signature
    const reimported = await importPsdBuffer(exportedPsd);
    expect(reimported.project.nodes.some((n) => n.id === 'Face_Layer')).toBe(true);
  });

  it('should support DeformPath Auto-Skinning (CUB3-1677), Atlas Unpacking, and Mask Target Hidden Warning (CUB3-1999)', () => {
    const bus = new CommandBus(initialProject);
    registerStandardCommands(bus);

    // 1. Create a DeformPath and run deform_path.auto_skinning
    bus.execute({
      id: 'p_ribbon',
      name: 'deform_path.create',
      params: {
        id: 'path_ribbon',
        name: 'Ribbon Path',
        control_points: [[100, 100], [150, 180], [200, 260], [250, 340]],
        target_mesh_ids: ['mesh_ribbon'],
      },
    });
    bus.execute({
      id: 'skin_1',
      name: 'deform_path.auto_skinning',
      params: { path_id: 'path_ribbon' },
    });
    const nodes = bus.getProject().nodes;
    expect(nodes.some((n) => n.id === 'rot_skin_path_ribbon_1')).toBe(true);
    expect(nodes.some((n) => n.id === 'rot_skin_path_ribbon_2')).toBe(true);
    expect(bus.getProject().parameters.some((p) => p.id === 'ParamSkinning_path_ribbon_1')).toBe(true);

    // 2. Test MASK_TARGET_HIDDEN warning
    bus.execute({
      id: 'm_masked',
      name: 'node.add',
      params: {
        id: 'mesh_pupil',
        name: 'Pupil',
        parent_id: null,
        visible: true,
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 't1',
          vertices: [[50, 50], [60, 50], [50, 60]],
          uvs: [[0, 0], [1, 0], [0, 1]],
          indices: [0, 1, 2],
          blend_mode: 'normal',
          opacity: 1,
          draw_order: 1,
          mask_ids: ['mesh_hidden_sclera'],
        },
      },
    });
    bus.execute({
      id: 'm_hidden_mask',
      name: 'node.add',
      params: {
        id: 'mesh_hidden_sclera',
        name: 'Hidden Sclera Mask',
        parent_id: null,
        visible: false, // Hidden!
        locked: false,
        kind: {
          type: 'ArtMesh',
          texture_id: 't1',
          vertices: [[40, 40], [70, 40], [40, 70]],
          uvs: [[0, 0], [1, 0], [0, 1]],
          indices: [0, 1, 2],
          blend_mode: 'normal',
          opacity: 1,
          draw_order: 0,
          mask_ids: [],
        },
      },
    });
    const diags = lintProjectJson(JSON.stringify(bus.getProject())) as any[];
    expect(diags.some((d) => d.code === 'MASK_TARGET_HIDDEN')).toBe(true);

    // 3. Test unpackAtlasTextures
    const dummyAtlasCanvas = createCanvas(512, 512);
    const dummyAtlasBuf = dummyAtlasCanvas.toBuffer('image/png');
    const unpacked = unpackAtlasTextures(bus.getProject(), dummyAtlasBuf);
    expect(unpacked.length).toBeGreaterThanOrEqual(1);
    expect(unpacked[0].buffer.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

});
