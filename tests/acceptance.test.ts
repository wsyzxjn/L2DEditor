import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createCanvas } from '../packages/renderer/node_modules/@napi-rs/canvas/index.js';
import { runAcceptance, checkAcceptanceRevision } from '../packages/renderer/dist/acceptance.js';
import type { Project } from '../packages/schema/dist/index.js';

describe('revision-bound acceptance', () => {
  it('resets expressions, catches a flipped frame, compares pixels and invalidates changed resources/artifacts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'l2d-acceptance-'));
    try {
      const project: Project = {
        format_version: 1, canvas: { width: 16, height: 16, origin_x: 0.5, origin_y: 0.5, background_color: '#ffffff' },
        textures: [{ id: 'texture', path: 'texture.png', width: 16, height: 16 }],
        parameters: [{ id: 'flip', name: 'Flip', min: 0, max: 1, default: 0 }],
        expressions: [{ id: 'flip', name: 'Flip', parameters: [{ id: 'flip', value: 1, blend: 'overwrite' }] }],
        nodes: [{ id: 'mesh', name: 'Mesh', parent_id: null, visible: true, locked: false, kind: {
          type: 'ArtMesh', texture_id: 'texture', vertices: [[2, 2], [14, 2], [2, 14]], uvs: [[0, 0], [1, 0], [0, 1]], indices: [0, 1, 2], blend_mode: 'normal', opacity: 1, draw_order: 0, mask_ids: [],
        } }],
        keyforms: [{ target_node_id: 'mesh', dimensions: [{ param_id: 'flip', keys: [0, 1] }], keyforms: [
          { coordinates: [0], payload: { kind: 'ArtMesh', vertex_offsets: [[0, 0], [0, 0], [0, 0]] } },
          { coordinates: [1], payload: { kind: 'ArtMesh', vertex_offsets: [[12, 0], [-12, 0], [0, 0]] } },
        ] }],
      };
      const canvas = createCanvas(16, 16); const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 16, 16);
      const texture = canvas.toBuffer('image/png');
      await fs.writeFile(path.join(root, 'texture.png'), texture);
      const file = path.join(root, 'project.json'); await fs.writeFile(file, JSON.stringify(project));
      const output = path.join(root, 'report');
      const report = await runAcceptance(file, output, {
        cases: [{ id: 'neutral' }, { id: 'expression', expressionId: 'flip' }, { id: 'restored' }],
        comparisons: [{ reference: 'neutral', actual: 'restored', region: [0, 0, 16, 16] }],
      });
      expect(report.cases[1].issues.some(issue => issue.includes('Inverted triangle'))).toBe(true);
      expect(report.cases[0].issues).toEqual([]); expect(report.cases[2].issues).toEqual([]);
      expect(report.comparisons[0].pass).toBe(true); expect(report.comparisons[0].changedPixels).toBe(0);
      expect(report.numericalPass).toBe(false); expect(report.completeModelAccepted).toBe(false);
      const reportFile = path.join(output, 'report.json');
      expect((await checkAcceptanceRevision(file, reportFile)).current).toBe(true);
      await expect(runAcceptance(file, output, { cases: [{ id: 'one' }] })).rejects.toThrow();
      await fs.writeFile(path.join(output, 'restored.png'), 'corrupt');
      expect((await checkAcceptanceRevision(file, reportFile)).damagedArtifacts).toEqual(['restored.png']);
      await fs.writeFile(path.join(root, 'texture.png'), Buffer.concat([texture, Buffer.from('changed')]));
      expect((await checkAcceptanceRevision(file, reportFile)).stale).toBe(true);
      await expect(runAcceptance(file, path.join(root, 'invalid'), { cases: [{ id: '../escape' }] })).rejects.toThrow('Case IDs');
      await fs.rm(path.join(root, 'texture.png'));
      await expect(runAcceptance(file, path.join(root, 'missing'))).rejects.toThrow();
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
});
