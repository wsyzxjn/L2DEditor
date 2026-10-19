import type { Project } from '@l2d/schema';
import { generateTextureAtlas } from './atlas.js';
import type { TextureResolver } from './headless.js';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { Image } from '@napi-rs/canvas';
import { safeResolveWithin, writeFileAtomicSync } from './fs-utils.js';

const req = createRequire(import.meta.url);
const wasmNode = req('@l2d/schema/wasm-node');

export interface RuntimeExportOptions {
  modelName?: string;
  atlasSize?: number;
  zipOutputPath?: string;
  embedSourceProject?: boolean;
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
    const texPath = safeResolveWithin(texDir, atlas.filename, 'atlas texture path');
    writeFileAtomicSync(texPath, atlas.buffer);
  }

  // 2. Run pure-Rust runtime bundle generator (`crates/l2d-core/src/exporter.rs`)
  const bundle = wasmNode.exportRuntimeBundleWithOptions(
    JSON.stringify(project),
    modelName,
    atlasSize,
    4,
    options.embedSourceProject ?? false
  ) as {
    model_name: string;
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
  const artifactName = bundle.model_name || 'model';

  // 3. Write Rust-generated artifacts to disk
  const moc3Path = safeResolveWithin(outDir, `${artifactName}.moc3`, 'MOC3 output path');
  writeFileAtomicSync(moc3Path, Buffer.from(bundle.moc3_bytes));

  writeFileAtomicSync(
    safeResolveWithin(outDir, `${artifactName}.physics3.json`, 'physics output path'),
    bundle.physics3_json
  );
  writeFileAtomicSync(
    safeResolveWithin(outDir, `${artifactName}.cdi3.json`, 'display info output path'),
    bundle.cdi3_json
  );

  if (bundle.userdata3_json) {
    writeFileAtomicSync(
      safeResolveWithin(outDir, `${artifactName}.userdata3.json`, 'user data output path'),
      bundle.userdata3_json
    );
  }
  if (bundle.pose3_json) {
    writeFileAtomicSync(
      safeResolveWithin(outDir, `${artifactName}.pose3.json`, 'pose output path'),
      bundle.pose3_json
    );
  }
  if (bundle.motionsync3_json) {
    writeFileAtomicSync(
      safeResolveWithin(outDir, `${artifactName}.motionsync3.json`, 'motion sync output path'),
      bundle.motionsync3_json
    );
  }

  for (const mf of bundle.motion_files) {
    const targetPath = safeResolveWithin(outDir, mf.relative_path, 'motion output path');
    writeFileAtomicSync(targetPath, mf.content);
  }

  for (const ef of bundle.expression_files) {
    const targetPath = safeResolveWithin(outDir, ef.relative_path, 'expression output path');
    writeFileAtomicSync(targetPath, ef.content);
  }

  const model3Path = safeResolveWithin(
    outDir,
    `${artifactName}.model3.json`,
    'model3 output path'
  );
  writeFileAtomicSync(model3Path, bundle.model3_json);

  let zipPath: string | undefined;
  if (options.zipOutputPath) {
    const targetZip = path.resolve(options.zipOutputPath);
    fs.mkdirSync(path.dirname(targetZip), { recursive: true });
    const tempZip = path.join(
      path.dirname(targetZip),
      `.${path.basename(targetZip)}.tmp-${process.pid}-${Date.now()}`
    );
    fs.rmSync(tempZip, { force: true });
    try {
      const archiveCwd = path.resolve(outDir);
      const exclusion = path.relative(archiveCwd, tempZip);
      const args = ['-q', '-r', tempZip, '.'];
      if (exclusion && !exclusion.startsWith('..') && !path.isAbsolute(exclusion)) {
        args.push('-x', exclusion);
      }
      execFileSync('zip', args, { cwd: archiveCwd, stdio: 'pipe' });
      fs.rmSync(targetZip, { force: true });
      fs.renameSync(tempZip, targetZip);
      zipPath = targetZip;
    } catch (error: any) {
      fs.rmSync(tempZip, { force: true });
      throw new Error(`Zip archive generation failed: ${error?.message || error}`);
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

  const mocPath = safeResolveWithin(modelDir, fileRefs.Moc, 'model3 FileReferences.Moc');
  const mocBuf = fs.readFileSync(mocPath);
  const mocVersion = mocBuf.readUInt8(4);
  const project: Project = wasmNode.importMoc3Binary(new Uint8Array(mocBuf));

  // 1. Reconstruct Textures
  const textureList = Array.isArray(fileRefs.Textures) ? fileRefs.Textures : [];
  const parsedTextures = project.textures;
  project.textures = textureList.map((relTex: string, idx: number) => {
    const fullTexPath = safeResolveWithin(modelDir, relTex, `model3 texture #${idx}`);
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
  const textureIds = project.textures.map((texture) => texture.id);
  for (const node of project.nodes) {
    if (node.kind.type !== 'ArtMesh') continue;
    const match = /^texture_(\d+)$/.exec(node.kind.texture_id);
    if (match) {
      const textureIndex = Number(match[1]);
      if (textureIndex < textureIds.length) {
        node.kind.texture_id = textureIds[textureIndex];
      }
    }
  }

  // 2. Import Physics (`.physics3.json`)
  if (fileRefs.Physics) {
    const physPath = safeResolveWithin(modelDir, fileRefs.Physics, 'model3 Physics');
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
    const cdiPath = safeResolveWithin(modelDir, fileRefs.DisplayInfo, 'model3 DisplayInfo');
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
    const posePath = safeResolveWithin(modelDir, fileRefs.Pose, 'model3 Pose');
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
    for (const [exprIndex, exprRef] of fileRefs.Expressions.entries()) {
      const expFile = safeResolveWithin(
        modelDir,
        exprRef?.File,
        `model3 expression #${exprIndex}`
      );
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

/** Copy imported runtime textures beside the target project.json without allowing path escapes. */
export function copyRuntimePackageTextures(
  model3JsonPath: string,
  project: Project,
  outDir: string
): number {
  const modelDir = path.dirname(path.resolve(model3JsonPath));
  const destinationDir = path.resolve(outDir);
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const texture of project.textures) {
    const source = safeResolveWithin(modelDir, texture.path, `runtime texture '${texture.id}'`);
    const target = safeResolveWithin(destinationDir, texture.path, `imported texture '${texture.id}'`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    writeFileAtomicSync(target, fs.readFileSync(source));
  }
  return project.textures.length;
}
