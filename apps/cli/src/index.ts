#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { CommandBus, registerStandardCommands } from '@l2d/command';
import { importPsdBuffer, exportModelToPsdBuffer } from '@l2d/psd';
import {
  renderFrameToCanvas,
  generateTextureAtlas,
  exportRuntimePackage,
  analyzeWavForLipSync,
  renderAnimationSequence,
  applyCubismAiFaceRig,
  importRuntimePackage,
  serializeMoc3Container,
  parseMoc3ToProject,
} from '@l2d/renderer';
import { exportModelingTemplate, type Project } from '@l2d/schema';
import { WasmModel, lintProjectJson, getProjectStats, importMtnMotion, bakePhysicsToAnimation } from '@l2d/schema/wasm-node';

const program = new Command();

program
  .name('l2d')
  .description('L2DEditor headless CLI and automation toolkit for 2D puppet rigging')
  .version('0.1.0');

function resolveProjectPath(inputPath: string): string {
  if (fs.existsSync(inputPath)) {
    const stat = fs.statSync(inputPath);
    if (stat.isDirectory()) {
      const candidate = path.join(inputPath, 'project.json');
      if (fs.existsSync(candidate)) return candidate;
    }
    return inputPath;
  }
  if (fs.existsSync(`${inputPath}/project.json`)) {
    return `${inputPath}/project.json`;
  }
  return inputPath;
}

program
  .command('create <dir>')
  .description('Create a new blank .l2dproj project')
  .option('-w, --width <width>', 'Canvas width', '1920')
  .option('-h, --height <height>', 'Canvas height', '1080')
  .action((dir, opts) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'textures'), { recursive: true });
    const project: Project = {
      format_version: 1,
      canvas: {
        width: Number(opts.width),
        height: Number(opts.height),
        origin_x: 0.5,
        origin_y: 0.5,
        background_color: '#18181b',
      },
      parameters: [
        { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 },
        { id: 'ParamAngleY', name: 'Angle Y', min: -30, max: 30, default: 0 },
      ],
      nodes: [],
      keyforms: [],
      textures: [],
    };
    const jsonFile = path.join(dir, 'project.json');
    fs.writeFileSync(jsonFile, JSON.stringify(project, null, 2), 'utf-8');
    console.log(`Created new L2DEditor project at: ${dir}`);
  });

program
  .command('inspect <project>')
  .description('Inspect summary, canvas, nodes, parameters, and keyforms of a project')
  .action((projectInput) => {
    const file = resolveProjectPath(projectInput);
    const project: Project = JSON.parse(fs.readFileSync(file, 'utf-8'));
    console.log(
      JSON.stringify(
        {
          format_version: project.format_version,
          canvas: project.canvas,
          parameters: project.parameters,
          node_count: project.nodes.length,
          nodes: project.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            parent_id: n.parent_id,
            type: n.kind.type,
          })),
          keyform_count: project.keyforms.length,
          textures: project.textures,
        },
        null,
        2
      )
    );
  });

program
  .command('lint <project>')
  .description('Run topology and data linting on a project')
  .action((projectInput) => {
    const file = resolveProjectPath(projectInput);
    const raw = fs.readFileSync(file, 'utf-8');
    const diags = lintProjectJson(raw) as any[];
    if (diags.length === 0) {
      console.log('✅ Project lint passed with 0 errors or warnings.');
      return;
    }
    console.log(`Found ${diags.length} diagnostic(s):`);
    for (const d of diags) {
      const icon = d.severity === 'error' ? '❌' : d.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${icon} [${d.code}] ${d.message} (path: ${d.json_path})`);
    }
    const hasErrors = diags.some((d) => d.severity === 'error');
    if (hasErrors) {
      process.exitCode = 1;
    }
  });

program
  .command('render <project>')
  .description('Render an offline PNG snapshot with specified parameters')
  .option('-p, --params <params>', 'Comma-separated parameter values, e.g. ParamAngleX=20,ParamAngleY=-10', '')
  .option('-o, --out <out>', 'Output PNG file path', 'snapshot.png')
  .action((projectInput, opts) => {
    const file = resolveProjectPath(projectInput);
    const projectDir = path.dirname(file);
    const raw = fs.readFileSync(file, 'utf-8');
    const project: Project = JSON.parse(raw);

    const paramMap: Record<string, number> = {};
    if (opts.params) {
      const pairs = opts.params.split(',');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k && v !== undefined) {
          paramMap[k.trim()] = Number(v.trim());
        }
      }
    }

    const model = new WasmModel(raw);
    for (const [k, v] of Object.entries(paramMap)) {
      model.setParameter(k, v);
    }

    const frame = model.evaluate() as any;

    const textureResolver = (textureId: string): Buffer | null => {
      const meta = project.textures.find((t) => t.id === textureId);
      if (!meta) return null;
      const fullPath = path.isAbsolute(meta.path)
        ? meta.path
        : path.join(projectDir, meta.path);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
      return null;
    };

    const pngBuf = renderFrameToCanvas(
      project.canvas.width,
      project.canvas.height,
      frame,
      textureResolver,
      project.canvas.background_color
    );

    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, pngBuf);
    console.log(`Rendered ${project.canvas.width}x${project.canvas.height} snapshot to ${opts.out} (${pngBuf.length} bytes)`);
  });

program
  .command('exec <project> <command_arg>')
  .description('Execute a JSON command against a project file')
  .option('--dry-run', 'Simulate execution and print patches without writing to disk')
  .action((projectInput, commandArg, opts) => {
    const file = resolveProjectPath(projectInput);
    const raw = fs.readFileSync(file, 'utf-8');
    const project: Project = JSON.parse(raw);

    let cmd: any;
    if (fs.existsSync(commandArg)) {
      cmd = JSON.parse(fs.readFileSync(commandArg, 'utf-8'));
    } else {
      cmd = JSON.parse(commandArg);
    }

    const bus = new CommandBus(project);
    registerStandardCommands(bus);

    if (opts.dryRun) {
      const dryRes = bus.dryRun(cmd);
      console.log('Dry run result:', JSON.stringify(dryRes, null, 2));
      return;
    }

    const res = bus.execute(cmd);
    if (!res.success) {
      console.error('Execution failed:', res.error);
      process.exit(1);
    }

    fs.writeFileSync(file, JSON.stringify(bus.getProject(), null, 2), 'utf-8');
    console.log(`Successfully executed command '${cmd.name}', patches applied: ${res.patches.length}`);
  });

program
  .command('import-psd <psd_file>')
  .description('Import a Photoshop PSD file and generate a project directory')
  .requiredOption('-o, --out <out_dir>', 'Target .l2dproj directory')
  .option('-d, --density <density>', 'Mesh subdivision density', '2')
  .action(async (psdFile, opts) => {
    const buf = fs.readFileSync(psdFile);
    const density = Number(opts.density);
    const { project, extractedTextures } = await importPsdBuffer(buf, { meshDensity: density });

    const outDir = opts.out;
    fs.mkdirSync(outDir, { recursive: true });
    const texDir = path.join(outDir, 'textures');
    fs.mkdirSync(texDir, { recursive: true });

    for (const t of extractedTextures) {
      fs.writeFileSync(path.join(texDir, t.filename), t.buffer);
    }

    fs.writeFileSync(path.join(outDir, 'project.json'), JSON.stringify(project, null, 2), 'utf-8');
    console.log(`Imported PSD to '${outDir}': ${project.nodes.length} nodes, ${extractedTextures.length} textures.`);
  });

program
  .command('atlas <project>')
  .description('Generate and pack all ArtMesh textures into an optimized texture atlas')
  .option('-s, --size <size>', 'Atlas width and height in pixels', '2048')
  .option('-p, --padding <padding>', 'Pixel padding between packed textures', '4')
  .action((projectInput, opts) => {
    const file = resolveProjectPath(projectInput);
    const projectDir = path.dirname(file);
    const raw = fs.readFileSync(file, 'utf-8');
    const project: Project = JSON.parse(raw);

    const textureResolver = (textureId: string): Buffer | null => {
      const meta = project.textures.find((t) => t.id === textureId);
      if (!meta) return null;
      const fullPath = path.isAbsolute(meta.path)
        ? meta.path
        : path.join(projectDir, meta.path);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
      return null;
    };

    const size = Number(opts.size);
    const padding = Number(opts.padding);
    const result = generateTextureAtlas(project, textureResolver, size, padding);

    const texDir = path.join(projectDir, 'textures');
    fs.mkdirSync(texDir, { recursive: true });

    for (const atlas of result.atlasPngBuffers) {
      fs.writeFileSync(path.join(texDir, atlas.filename), atlas.buffer);
    }

    fs.writeFileSync(file, JSON.stringify(result.updatedProject, null, 2), 'utf-8');
    console.log(`Successfully generated texture atlas (${size}x${size}) and remapped mesh UVs.`);
  });

program
  .command('export <project>')
  .description('Export project to standard runtime distribution package (.model3.json, .physics3.json, .cdi3.json, atlas)')
  .requiredOption('-o, --out <out_dir>', 'Target distribution directory')
  .option('-n, --name <name>', 'Model name', 'model')
  .option('-s, --size <size>', 'Atlas size in pixels', '2048')
  .option('-z, --zip <zip_file>', 'Optionally package output directory into a distribution ZIP archive')
  .action((projectInput, opts) => {
    const file = resolveProjectPath(projectInput);
    const projectDir = path.dirname(file);
    const raw = fs.readFileSync(file, 'utf-8');
    const project: Project = JSON.parse(raw);

    const textureResolver = (textureId: string): Buffer | null => {
      const meta = project.textures.find((t) => t.id === textureId);
      if (!meta) return null;
      const fullPath = path.isAbsolute(meta.path)
        ? meta.path
        : path.join(projectDir, meta.path);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
      return null;
    };

    const res = exportRuntimePackage(project, textureResolver, opts.out, {
      modelName: opts.name,
      atlasSize: Number(opts.size),
      zipOutputPath: opts.zip,
    });

    console.log(`Successfully exported runtime package to '${opts.out}':`);
    console.log(`  - MOC3 Binary: ${res.moc3Path}`);
    console.log(`  - Manifest: ${res.model3JsonPath}`);
    console.log(`  - Textures: ${res.numTextures} atlas sheet(s)`);
    console.log(`  - Motions: ${res.numMotions} motion file(s)`);
    if (res.zipPath) console.log(`  - Archive: ${res.zipPath}`);
  });

program
  .command('export-moc3 <project>')
  .description('Export project directly to a spec-compliant Live2D .moc3 binary (v1..v5) in pure Rust')
  .requiredOption('-o, --out <out_moc3>', 'Target .moc3 binary path')
  .option('-v, --moc-version <ver>', 'Target MOC3 version (1=V3.00, 2=V3.03, 3=V4.00, 4=V4.02, 5=V5.00)', '5')
  .action((projectInput, opts) => {
    const file = resolveProjectPath(projectInput);
    const project: Project = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const ver = Number(opts.mocVersion) || 5;
    const moc3Buf = serializeMoc3Container(project, ver);
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(opts.out, moc3Buf);
    console.log(`Successfully exported .moc3 (v${ver}, ${moc3Buf.length} bytes) to ${opts.out}`);
  });

program
  .command('import-moc3 <moc3_file>')
  .description('Import a Live2D .moc3 binary into an L2DEditor project.json in pure Rust')
  .requiredOption('-o, --out <out_project>', 'Target .l2dproj directory or project.json path')
  .action((moc3File, opts) => {
    const buf = fs.readFileSync(moc3File);
    const { mocVersion, project } = parseMoc3ToProject(buf);
    const targetFile = opts.out.endsWith('.json') ? opts.out : path.join(opts.out, 'project.json');
    fs.mkdirSync(path.dirname(path.resolve(targetFile)), { recursive: true });
    fs.writeFileSync(targetFile, JSON.stringify(project, null, 2), 'utf-8');
    console.log(`Imported .moc3 (v${mocVersion}, ${project.nodes.length} nodes, ${project.parameters.length} parameters) to ${targetFile}`);
  });

program
  .command('import-bundle <model3_json>')
  .description('Import an entire Live2D runtime bundle (.model3.json, .moc3, .physics3, .cdi3, expressions, pose) into an L2DEditor project')
  .requiredOption('-o, --out <out_dir>', 'Target .l2dproj directory')
  .action((model3JsonFile, opts) => {
    const { project, modelName, mocVersion } = importRuntimePackage(model3JsonFile);
    fs.mkdirSync(opts.out, { recursive: true });
    const jsonFile = path.join(opts.out, 'project.json');
    fs.writeFileSync(jsonFile, JSON.stringify(project, null, 2), 'utf-8');
    console.log(`Successfully imported runtime bundle '${modelName}' (.moc3 v${mocVersion}, ${project.nodes.length} nodes, ${project.parameters.length} params) into ${opts.out}`);
  });

program
  .command('lipsync <project> <audio_wav>')
  .description('Analyze audio WAV file and generate lip-sync keyframes for mouth parameter')
  .option('-p, --param <param_id>', 'Target mouth parameter ID', 'ParamMouthOpen')
  .option('-a, --anim <animation_id>', 'Target animation ID', 'anim_default')
  .action((projectInput, audioWavFile, opts) => {
    const file = resolveProjectPath(projectInput);
    const raw = fs.readFileSync(file, 'utf-8');
    const project: Project = JSON.parse(raw);
    const wavBuf = fs.readFileSync(audioWavFile);

    const result = analyzeWavForLipSync(wavBuf, 30);

    if (!project.animations) project.animations = [];
    let anim = project.animations.find((a) => a.id === opts.anim);
    if (!anim) {
      anim = {
        id: opts.anim,
        name: 'LipSync Motion',
        duration_frames: result.durationFrames,
        fps: result.fps,
        loop_playback: false,
        tracks: [],
      };
      project.animations.push(anim);
    }

    anim.duration_frames = Math.max(anim.duration_frames, result.durationFrames);
    let track = anim.tracks.find((t) => t.target_param_id === opts.param);
    if (!track) {
      track = { target_param_id: opts.param, keyframes: [] };
      anim.tracks.push(track);
    }

    track.keyframes = result.keyframes;
    if (project.parameters.some((p) => p.id === 'ParamMouthForm')) {
      let formTrack = anim.tracks.find((t) => t.target_param_id === 'ParamMouthForm');
      if (!formTrack) {
        formTrack = { target_param_id: 'ParamMouthForm', keyframes: [] };
        anim.tracks.push(formTrack);
      }
      formTrack.keyframes = result.mouthFormKeyframes;
    }
    fs.writeFileSync(file, JSON.stringify(project, null, 2), 'utf-8');
    console.log(`Generated ${result.keyframes.length} lip-sync keyframes for ${opts.param} over ${result.durationFrames} frames.`);
  });

program
  .command('import-mtn <project> <mtn_file>')
  .description('Import an official Live2D .mtn motion template into the project (supports IdConverter and $fadein/$fadeout)')
  .option('-i, --id <anim_id>', 'Target animation ID', 'mtn_imported')
  .option('-n, --name <anim_name>', 'Target animation name', 'Imported MTN Motion')
  .option('--no-normalize', 'Keep legacy PARAM_ANGLE_X IDs instead of converting to ParamAngleX')
  .action((projectInput, mtnFile, opts) => {
    const file = resolveProjectPath(projectInput);
    const project: Project = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const mtnContent = fs.readFileSync(mtnFile, 'utf-8');
    const anim = importMtnMotion(opts.id, opts.name, mtnContent, opts.normalize !== false);
    if (!project.animations) project.animations = [];
    const idx = project.animations.findIndex((a) => a.id === anim.id);
    if (idx >= 0) project.animations[idx] = anim;
    else project.animations.push(anim);
    fs.writeFileSync(file, JSON.stringify(project, null, 2), 'utf-8');
    console.log(`Imported .mtn motion '${anim.name}' (${anim.tracks.length} tracks, ${anim.duration_frames} frames @ ${anim.fps}fps)`);
  });

program
  .command('bake-physics <project> <animation_id>')
  .description('Simulate PhysicsGroup pendulums across an animation and bake resulting curves into tracks (CMD_BAKE_PHYSICS)')
  .action((projectInput, animationId) => {
    const file = resolveProjectPath(projectInput);
    const raw = fs.readFileSync(file, 'utf-8');
    const updatedJson = bakePhysicsToAnimation(raw, animationId);
    fs.writeFileSync(file, updatedJson, 'utf-8');
    console.log(`Successfully baked pendulum physics into animation '${animationId}'.`);
  });

program
  .command('render-video <project> <animation_id>')
  .description('Render full animation frames and encode into MP4 or WebM video (using bundled/system ffmpeg)')
  .requiredOption('-o, --out <out_file>', 'Output video path (.mp4 or .webm)')
  .option('-r, --fps <fps>', 'Target playback framerate', '30')
  .action((projectInput, animationId, opts) => {
    const file = resolveProjectPath(projectInput);
    const projectDir = path.dirname(file);
    const raw = fs.readFileSync(file, 'utf-8');
    const project: Project = JSON.parse(raw);

    const textureResolver = (textureId: string): Buffer | null => {
      const meta = project.textures.find((t) => t.id === textureId);
      if (!meta) return null;
      const fullPath = path.isAbsolute(meta.path)
        ? meta.path
        : path.join(projectDir, meta.path);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
      return null;
    };

    const tempFramesDir = path.join('/tmp', `l2d_anim_${Date.now()}`);
    const format = opts.out.endsWith('.gif') ? 'gif' : opts.out.endsWith('.webm') ? 'webm' : 'mp4';
    const res = renderAnimationSequence(project, animationId, textureResolver, tempFramesDir, {
      fps: Number(opts.fps),
      format,
      videoOutputPath: opts.out,
    });

    console.log(`Successfully rendered ${res.totalFrames} frames to video: ${res.videoPath || opts.out}`);
  });

program
  .command('export-psd <project>')
  .description('Export evaluated model layers back into a multi-layer .psd file (CMD_EXPORT_MODEL_AS_PSD)')
  .requiredOption('-o, --out <out_psd>', 'Target .psd output path')
  .action((projectInput, opts) => {
    const file = resolveProjectPath(projectInput);
    const projectDir = path.dirname(file);
    const project: Project = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const textureResolver = (textureId: string): Buffer | null => {
      const meta = project.textures.find((t) => t.id === textureId);
      if (!meta) return null;
      const fullPath = path.isAbsolute(meta.path) ? meta.path : path.join(projectDir, meta.path);
      return fs.existsSync(fullPath) ? fs.readFileSync(fullPath) : null;
    };
    const psdBuf = exportModelToPsdBuffer(project, textureResolver);
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(opts.out, psdBuf);
    console.log(`Successfully exported layered PSD to ${opts.out} (${psdBuf.length} bytes)`);
  });

program
  .command('ai-face-rig <project>')
  .description('Run Cubism 5.3 AI ONNX Face Deformer motion generator (face_deformer_xy.onnx + face_deformer_4corner.onnx)')
  .action((projectInput) => {
    const file = resolveProjectPath(projectInput);
    const project: Project = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const updated = applyCubismAiFaceRig(project);
    fs.writeFileSync(file, JSON.stringify(updated, null, 2), 'utf-8');
    console.log(`Successfully generated ONNX AI 3x3 Face Deformer keyforms on ${file}`);
  });

program
  .command('export-template <project>')
  .description('Export model rigging structure (parameters, deformers, keyforms, physics) as a reusable template (CMD_EXPORT_AS_TEMPLATE)')
  .requiredOption('-o, --out <out_json>', 'Output template JSON path')
  .action((projectInput, opts) => {
    const file = resolveProjectPath(projectInput);
    const project: Project = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const tpl = exportModelingTemplate(project);
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(opts.out, JSON.stringify(tpl, null, 2), 'utf-8');
    console.log(`Exported modeling template (${tpl.deformers.length} deformers, ${tpl.keyforms.length} keyforms) to ${opts.out}`);
  });

program
  .command('update-psd <project> <new_psd_file>')
  .description('Non-destructively reload updated PSD artwork, updating textures while preserving deformers and keyforms')
  .action(async (projectInput, newPsdFile) => {
    const file = resolveProjectPath(projectInput);
    const projectDir = path.dirname(file);
    const raw = fs.readFileSync(file, 'utf-8');
    const existingProject: Project = JSON.parse(raw);

    const buf = fs.readFileSync(newPsdFile);
    const { project: updatedProject, extractedTextures } = await importPsdBuffer(buf, {
      existingProject,
    });

    const texDir = path.join(projectDir, 'textures');
    fs.mkdirSync(texDir, { recursive: true });
    for (const t of extractedTextures) {
      fs.writeFileSync(path.join(texDir, t.filename), t.buffer);
    }

    fs.writeFileSync(file, JSON.stringify(updatedProject, null, 2), 'utf-8');
    console.log(`Successfully reloaded PSD artwork into '${projectDir}': preserved existing deformers and keyforms.`);
  });

program
  .command('auto-rig <project>')
  .description('Automatically categorize layers and build standard Live2D hierarchical deformer tree and keyforms')
  .action((projectInput) => {
    const file = resolveProjectPath(projectInput);
    const raw = fs.readFileSync(file, 'utf-8');
    const project: Project = JSON.parse(raw);

    const bus = new CommandBus(project);
    registerStandardCommands(bus);

    const res = bus.execute({
      id: `cmd_autorig_${Date.now()}`,
      name: 'macro.auto_rig',
      params: {},
    });

    if (!res.success) {
      console.error('Auto-rig failed:', res.error);
      process.exit(1);
    }

    fs.writeFileSync(file, JSON.stringify(bus.getProject(), null, 2), 'utf-8');
    console.log(`Successfully auto-rigged project: created hierarchical deformers and turn XY spaces.`);
  });

program
  .command('diff <project_a> <project_b>')
  .description('Compare two L2DEditor models and report topological and parameter differences')
  .action((projAInput, projBInput) => {
    const fileA = resolveProjectPath(projAInput);
    const fileB = resolveProjectPath(projBInput);
    const a: Project = JSON.parse(fs.readFileSync(fileA, 'utf-8'));
    const b: Project = JSON.parse(fs.readFileSync(fileB, 'utf-8'));

    const paramsA = new Set(a.parameters.map((p) => p.id));
    const paramsB = new Set(b.parameters.map((p) => p.id));
    const addedParams = [...paramsB].filter((id) => !paramsA.has(id));
    const removedParams = [...paramsA].filter((id) => !paramsB.has(id));

    const nodesA = new Set(a.nodes.map((n) => n.id));
    const nodesB = new Set(b.nodes.map((n) => n.id));
    const addedNodes = [...nodesB].filter((id) => !nodesA.has(id));
    const removedNodes = [...nodesA].filter((id) => !nodesB.has(id));

    console.log(`=== L2DEditor Model Diff ===`);
    console.log(`Canvas A: ${a.canvas.width}x${a.canvas.height} | Canvas B: ${b.canvas.width}x${b.canvas.height}`);
    console.log(`Parameters: ${a.parameters.length} -> ${b.parameters.length} (+${addedParams.length}, -${removedParams.length})`);
    if (addedParams.length > 0) console.log(`  + Added parameters:`, addedParams.join(', '));
    if (removedParams.length > 0) console.log(`  - Removed parameters:`, removedParams.join(', '));

    console.log(`Nodes: ${a.nodes.length} -> ${b.nodes.length} (+${addedNodes.length}, -${removedNodes.length})`);
    if (addedNodes.length > 0) console.log(`  + Added nodes:`, addedNodes.join(', '));
    if (removedNodes.length > 0) console.log(`  - Removed nodes:`, removedNodes.join(', '));
    console.log(`Keyforms: ${a.keyforms.length} -> ${b.keyforms.length}`);
  });

program
  .command('snapshot-save <project>')
  .description('Save an incremental backup snapshot of the project to .l2d/history/')
  .action((projectInput) => {
    const file = resolveProjectPath(projectInput);
    const projectDir = path.dirname(file);
    const historyDir = path.join(projectDir, '.l2d', 'history');
    fs.mkdirSync(historyDir, { recursive: true });

    const snapId = `snap_${Date.now()}`;
    const snapFile = path.join(historyDir, `${snapId}.json`);
    fs.copyFileSync(file, snapFile);
    console.log(`Saved snapshot '${snapId}' to ${snapFile}`);
  });

program
  .command('stats <project>')
  .description('Inspect detailed geometry, polygon count, and estimated VRAM budget of a project')
  .action((projectInput) => {
    const file = resolveProjectPath(projectInput);
    const raw = fs.readFileSync(file, 'utf-8');
    const stats = getProjectStats(raw);
    console.log(JSON.stringify(stats, null, 2));
  });

program.parse();
