import * as PIXI from 'pixi.js';
import type { EvaluatedFrameJs, EvaluatedMeshJs } from '@l2d/schema';

export class PixiL2DRenderer {
  public container: PIXI.Container;
  private meshMap = new Map<string, PIXI.Mesh>();
  private textureMap = new Map<string, PIXI.Texture>();

  constructor() {
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
  }

  public registerTexture(textureId: string, texture: PIXI.Texture): void {
    this.textureMap.set(textureId, texture);
  }

  public updateFrame(frame: EvaluatedFrameJs): void {
    const activeMeshIds = new Set<string>();

    for (const meshData of frame.meshes) {
      activeMeshIds.add(meshData.id);
      let mesh = this.meshMap.get(meshData.id);

      if (!mesh) {
        const texture = this.textureMap.get(meshData.texture_id) || PIXI.Texture.WHITE;
        const geometry = new PIXI.MeshGeometry({
          positions: new Float32Array(meshData.vertices),
          uvs: new Float32Array(meshData.uvs),
          indices: new Uint32Array(meshData.indices),
        });

        mesh = new PIXI.Mesh({
          geometry,
          texture,
        });

        this.meshMap.set(meshData.id, mesh);
        this.container.addChild(mesh);
      } else {
        // Update vertex buffer in place
        const geom = mesh.geometry;
        const posBuffer = geom.getAttribute('aPosition') as any;
        if (posBuffer && posBuffer.buffer) {
          posBuffer.buffer.update(new Float32Array(meshData.vertices));
        }
      }

      // Update opacity and zIndex
      mesh.alpha = meshData.opacity;
      mesh.zIndex = meshData.draw_order;

      // Set blend mode
      switch (meshData.blend_mode) {
        case 'multiply':
          mesh.blendMode = 'multiply';
          break;
        case 'screen':
          mesh.blendMode = 'screen';
          break;
        case 'additive':
          mesh.blendMode = 'add';
          break;
        default:
          mesh.blendMode = 'normal';
          break;
      }
    }

    // Remove deleted meshes
    for (const [id, mesh] of this.meshMap.entries()) {
      if (!activeMeshIds.has(id)) {
        this.container.removeChild(mesh);
        mesh.destroy({ children: true });
        this.meshMap.delete(id);
      }
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
    this.meshMap.clear();
    this.textureMap.clear();
  }
}
