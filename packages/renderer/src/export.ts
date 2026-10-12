import type { Project } from '@l2d/schema';
import { generateTextureAtlas } from './atlas.js';
import type { TextureResolver } from './headless.js';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

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
export function exportRuntimePackage(
  project: Project,
  textureResolver: TextureResolver,
  outDir: string,
  options: RuntimeExportOptions = {}
): { model3JsonPath: string; moc3Path: string; numTextures: number; numMotions: number; zipPath?: string } {
  const modelName = options.modelName || 'model';
  const atlasSize = options.atlasSize || 2048;

  fs.mkdirSync(outDir, { recursive: true });
  const texDir = path.join(outDir, 'textures');
  fs.mkdirSync(texDir, { recursive: true });
  const motionsDir = path.join(outDir, 'motions');
  fs.mkdirSync(motionsDir, { recursive: true });

  // 1. Render packed atlas PNGs
  const atlasResult = generateTextureAtlas(project, textureResolver, atlasSize, 4);
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
