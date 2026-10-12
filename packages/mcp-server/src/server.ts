import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { CommandBus, registerStandardCommands } from '@l2d/command';
import { importPsdBuffer } from '@l2d/psd';
import {
  renderFrameToCanvas,
  generateTextureAtlas,
  exportRuntimePackage,
  renderAnimationSequence,
} from '@l2d/renderer';
import type { Project } from '@l2d/schema';
// Wasm node bindings
import { WasmModel, lintProjectJson } from '@l2d/schema/wasm-node';

export function createMcpServer(): Server {
  const server = new Server(
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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
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
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
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

        const pngBuffer = renderFrameToCanvas(
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

        const result = generateTextureAtlas(project, textureResolver, size, 4);
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

        const res = exportRuntimePackage(project, textureResolver, outDir, {
          modelName,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Exported runtime model to ${outDir} (${res.numTextures} textures, ${res.numMotions} motions). Manifest: ${res.model3JsonPath}`,
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
        const res = renderAnimationSequence(project, animId, textureResolver, tempFrames, {
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

      throw new Error(`Tool not found: ${name}`);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${err?.message || String(err)}` }],
      };
    }
  });

  return server;
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
