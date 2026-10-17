import type { Project } from '@l2d/schema';
import { generateTextureAtlas } from './atlas.js';
import type { TextureResolver } from './headless.js';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { Image } from '@napi-rs/canvas';

const req = createRequire(import.meta.url);
const wasmNode = req('@l2d/schema/wasm-node');

export interface RuntimeExportOptions {
  modelName?: string;
  atlasSize?: number;
  zipOutputPath?: string;
}

/**
 * Exports the complete Live2D Cubism runtime distribution bundle using the pure-Rust
 * `export_runtime_bundle` kernel (`crates/l2d-core/src/exporter.rs`).
 */
export async function exportRuntimePackage(
  project: Project,
  textureResolver: TextureResolver,
  outDir: string,
  options: RuntimeExportOptions = {}
): Promise<{ model3JsonPath: string; moc3Path: string; numTextures: number; numMotions: number; zipPath?: string }> {
  const modelName = options.modelName || 'model';
  const atlasSize = options.atlasSize || 2048;

  fs.mkdirSync(outDir, { recursive: true });
  const texDir = path.join(outDir, 'textures');
  fs.mkdirSync(texDir, { recursive: true });
  const motionsDir = path.join(outDir, 'motions');
  fs.mkdirSync(motionsDir, { recursive: true });

  // 1. Render packed atlas PNGs
  const atlasResult = await generateTextureAtlas(project, textureResolver, atlasSize, 4);
  for (const atlas of atlasResult.atlasPngBuffers) {
    const texPath = path.join(texDir, atlas.filename);
    fs.writeFileSync(texPath, atlas.buffer);
  }

  // 2. Run pure-Rust runtime bundle generator (`crates/l2d-core/src/exporter.rs`)
  const bundle = wasmNode.exportRuntimeBundle(
    JSON.stringify(project),
    modelName,
    atlasSize,
    4
  ) as {
    moc3_bytes: number[] | Uint8Array;
    model3_json: string;
    physics3_json: string;
    cdi3_json: string;
    userdata3_json?: string | null;
    pose3_json?: string | null;
    motionsync3_json?: string | null;
    motion_files: { relative_path: string; content: string }[];
    expression_files: { relative_path: string; content: string }[];
  };

  // 3. Write Rust-generated artifacts to disk
  const moc3Path = path.join(outDir, `${modelName}.moc3`);
  fs.writeFileSync(moc3Path, Buffer.from(bundle.moc3_bytes));

  fs.writeFileSync(path.join(outDir, `${modelName}.physics3.json`), bundle.physics3_json, 'utf-8');
  fs.writeFileSync(path.join(outDir, `${modelName}.cdi3.json`), bundle.cdi3_json, 'utf-8');

  if (bundle.userdata3_json) {
    fs.writeFileSync(path.join(outDir, `${modelName}.userdata3.json`), bundle.userdata3_json, 'utf-8');
  }
  if (bundle.pose3_json) {
    fs.writeFileSync(path.join(outDir, `${modelName}.pose3.json`), bundle.pose3_json, 'utf-8');
  }
  if (bundle.motionsync3_json) {
    fs.writeFileSync(path.join(outDir, `${modelName}.motionsync3.json`), bundle.motionsync3_json, 'utf-8');
  }

  for (const mf of bundle.motion_files) {
    const targetPath = path.join(outDir, mf.relative_path);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, mf.content, 'utf-8');
  }

  for (const ef of bundle.expression_files) {
    const targetPath = path.join(outDir, ef.relative_path);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, ef.content, 'utf-8');
  }

  const model3Path = path.join(outDir, `${modelName}.model3.json`);
  fs.writeFileSync(model3Path, bundle.model3_json, 'utf-8');

  let zipPath: string | undefined;
  if (options.zipOutputPath) {
    try {
      fs.mkdirSync(path.dirname(options.zipOutputPath), { recursive: true });
      execFileSync('zip', ['-r', path.resolve(options.zipOutputPath), '.'], { cwd: outDir });
      zipPath = options.zipOutputPath;
    } catch (e: any) {
      console.warn('Zip archive generation failed:', e);
    }
  }

  return {
    model3JsonPath: model3Path,
    moc3Path,
    numTextures: atlasResult.atlasPngBuffers.length,
    numMotions: bundle.motion_files.length,
    zipPath,
  };
}

/**
 * Reconstructs a full L2DEditor `Project` from a third-party or exported Live2D runtime bundle
 * (`.model3.json` + `.moc3` + `.physics3.json` + `.cdi3.json` + `motions` + `expressions` + `.pose3.json`).
 */
export function importRuntimePackage(model3JsonPath: string): {
  project: Project;
  modelName: string;
  mocVersion: number;
} {
  const modelDir = path.dirname(path.resolve(model3JsonPath));
  const rawJson = fs.readFileSync(model3JsonPath, 'utf-8');
  const model3 = JSON.parse(rawJson);
  const fileRefs = model3.FileReferences || {};

  if (!fileRefs.Moc) {
    throw new Error(`Invalid model3.json: missing FileReferences.Moc`);
  }

  const mocPath = path.resolve(modelDir, fileRefs.Moc);
  const mocBuf = fs.readFileSync(mocPath);
  const mocVersion = mocBuf.readUInt8(4);
  const project: Project = wasmNode.importMoc3Binary(new Uint8Array(mocBuf));

  // 1. Reconstruct Textures
  const textureList = fileRefs.Textures || [];
  const parsedTextures = project.textures;
  project.textures = textureList.map((relTex: string, idx: number) => {
    const fullTexPath = path.resolve(modelDir, relTex);
    const image = new Image();
    image.src = fs.readFileSync(fullTexPath);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!image.complete || width <= 0 || height <= 0) {
      throw new Error(`Invalid runtime texture: ${relTex}`);
    }
    image.src = '';
    // Lossless MOC metadata already assigns texture IDs to the mesh UVs.
    // Without that metadata, the Rust section parser uses texture_00.
    const id = parsedTextures[idx]?.id ?? `texture_${String(idx).padStart(2, '0')}`;
    return {
      id,
      path: path.relative(modelDir, fullTexPath),
      width,
      height,
    };
  });

  // 2. Import Physics (`.physics3.json`)
  if (fileRefs.Physics) {
    const physPath = path.resolve(modelDir, fileRefs.Physics);
    if (fs.existsSync(physPath)) {
      try {
        const physJson = JSON.parse(fs.readFileSync(physPath, 'utf-8'));
        project.physics = (physJson.PhysicsSettings || []).map((s: any) => ({
          id: s.Id || 'physics_group',
          name: s.Id || 'Physics Group',
          inputs: (s.Input || []).map((inp: any) => ({
            param_id: inp.Source?.Id || '',
            weight: inp.Weight ?? 1.0,
            reflect: inp.Reflect ?? false,
          })),
          outputs: (s.Output || []).map((out: any) => ({
            param_id: out.Destination?.Id || '',
            pendulum_index: out.VertexIndex ?? 0,
            angle_scale: out.Scale ?? 1.0,
            weight: out.Weight ?? 1.0,
          })),
          pendulums: (s.Vertices || []).map((v: any) => ({
            length: v.Radius ?? 10.0,
            damping: v.Delay ?? 0.8,
            mass: v.Acceleration ?? 1.0,
          })),
        }));
      } catch (e) {
        console.warn('Failed to parse .physics3.json:', e);
      }
    }
  }

  // 3. Import Display Info (`.cdi3.json`)
  if (fileRefs.DisplayInfo) {
    const cdiPath = path.resolve(modelDir, fileRefs.DisplayInfo);
    if (fs.existsSync(cdiPath)) {
      try {
        const cdiJson = JSON.parse(fs.readFileSync(cdiPath, 'utf-8'));
        for (const p of cdiJson.Parameters || []) {
          const existing = project.parameters.find((ep) => ep.id === p.Id);
          if (existing && p.Name) {
            existing.name = p.Name;
            existing.group_id = p.GroupId || null;
          }
        }
        project.parameter_groups = (cdiJson.ParameterGroups || []).map((g: any) => ({
          id: g.Id,
          name: g.Name || g.Id,
          collapsed: false,
        }));
      } catch (e) {
        console.warn('Failed to parse .cdi3.json:', e);
      }
    }
  }

  // 4. Import Pose (`.pose3.json`)
  if (fileRefs.Pose) {
    const posePath = path.resolve(modelDir, fileRefs.Pose);
    if (fs.existsSync(posePath)) {
      try {
        const poseJson = JSON.parse(fs.readFileSync(posePath, 'utf-8'));
        project.pose_groups = (poseJson.Groups || []).map((g: any[], gIdx: number) => ({
          id: `pose_group_${gIdx}`,
          name: `Pose Group #${gIdx + 1}`,
          fade_in_time: poseJson.FadeInTime ?? 0.5,
          part_ids: g.map((item: any) => item.Id),
        }));
      } catch (e) {
        console.warn('Failed to parse .pose3.json:', e);
      }
    }
  }

  // 5. Import Expressions (`expressions/*.exp3.json`)
  if (Array.isArray(fileRefs.Expressions)) {
    project.expressions = [];
    for (const exprRef of fileRefs.Expressions) {
      const expFile = path.resolve(modelDir, exprRef.File);
      if (fs.existsSync(expFile)) {
        try {
          const expJson = JSON.parse(fs.readFileSync(expFile, 'utf-8'));
          project.expressions.push({
            id: exprRef.Name || path.basename(exprRef.File, '.exp3.json'),
            name: exprRef.Name || path.basename(exprRef.File, '.exp3.json'),
            fade_in_time: expJson.FadeInTime ?? 0.5,
            fade_out_time: expJson.FadeOutTime ?? 0.5,
            parameters: (expJson.Parameters || []).map((p: any) => ({
              id: p.Id,
              value: p.Value,
              blend: (p.Blend || 'add').toLowerCase(),
            })),
          });
        } catch (e) {
          console.warn(`Failed to parse expression ${expFile}:`, e);
        }
      }
    }
  }

  const modelName = path.basename(fileRefs.Moc, '.moc3');
  return { project, modelName, mocVersion };
}
