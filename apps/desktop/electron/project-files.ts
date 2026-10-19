import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Project } from '@l2d/schema';

/** Collect resources before publishing the JSON; never replace unrelated textures. */
export async function saveProjectFile(filePath: string, content: string, sourcePath?: string): Promise<string> {
  const project: Project = JSON.parse(content);
  const destination = path.resolve(filePath);
  const sourceDir = sourcePath ? path.dirname(path.resolve(sourcePath)) : path.dirname(destination);
  const destinationDir = path.dirname(destination);
  const relocated = sourceDir !== destinationDir;
  const writes = new Map<string, Buffer>();
  for (const texture of project.textures) {
    if (!path.isAbsolute(texture.path) && !sourcePath) throw new Error(`Texture '${texture.id}' needs an original project path`);
    if (!relocated && !path.isAbsolute(texture.path) && !texture.path.split(/[\\/]/).includes('..')) {
      await fs.access(path.resolve(sourceDir, texture.path)).catch(() => {
        throw new Error(`Cannot read texture '${texture.id}': ${texture.path}`);
      });
      texture.path = texture.path.split(path.sep).join('/');
      continue;
    }
    const bytes = await fs.readFile(path.resolve(sourceDir, texture.path)).catch(() => {
      throw new Error(`Cannot read texture '${texture.id}': ${texture.path}`);
    });
    if (path.resolve(destinationDir, texture.path) === destination) throw new Error('Project file conflicts with a texture path');
    const hash = createHash('sha256').update(bytes).digest('hex');
    let relative = texture.path;
    if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
      relative = `textures/${hash}${path.extname(relative)}`;
    }
    let target = path.resolve(destinationDir, relative);
    // An existing destination project may use the same relative filename.
    const previous = writes.get(target) ?? await fs.readFile(target).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return undefined;
    });
    if (previous && !previous.equals(bytes)) {
      relative = `textures/${hash}${path.extname(texture.path)}`;
      target = path.resolve(destinationDir, relative);
    }
    if (target === destination) throw new Error('Project file conflicts with a texture path');
    writes.set(target, bytes);
    texture.path = relative.split(path.sep).join('/');
  }
  // All source reads succeed before touching the destination.
  await fs.mkdir(destinationDir, { recursive: true });
  for (const [target, bytes] of writes) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      await fs.writeFile(target, bytes, { flag: 'wx' });
    } catch (error: any) {
      if (error.code !== 'EEXIST' || !(await fs.readFile(target)).equals(bytes)) throw new Error(`Texture destination conflict: ${target}`);
    }
  }
  const saved = JSON.stringify(project, null, 2);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, saved, { flag: 'wx' });
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return saved;
}
