import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { saveProjectFile } from '../apps/desktop/electron/project-files.js';

describe('portable project save', () => {
  it('collects relative and external textures without overwriting destination assets or source files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'l2d-save-'));
    try {
      const source = path.join(root, 'source/project.json'), target = path.join(root, 'target/copy.json');
      await fs.mkdir(path.join(root, 'source/textures'), { recursive: true });
      await fs.mkdir(path.join(root, 'target/textures'), { recursive: true });
      await fs.writeFile(path.join(root, 'source/textures/eye.png'), 'new eye');
      await fs.writeFile(path.join(root, 'target/textures/eye.png'), 'other project eye');
      await fs.writeFile(path.join(root, 'external.png'), 'external');
      const content = JSON.stringify({ textures: [{ id: 'eye', path: 'textures/eye.png' }, { id: 'external', path: '../external.png' }] });
      await fs.writeFile(source, content);
      const saved = JSON.parse(await saveProjectFile(target, content, source));
      expect(saved.textures.every((texture: any) => texture.path.startsWith('textures/') && !texture.path.includes('..'))).toBe(true);
      expect(await fs.readFile(path.join(root, 'target/textures/eye.png'), 'utf8')).toBe('other project eye');
      expect(await fs.readFile(source, 'utf8')).toBe(content);
      await fs.rm(path.join(root, 'source'), { recursive: true });
      await fs.rm(path.join(root, 'external.png'));
      for (const [index, expected] of ['new eye', 'external'].entries()) {
        expect(await fs.readFile(path.resolve(path.dirname(target), saved.textures[index].path), 'utf8')).toBe(expected);
      }
      expect(JSON.parse(await fs.readFile(target, 'utf8'))).toEqual(saved);
      // Saving the relocated project again is self-contained and preserves paths.
      expect(JSON.parse(await saveProjectFile(target, JSON.stringify(saved), target))).toEqual(saved);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it('fails before touching an existing destination if any source resource is missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'l2d-save-missing-'));
    try {
      const target = path.join(root, 'target.json'); await fs.writeFile(target, 'existing project');
      await expect(saveProjectFile(target, JSON.stringify({ textures: [{ id: 'missing', path: 'missing.png' }] }), path.join(root, 'source.json'))).rejects.toThrow('Cannot read texture');
      expect(await fs.readFile(target, 'utf8')).toBe('existing project');
      expect(await fs.readdir(root)).toEqual(['target.json']);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});
