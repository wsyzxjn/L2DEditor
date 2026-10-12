import type { Project } from '@l2d/schema';
import { generateTextureAtlas } from './atlas.js';
import type { TextureResolver } from './headless.js';
import * as fs from 'fs';
import * as path from 'path';

export interface RuntimeExportOptions {
  modelName?: string;
  atlasSize?: number;
}

export function exportRuntimePackage(
  project: Project,
  textureResolver: TextureResolver,
  outDir: string,
  options: RuntimeExportOptions = {}
): { model3JsonPath: string; numTextures: number; numMotions: number } {
  const modelName = options.modelName || 'model';
  const atlasSize = options.atlasSize || 2048;

  fs.mkdirSync(outDir, { recursive: true });
  const texDir = path.join(outDir, 'textures');
  fs.mkdirSync(texDir, { recursive: true });
  const motionsDir = path.join(outDir, 'motions');
  fs.mkdirSync(motionsDir, { recursive: true });

  // 1. Pack Atlas
  const atlasResult = generateTextureAtlas(project, textureResolver, atlasSize, 4);
  const textureFiles: string[] = [];

  for (const atlas of atlasResult.atlasPngBuffers) {
    const texPath = path.join(texDir, atlas.filename);
    fs.writeFileSync(texPath, atlas.buffer);
    textureFiles.push(`textures/${atlas.filename}`);
  }

  // 2. Generate physics3.json
  const physicsSettings: any[] = [];
  let totalInputs = 0;
  let totalOutputs = 0;
  let totalVertices = 0;

  if (project.physics) {
    for (const group of project.physics) {
      totalInputs += group.inputs.length;
      totalOutputs += group.outputs.length;
      totalVertices += group.pendulums.length;

      physicsSettings.push({
        Id: group.id,
        Input: group.inputs.map((inp) => ({
          Source: { Target: 'Parameter', Id: inp.param_id },
          Weight: inp.weight,
          Type: 'X',
          Reflect: Boolean(inp.reflect),
        })),
        Output: group.outputs.map((out) => ({
          Destination: { Target: 'Parameter', Id: out.param_id },
          VertexIndex: out.pendulum_index,
          Scale: out.angle_scale,
          Weight: out.weight,
        })),
        Vertices: group.pendulums.map((p, idx) => ({
          Position: { X: 0, Y: idx * p.length },
          Mobility: 1.0,
          Delay: p.damping,
          Acceleration: p.mass,
          Radius: 0,
        })),
      });
    }
  }

  const physics3Json = {
    Version: 3,
    Meta: {
      PhysicsSettingCount: physicsSettings.length,
      TotalInputCount: totalInputs,
      TotalOutputCount: totalOutputs,
      VertexCount: totalVertices,
      EffectiveForces: {
        Gravity: { X: 0, Y: -1 },
        Wind: { X: 0, Y: 0 },
      },
    },
    PhysicsSettings: physicsSettings,
  };
  const physicsFilename = `${modelName}.physics3.json`;
  fs.writeFileSync(path.join(outDir, physicsFilename), JSON.stringify(physics3Json, null, 2), 'utf-8');

  // 3. Generate cdi3.json (Display names for VTube Studio / Viewer)
  const cdi3Json = {
    Version: 3,
    Parameters: project.parameters.map((p) => ({
      Id: p.id,
      GroupId: '',
      Name: p.name || p.id,
    })),
    ParameterGroups: [],
    Parts: project.nodes
      .filter((n) => n.kind.type === 'Part')
      .map((p) => ({
        Id: p.id,
        Name: p.name || p.id,
      })),
  };
  const cdiFilename = `${modelName}.cdi3.json`;
  fs.writeFileSync(path.join(outDir, cdiFilename), JSON.stringify(cdi3Json, null, 2), 'utf-8');

  // 4. Generate motion3.json files from animations
  const motionReferences: Record<string, any[]> = {};
  let numMotions = 0;

  if (project.animations && project.animations.length > 0) {
    for (const anim of project.animations) {
      numMotions++;
      const motionFile = `${anim.id}.motion3.json`;
      const motionData = {
        Version: 3,
        Meta: {
          Duration: anim.duration_frames / (anim.fps || 30),
          Fps: anim.fps || 30,
          Loop: Boolean(anim.loop_playback),
          CurveCount: anim.tracks.length,
          TotalSegmentCount: anim.tracks.reduce((acc, t) => acc + Math.max(1, t.keyframes.length - 1), 0),
          TotalPointCount: anim.tracks.reduce((acc, t) => acc + t.keyframes.length, 0),
        },
        Curves: anim.tracks.map((track) => {
          const segments: number[] = [0, track.keyframes[0]?.value || 0];
          for (let i = 1; i < track.keyframes.length; i++) {
            const kf = track.keyframes[i];
            const timeSec = kf.frame / (anim.fps || 30);
            segments.push(0, timeSec, kf.value); // Linear segment
          }
          return {
            Target: 'Parameter',
            Id: track.target_param_id,
            Segments: segments,
          };
        }),
      };

      fs.writeFileSync(path.join(motionsDir, motionFile), JSON.stringify(motionData, null, 2), 'utf-8');
      motionReferences['Idle'] = motionReferences['Idle'] || [];
      motionReferences['Idle'].push({ File: `motions/${motionFile}` });
    }
  }

  // 5. Generate model3.json root manifest
  const model3Json = {
    Version: 3,
    FileReferences: {
      Moc: `${modelName}.moc3`,
      Textures: textureFiles,
      Physics: physicsFilename,
      DisplayInfo: cdiFilename,
      Motions: motionReferences,
    },
    Groups: [
      {
        Target: 'Parameter',
        Name: 'EyeBlink',
        Ids: ['ParamEyeLOpen', 'ParamEyeROpen'].filter((id) =>
          project.parameters.some((p) => p.id === id)
        ),
      },
      {
        Target: 'Parameter',
        Name: 'LipSync',
        Ids: ['ParamMouthOpen'].filter((id) =>
          project.parameters.some((p) => p.id === id)
        ),
      },
    ],
  };

  const model3Path = path.join(outDir, `${modelName}.model3.json`);
  fs.writeFileSync(model3Path, JSON.stringify(model3Json, null, 2), 'utf-8');

  return {
    model3JsonPath: model3Path,
    numTextures: textureFiles.length,
    numMotions,
  };
}
