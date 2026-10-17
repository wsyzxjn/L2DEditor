import * as PIXI from 'pixi.js';
import type { EvaluatedFrameJs, EvaluatedMeshJs } from '@l2d/schema';

export class PixiL2DRenderer {
  public container: PIXI.Container;
  private meshMap = new Map<string, PIXI.Mesh<PIXI.MeshGeometry>>();
  private meshTextureIds = new Map<string, string>();
  private textureMap = new Map<string, PIXI.Texture>();
  private maskMap = new Map<string, {
    container: PIXI.Container;
    effect: PIXI.AlphaMask;
    meshes: Map<string, PIXI.Mesh<PIXI.MeshGeometry>>;
  }>();

  constructor() {
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
  }

  /** Register a texture owned by this renderer. It is destroyed on replacement or renderer teardown. */
  public registerTexture(textureId: string, texture: PIXI.Texture): void {
    const previous = this.textureMap.get(textureId);
    if (previous === texture) return;

    this.textureMap.set(textureId, texture);

    // A texture can be replaced while meshes are alive (for example after a
    // PSD reload). Rebind those meshes before releasing the old GPU source.
    for (const [meshId, mesh] of this.meshMap.entries()) {
      if (this.meshTextureIds.get(meshId) === textureId || mesh.texture === previous) {
        mesh.texture = texture;
      }
    }
    for (const mask of this.maskMap.values()) {
      for (const [sourceId, mesh] of mask.meshes) {
        if (this.meshTextureIds.get(sourceId) === textureId || mesh.texture === previous) mesh.texture = texture;
      }
    }

    if (previous && previous !== PIXI.Texture.WHITE && !previous.destroyed && ![...this.textureMap.values()].includes(previous)) {
      previous.destroy(true);
    }
  }

  public updateFrame(frame: EvaluatedFrameJs): void {
    const activeMeshIds = new Set<string>();

    for (const meshData of frame.meshes) {
      activeMeshIds.add(meshData.id);
      this.meshTextureIds.set(meshData.id, meshData.texture_id);
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
        updateGeometry(mesh, meshData);
      }
      mesh.texture = this.textureMap.get(meshData.texture_id) || PIXI.Texture.WHITE;

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

    const frameMeshes = new Map(frame.meshes.map(mesh => [mesh.id, mesh]));
    for (const meshData of frame.meshes) {
      const mesh = this.meshMap.get(meshData.id)!;
      const masks = meshData.mask_ids ?? [];
      const sources = masks.map(id => frameMeshes.get(id)).filter((source): source is EvaluatedMeshJs => !!source);
      let mask = this.maskMap.get(meshData.id);
      if (sources.length === 0) {
        if (mask) this.removeMask(meshData.id);
        continue;
      }
      if (!mask) {
        const container = new PIXI.Container();
        this.container.addChild(container);
        const effect = new PIXI.AlphaMask({ mask: container });
        mask = { container, effect, meshes: new Map() };
        this.maskMap.set(meshData.id, mask);
        mesh.addEffect(effect);
      }
      const activeMasks = new Set<string>();
      for (const source of sources) {
        const id = source.id;
        activeMasks.add(id);
        let coverage = mask.meshes.get(id);
        if (!coverage) {
          coverage = new PIXI.Mesh({
            geometry: new PIXI.MeshGeometry({
              positions: new Float32Array(source.vertices),
              uvs: new Float32Array(source.uvs),
              indices: new Uint32Array(source.indices),
            }),
            texture: this.textureMap.get(source.texture_id) ?? PIXI.Texture.WHITE,
          });
          mask.meshes.set(id, coverage);
          mask.container.addChild(coverage);
        } else {
          updateGeometry(coverage, source);
        }
        coverage.texture = this.textureMap.get(source.texture_id) ?? PIXI.Texture.WHITE;
        // AlphaMask renders this union through Pixi's existing filter pipe.
        // Referenced opacity-zero meshes still supply their texture coverage.
        coverage.alpha = 1;
      }
      for (const [id, coverage] of mask.meshes) {
        if (activeMasks.has(id)) continue;
        const geometry = coverage.geometry;
        coverage.destroy();
        geometry.destroy();
        mask.meshes.delete(id);
      }
      mesh.setMask({ inverse: meshData.is_mask_inverted ?? false, channel: 'alpha' });
    }

    // Remove deleted meshes
    for (const [id, mesh] of this.meshMap.entries()) {
      if (!activeMeshIds.has(id)) {
        this.removeMask(id);
        this.container.removeChild(mesh);
        const geometry = mesh.geometry;
        mesh.destroy({ children: true });
        geometry.destroy();
        this.meshMap.delete(id);
        this.meshTextureIds.delete(id);
      }
    }
  }

  private removeMask(id: string): void {
    const mask = this.maskMap.get(id);
    if (!mask) return;
    this.meshMap.get(id)?.removeEffect(mask.effect);
    mask.effect.destroy();
    for (const coverage of mask.meshes.values()) {
      coverage.texture = PIXI.Texture.WHITE;
      const geometry = coverage.geometry;
      coverage.destroy();
      geometry.destroy();
    }
    mask.container.destroy();
    this.maskMap.delete(id);
  }

  public destroy(): void {
    for (const id of this.maskMap.keys()) this.removeMask(id);
    this.container.removeChildren();
    for (const mesh of this.meshMap.values()) {
      mesh.texture = PIXI.Texture.WHITE;
      const geometry = mesh.geometry;
      mesh.destroy({ children: true });
      geometry.destroy();
    }
    this.meshMap.clear();
    this.meshTextureIds.clear();

    for (const texture of this.textureMap.values()) {
      if (texture !== PIXI.Texture.WHITE && !texture.destroyed) {
        texture.destroy(true);
      }
    }
    this.textureMap.clear();
    this.container.destroy();
  }
}

function updateGeometry(mesh: PIXI.Mesh<PIXI.MeshGeometry>, source: EvaluatedMeshJs): void {
  const geometry = mesh.geometry;
  geometry.uvs = new Float32Array(source.uvs);
  geometry.indices = new Uint32Array(source.indices);
  geometry.getAttribute('aUV').buffer.update();
  geometry.indexBuffer?.update();
  const buffer = geometry.getAttribute('aPosition').buffer;
  buffer.data = new Float32Array(source.vertices);
  buffer.update();
}
