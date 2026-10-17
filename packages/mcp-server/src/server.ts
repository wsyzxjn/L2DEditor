import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { CommandBus, registerStandardCommands } from '@l2d/command';
import { importPsdBuffer, exportModelToPsdBuffer } from '@l2d/psd';
import {
  renderFrameToCanvas,
  generateTextureAtlas,
  exportRuntimePackage,
  importRuntimePackage,
  renderAnimationSequence,
  applyCubismAiFaceRig,
  serializeMoc3Container,
  parseMoc3ToProject,
} from '@l2d/renderer';
import { runAcceptance, checkAcceptanceRevision, type AcceptancePlan } from '@l2d/renderer/acceptance';
import type { Project } from '@l2d/schema';
// Wasm node bindings
import { WasmModel, lintProjectJson, getProjectStats, importMtnMotion, bakePhysicsToAnimation } from '@l2d/schema/wasm-node';
import { registerEditorTools } from './editor-tools.js';

export function createMcpServer(options: { editorUrl?: string } = {}): Server {
  const server = new McpServer(
    {
      name: 'l2deditor-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const offlineTools: Tool[] = [
        {
          name: 'l2d_acceptance',
          description: 'Run bounded parameter, expression and motion sweeps with CPU PNG evidence, lint and optional pixel-region comparisons. Visual review and external runtime checks remain separate.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string' },
              outputDirectory: { type: 'string', description: 'New output directory, must not already exist' },
              plan: { type: 'object', description: 'Optional cases and comparisons, same format as CLI acceptance --plan' },
            },
            required: ['projectPath', 'outputDirectory'],
          },
        },
        {
          name: 'l2d_check_acceptance',
          description: 'Check whether an acceptance report still matches current project, textures, evaluator build and PNG artifacts.',
          inputSchema: {
            type: 'object',
            properties: { projectPath: { type: 'string' }, reportPath: { type: 'string' } },
            required: ['projectPath', 'reportPath'],
          },
        },
        {
          name: 'l2d_inspect',
          description: 'Inspect a .l2dproj project directory: returns canvas dimensions, parameter lists, node hierarchy tree, and keyform counts.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'l2d_lint',
          description: 'Lint and validate a .l2dproj project for topology cycles, degenerate triangles, dangling parents, and out-of-bounds nodes.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'l2d_exec_command',
          description: 'Execute an atomic command or batch of commands against a .l2dproj project (e.g. parameter.add, node.add, macro.setup_turn_xy).',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
              command: {
                type: 'object',
                description: 'Command object with name and params, e.g. { id: "c1", name: "parameter.add", params: { ... } }',
              },
              dryRun: {
                type: 'boolean',
                description: 'If true, simulates execution and returns patches without writing to disk',
              },
            },
            required: ['projectPath', 'command'],
          },
        },
        {
          name: 'l2d_snapshot',
          description: 'Deterministically render an offline PNG snapshot of the model under given parameter values. Perfect for visual multimodal inspection.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
              parameters: {
                type: 'object',
                additionalProperties: { type: 'number' },
                description: 'Dictionary of parameter values to apply, e.g. { "ParamAngleX": -15 }',
              },
              outputPath: {
                type: 'string',
                description: 'Output path to write PNG file',
              },
            },
            required: ['projectPath', 'outputPath'],
          },
        },
        {
          name: 'l2d_import_psd',
          description: 'Import a layered Photoshop (.psd) file, extract layer textures, and auto-generate an initial .l2dproj project.',
          inputSchema: {
            type: 'object',
            properties: {
              psdPath: {
                type: 'string',
                description: 'Path to input .psd file',
              },
              outputProjectPath: {
                type: 'string',
                description: 'Path to target .l2dproj directory',
              },
              meshDensity: {
                type: 'number',
                description: 'Subdivision density for automatic mesh generation (default: 2)',
              },
            },
            required: ['psdPath', 'outputProjectPath'],
          },
        },
        {
          name: 'l2d_atlas',
          description: 'Pack loose ArtMesh textures into an optimized GPU texture atlas and remap UV coordinates.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
              size: {
                type: 'number',
                description: 'Atlas width & height in pixels (default: 2048)',
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'l2d_export',
          description: 'Export project into standard runtime distribution package (.model3.json, .physics3.json, .cdi3.json, and packed texture atlas).',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
              outputPath: {
                type: 'string',
                description: 'Output directory for the exported runtime model files',
              },
              outputZipPath: {
                type: 'string',
                description: 'Optional path to package exported directory into a .zip archive',
              },
              modelName: {
                type: 'string',
                description: 'Name of the model (default: "model")',
              },
            },
            required: ['projectPath', 'outputPath'],
          },
        },
        {
          name: 'l2d_render_video',
          description: 'Render animation timeline and encode into MP4 or WebM video using ffmpeg.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
              animationId: {
                type: 'string',
                description: 'ID of animation to render',
              },
              outputVideoPath: {
                type: 'string',
                description: 'Path to target video file (e.g. /tmp/preview.mp4)',
              },
            },
            required: ['projectPath', 'animationId', 'outputVideoPath'],
          },
        },
        {
          name: 'l2d_update_psd',
          description: 'Non-destructively reload an updated PSD artwork file, updating texture bitmaps while preserving all existing deformers and keyforms.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
              newPsdPath: {
                type: 'string',
                description: 'Path to updated Photoshop (.psd) file',
              },
            },
            required: ['projectPath', 'newPsdPath'],
          },
        },
        {
          name: 'l2d_auto_rig',
          description: 'Automatically scan ArtMeshes, categorize parts by semantics (face, eyes, mouth, hair), build standard Live2D hierarchical deformer tree and 3x3 turn keyforms.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'l2d_diff_models',
          description: 'Compare two L2DEditor projects and return a structured diff of parameters, nodes, deformers, and keyforms.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPathA: {
                type: 'string',
                description: 'Path to first .l2dproj directory or project.json',
              },
              projectPathB: {
                type: 'string',
                description: 'Path to second .l2dproj directory or project.json',
              },
            },
            required: ['projectPathA', 'projectPathB'],
          },
        },
        {
          name: 'l2d_stats',
          description: 'Calculate detailed polygon count, vertex count, deformers count, and estimated texture VRAM memory budget for a project.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to .l2dproj directory or project.json',
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'l2d_import_mtn',
          description: 'Import an official Live2D .mtn motion template into a project (supports IdConverter PARAM_ANGLE_X -> ParamAngleX and $fadein/$fadeout).',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string' },
              mtnPath: { type: 'string' },
              animationId: { type: 'string' },
              animationName: { type: 'string' },
              normalizeIds: { type: 'boolean' },
            },
            required: ['projectPath', 'mtnPath'],
          },
        },
        {
          name: 'l2d_bake_physics',
          description: 'Simulate PhysicsGroup pendulums across an animation and bake resulting curves into animation tracks (CMD_BAKE_PHYSICS).',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string' },
              animationId: { type: 'string' },
            },
            required: ['projectPath', 'animationId'],
          },
        },
        {
          name: 'l2d_export_psd',
          description: 'Export an evaluated project back into a multi-layer .psd file (CMD_EXPORT_MODEL_AS_PSD).',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string' },
              outputPath: { type: 'string' },
              parameters: { type: 'object', additionalProperties: { type: 'number' } },
            },
            required: ['projectPath', 'outputPath'],
          },
        },
        {
          name: 'l2d_ai_face_rig',
          description: 'Run Cubism 5.3 AI ONNX Face Deformer motion generator (face_deformer_xy.onnx + face_deformer_4corner.onnx) on the project.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string' },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'l2d_export_moc3',
          description: 'Export project directly to a spec-compliant Live2D .moc3 binary (ver 1..5) in pure Rust.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: { type: 'string' },
              outputPath: { type: 'string' },
              mocVersion: { type: 'number', description: 'MOC3 version 1..5 (default: 5 = Cubism 5.0)' },
            },
            required: ['projectPath', 'outputPath'],
          },
        },
        {
          name: 'l2d_import_moc3',
          description: 'Import a Live2D .moc3 binary into an L2DEditor project.json in pure Rust.',
          inputSchema: {
            type: 'object',
            properties: {
              moc3Path: { type: 'string' },
              outputPath: { type: 'string' },
            },
            required: ['moc3Path', 'outputPath'],
          },
        },
        {
          name: 'l2d_import_bundle',
          description: 'Import an entire Live2D runtime bundle (.model3.json, .moc3, .physics3, .cdi3, expressions, pose) into an L2DEditor project.',
          inputSchema: {
            type: 'object',
            properties: {
              model3JsonPath: { type: 'string' },
              outputPath: { type: 'string' },
            },
            required: ['model3JsonPath', 'outputPath'],
          },
        },
  ];

  const callOfflineTool = async (name: string, args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      if (name === 'l2d_acceptance') {
        const report = await runAcceptance(resolveProjectJsonPath(args.projectPath as string), args.outputDirectory as string, args.plan as AcceptancePlan | undefined);
        return { content: [{ type: 'text', text: JSON.stringify({ reportPath: path.resolve(args.outputDirectory as string, 'report.json'), numericalPass: report.numericalPass, cases: report.cases.length, visualReview: report.visualReview, externalRuntime: report.externalRuntime }) }], isError: !report.numericalPass };
      }
      if (name === 'l2d_check_acceptance') {
        const result = await checkAcceptanceRevision(resolveProjectJsonPath(args.projectPath as string), args.reportPath as string);
        return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: !result.current };
      }
      if (name === 'l2d_inspect') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const project: Project = JSON.parse(raw);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  format_version: project.format_version,
                  canvas: project.canvas,
                  parameter_count: project.parameters.length,
                  parameters: project.parameters,
                  node_count: project.nodes.length,
                  nodes: project.nodes.map((n) => ({
                    id: n.id,
                    name: n.name,
                    parent_id: n.parent_id,
                    kind_type: n.kind.type,
                  })),
                  keyform_count: project.keyforms.length,
                  texture_count: project.textures.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (name === 'l2d_lint') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const diags = lintProjectJson(raw);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(diags, null, 2),
            },
          ],
        };
      }

      if (name === 'l2d_exec_command') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const project: Project = JSON.parse(raw);
        const cmd = args?.command as any;
        const dryRun = Boolean(args?.dryRun);

        const bus = new CommandBus(project);
        registerStandardCommands(bus);

        if (dryRun) {
          const dryRes = bus.dryRun(cmd);
          return {
            content: [{ type: 'text', text: JSON.stringify(dryRes, null, 2) }],
          };
        }

        const res = bus.execute(cmd);
        if (res.success) {
          const updated = bus.getProject();
          fs.writeFileSync(projectPath, JSON.stringify(updated, null, 2), 'utf-8');
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
        };
      }

      if (name === 'l2d_snapshot') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const projectDir = path.dirname(projectPath);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const project: Project = JSON.parse(raw);
        const outPath = args?.outputPath as string;
        const paramOverrides = (args?.parameters as Record<string, number>) || {};

        const model = new WasmModel(raw);
        for (const [k, v] of Object.entries(paramOverrides)) {
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

        const pngBuffer = await renderFrameToCanvas(
          project.canvas.width,
          project.canvas.height,
          frame,
          textureResolver,
          project.canvas.background_color
        );

        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, pngBuffer);

        return {
          content: [
            {
              type: 'text',
              text: `Snapshot successfully rendered to ${outPath} (${pngBuffer.length} bytes)`,
            },
          ],
        };
      }

      if (name === 'l2d_import_psd') {
        const psdPath = args?.psdPath as string;
        const outProjDir = args?.outputProjectPath as string;
        const density = typeof args?.meshDensity === 'number' ? args.meshDensity : 2;

        const buf = fs.readFileSync(psdPath);
        const { project, extractedTextures } = await importPsdBuffer(buf, { meshDensity: density });

        fs.mkdirSync(outProjDir, { recursive: true });
        const texturesDir = path.join(outProjDir, 'textures');
        fs.mkdirSync(texturesDir, { recursive: true });

        for (const tex of extractedTextures) {
          fs.writeFileSync(path.join(texturesDir, tex.filename), tex.buffer);
        }

        const projFile = path.join(outProjDir, 'project.json');
        fs.writeFileSync(projFile, JSON.stringify(project, null, 2), 'utf-8');

        return {
          content: [
            {
              type: 'text',
              text: `Successfully imported PSD to ${outProjDir}: ${project.nodes.length} nodes created, ${extractedTextures.length} textures extracted.`,
            },
          ],
        };
      }

      if (name === 'l2d_atlas') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const projectDir = path.dirname(projectPath);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const project: Project = JSON.parse(raw);
        const size = typeof args?.size === 'number' ? args.size : 2048;

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

        const result = await generateTextureAtlas(project, textureResolver, size, 4);
        const texDir = path.join(projectDir, 'textures');
        fs.mkdirSync(texDir, { recursive: true });

        for (const atlas of result.atlasPngBuffers) {
          fs.writeFileSync(path.join(texDir, atlas.filename), atlas.buffer);
        }

        fs.writeFileSync(projectPath, JSON.stringify(result.updatedProject, null, 2), 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `Generated texture atlas (${size}x${size}) and remapped ${result.updatedProject.nodes.length} nodes.`,
            },
          ],
        };
      }

      if (name === 'l2d_export') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const projectDir = path.dirname(projectPath);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const project: Project = JSON.parse(raw);
        const outDir = args?.outputPath as string;
        const modelName = (args?.modelName as string) || 'model';

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

        const res = await exportRuntimePackage(project, textureResolver, outDir, {
          modelName,
          zipOutputPath: args?.outputZipPath as string | undefined,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Exported runtime model to ${outDir} (${res.numTextures} textures, ${res.numMotions} motions). Manifest: ${res.model3JsonPath}${res.zipPath ? ` | Zip: ${res.zipPath}` : ''}`,
            },
          ],
        };
      }

      if (name === 'l2d_render_video') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const projectDir = path.dirname(projectPath);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const project: Project = JSON.parse(raw);
        const animId = args?.animationId as string;
        const outVideo = args?.outputVideoPath as string;

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

        const tempFrames = path.join('/tmp', `l2d_mcp_anim_${Date.now()}`);
        const format = outVideo.endsWith('.webm') ? 'webm' : 'mp4';
        const res = await renderAnimationSequence(project, animId, textureResolver, tempFrames, {
          format,
          videoOutputPath: outVideo,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Rendered ${res.totalFrames} frames to video: ${res.videoPath || outVideo}`,
            },
          ],
        };
      }

      if (name === 'l2d_update_psd') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const projectDir = path.dirname(projectPath);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const existingProject: Project = JSON.parse(raw);
        const psdPath = args?.newPsdPath as string;

        const buf = fs.readFileSync(psdPath);
        const { project: updatedProject, extractedTextures } = await importPsdBuffer(buf, {
          existingProject,
        });

        const texDir = path.join(projectDir, 'textures');
        fs.mkdirSync(texDir, { recursive: true });
        for (const t of extractedTextures) {
          fs.writeFileSync(path.join(texDir, t.filename), t.buffer);
        }

        fs.writeFileSync(projectPath, JSON.stringify(updatedProject, null, 2), 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `Successfully reloaded artwork from ${psdPath}: preserved all existing deformers, parameters, and keyforms.`,
            },
          ],
        };
      }

      if (name === 'l2d_auto_rig') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const project: Project = JSON.parse(raw);

        const bus = new CommandBus(project);
        registerStandardCommands(bus);

        const res = bus.execute({
          id: `cmd_autorig_${Date.now()}`,
          name: 'macro.auto_rig',
          params: {},
        });

        if (res.success) {
          const updated = bus.getProject();
          fs.writeFileSync(projectPath, JSON.stringify(updated, null, 2), 'utf-8');
          return {
            content: [
              {
                type: 'text',
                text: `Successfully auto-rigged project: created ${updated.nodes.filter(n => n.kind.type !== 'ArtMesh').length} deformers and parameter spaces.`,
              },
            ],
          };
        } else {
          return {
            isError: true,
            content: [{ type: 'text', text: `Auto-rig failed: ${res.error}` }],
          };
        }
      }

      if (name === 'l2d_diff_models') {
        const fileA = resolveProjectJsonPath(args?.projectPathA as string);
        const fileB = resolveProjectJsonPath(args?.projectPathB as string);
        const a: Project = JSON.parse(fs.readFileSync(fileA, 'utf-8'));
        const b: Project = JSON.parse(fs.readFileSync(fileB, 'utf-8'));

        const paramsA = new Set(a.parameters.map((p) => p.id));
        const paramsB = new Set(b.parameters.map((p) => p.id));
        const nodesA = new Set(a.nodes.map((n) => n.id));
        const nodesB = new Set(b.nodes.map((n) => n.id));

        const diffReport = {
          canvasChanged: a.canvas.width !== b.canvas.width || a.canvas.height !== b.canvas.height,
          addedParameters: [...paramsB].filter((id) => !paramsA.has(id)),
          removedParameters: [...paramsA].filter((id) => !paramsB.has(id)),
          addedNodes: [...nodesB].filter((id) => !nodesA.has(id)),
          removedNodes: [...nodesA].filter((id) => !nodesB.has(id)),
          keyformCountDelta: b.keyforms.length - a.keyforms.length,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(diffReport, null, 2) }],
        };
      }

      if (name === 'l2d_stats') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const stats = getProjectStats(raw);
        return {
          content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
        };
      }

      if (name === 'l2d_import_mtn') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const mtnPath = args?.mtnPath as string;
        const animId = (args?.animationId as string) || 'mtn_imported';
        const animName = (args?.animationName as string) || 'Imported MTN Motion';
        const normalizeIds = args?.normalizeIds !== false;
        const project: Project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
        const mtnContent = fs.readFileSync(mtnPath, 'utf-8');
        const anim = importMtnMotion(animId, animName, mtnContent, normalizeIds);
        if (!project.animations) project.animations = [];
        const idx = project.animations.findIndex((a) => a.id === anim.id);
        if (idx >= 0) project.animations[idx] = anim;
        else project.animations.push(anim);
        fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `Imported .mtn motion '${anim.name}' (${anim.tracks.length} tracks, ${anim.duration_frames} frames @ ${anim.fps}fps)`,
            },
          ],
        };
      }

      if (name === 'l2d_bake_physics') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const animationId = args?.animationId as string;
        const raw = fs.readFileSync(projectPath, 'utf-8');
        const updatedJson = bakePhysicsToAnimation(raw, animationId);
        fs.writeFileSync(projectPath, updatedJson, 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `Baked pendulum physics into animation '${animationId}'.`,
            },
          ],
        };
      }

      if (name === 'l2d_export_psd') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const projectDir = path.dirname(projectPath);
        const outPath = args?.outputPath as string;
        const params = (args?.parameters as Record<string, number>) || {};
        const project: Project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
        const textureResolver = (textureId: string): Buffer | null => {
          const meta = project.textures.find((t) => t.id === textureId);
          if (!meta) return null;
          const fullPath = path.isAbsolute(meta.path) ? meta.path : path.join(projectDir, meta.path);
          return fs.existsSync(fullPath) ? fs.readFileSync(fullPath) : null;
        };
        const psdBuf = await exportModelToPsdBuffer(project, textureResolver, params);
        fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
        fs.writeFileSync(outPath, psdBuf);
        return {
          content: [{ type: 'text', text: `Exported layered PSD to ${outPath} (${psdBuf.length} bytes)` }],
        };
      }

      if (name === 'l2d_ai_face_rig') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const project: Project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
        const updated = applyCubismAiFaceRig(project);
        fs.writeFileSync(projectPath, JSON.stringify(updated, null, 2), 'utf-8');
        return {
          content: [{ type: 'text', text: `Generated ONNX AI 3x3 Face Deformer keyforms on ${projectPath}` }],
        };
      }

      if (name === 'l2d_export_moc3') {
        const projectPath = resolveProjectJsonPath(args?.projectPath as string);
        const outPath = args?.outputPath as string;
        const ver = Number(args?.mocVersion) || 5;
        const project: Project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));
        const moc3Buf = serializeMoc3Container(project, ver);
        fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
        fs.writeFileSync(outPath, moc3Buf);
        return {
          content: [{ type: 'text', text: `Exported .moc3 (v${ver}, ${moc3Buf.length} bytes) to ${outPath}` }],
        };
      }

      if (name === 'l2d_import_moc3') {
        const moc3Path = args?.moc3Path as string;
        const outPath = args?.outputPath as string;
        const buf = fs.readFileSync(moc3Path);
        const { mocVersion, project } = parseMoc3ToProject(buf);
        const targetFile = outPath.endsWith('.json') ? outPath : path.join(outPath, 'project.json');
        fs.mkdirSync(path.dirname(path.resolve(targetFile)), { recursive: true });
        fs.writeFileSync(targetFile, JSON.stringify(project, null, 2), 'utf-8');
        return {
          content: [{ type: 'text', text: `Imported .moc3 (v${mocVersion}, ${project.nodes.length} nodes) to ${targetFile}` }],
        };
      }

      if (name === 'l2d_import_bundle') {
        const model3JsonPath = args?.model3JsonPath as string;
        const outPath = args?.outputPath as string;
        const { project, modelName, mocVersion } = importRuntimePackage(model3JsonPath);
        const targetFile = outPath.endsWith('.json') ? outPath : path.join(outPath, 'project.json');
        fs.mkdirSync(path.dirname(path.resolve(targetFile)), { recursive: true });
        fs.writeFileSync(targetFile, JSON.stringify(project, null, 2), 'utf-8');
        return {
          content: [{ type: 'text', text: `Imported runtime bundle '${modelName}' (v${mocVersion}, ${project.nodes.length} nodes, ${project.parameters.length} params) to ${targetFile}` }],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${err?.message || String(err)}` }],
      };
    }
  };
  for (const tool of offlineTools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: z.fromJSONSchema(tool.inputSchema as Parameters<typeof z.fromJSONSchema>[0]) as z.ZodObject,
    }, args => callOfflineTool(tool.name, args));
  }
  registerEditorTools(server, options.editorUrl);
  return server.server;
}

function resolveProjectJsonPath(inputPath: string): string {
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

export async function runStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
