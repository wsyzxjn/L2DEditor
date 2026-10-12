#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { CommandBus, registerStandardCommands } from '@l2d/command';
import { importPsdBuffer } from '@l2d/psd';
import { renderFrameToCanvas } from '@l2d/renderer';
import type { Project } from '@l2d/schema';
import { WasmModel, lintProjectJson } from '@l2d/schema/wasm-node';

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

program.parse();
