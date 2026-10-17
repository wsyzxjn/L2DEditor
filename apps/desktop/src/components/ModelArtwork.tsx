import { useEffect, useRef, useState, type RefObject } from 'react';
import { Application, Container, Rectangle, Texture } from 'pixi.js';
import { PixiL2DRenderer } from '@l2d/renderer/pixi';
import type { EvaluatedFrameJs, Project } from '@l2d/schema';
import type { L2DApi } from '../../electron/preload.js';

interface Props {
  project: Project;
  frame: EvaluatedFrameJs | null;
  projectPath: string | null;
  pan: { x: number; y: number };
  zoom: number;
  flipped: boolean;
  soloNodeId: string | null;
  onReady: (ready: boolean) => void;
  onRendered: (frame: EvaluatedFrameJs | null) => void;
  captureRef: RefObject<((scale: number) => Promise<string>) | null>;
}

export function ModelArtwork({ project, frame, projectPath, pan, zoom, flipped, soloNodeId, onReady, onRendered, captureRef }: Props) {
  // A save under a new filename in the same directory keeps the same textures.
  const textureDirectory = projectPath?.replace(/[^/\\]+$/, '') ?? '';
  const textureProjectPath = textureDirectory ? `${textureDirectory}project.json` : null;
  const hostRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<{ app: Application; renderer: PixiL2DRenderer; view: Container } | null>(null);
  const sceneRef = useRef<typeof scene>(null);
  const [revision, setRevision] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scene || sceneRef.current !== scene) return;
    captureRef.current = scale => scene.app.renderer.extract.base64({
      target: scene.renderer.container, frame: new Rectangle(0, 0, project.canvas.width, project.canvas.height),
      resolution: scale, clearColor: project.canvas.background_color, antialias: true, format: 'png',
    });
    return () => { captureRef.current = null; };
  }, [scene, captureRef, project.canvas.width, project.canvas.height, project.canvas.background_color]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setScene(null);
    onReady(false);
    let active = true;
    let initialized = false;
    const app = new Application();
    const renderer = new PixiL2DRenderer();
    const view = new Container();
    const observer = new ResizeObserver(() => setSize({ width: host.clientWidth, height: host.clientHeight }));
    observer.observe(host);
    void app.init({ resizeTo: host, antialias: true, backgroundAlpha: 0, autoStart: false }).then(() => {
      initialized = true;
      if (!active) {
        app.destroy(true);
        renderer.destroy();
        return;
      }
      host.appendChild(app.canvas);
      view.addChild(renderer.container);
      app.stage.addChild(view);
      const nextScene = { app, renderer, view };
      sceneRef.current = nextScene;
      setScene(nextScene);
      setSize({ width: host.clientWidth, height: host.clientHeight });
    }).catch(reason => { if (active) setError(String(reason)); });
    return () => {
      active = false;
      observer.disconnect();
      sceneRef.current = null;
      if (initialized) {
        // Release Pixi's shader/bind-group references before their textures.
        app.destroy(true);
        renderer.destroy();
      }
    };
  }, [project.textures, textureDirectory, onReady]);

  useEffect(() => {
    if (!scene || sceneRef.current !== scene) return;
    let active = true;
    onReady(false);
    setError(null);
    const api = (window as unknown as { l2dApi?: L2DApi }).l2dApi;
    void Promise.all(project.textures.map(async metadata => {
      const source = api && textureProjectPath ? await api.readTexture(textureProjectPath, metadata.path) : metadata.path;
      const image = new Image();
      image.src = source;
      await image.decode();
      const texture = Texture.from(image);
      if (!active || sceneRef.current !== scene) { texture.destroy(true); return; }
      scene.renderer.registerTexture(metadata.id, texture);
    })).then(() => {
      if (active) {
        setRevision(value => value + 1);
        onReady(true);
      }
    }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, [scene, project.textures, textureProjectPath, onReady]);

  useEffect(() => {
    if (!scene || sceneRef.current !== scene || size.width === 0 || size.height === 0) return;
    scene.app.renderer.resize(size.width, size.height);
    let visibleFrame = frame;
    if (frame && soloNodeId) {
      const nodes = new Map(project.nodes.map(node => [node.id, node]));
      visibleFrame = { ...frame, meshes: frame.meshes.filter(mesh => {
        let id: string | null = mesh.id;
        const visited = new Set<string>();
        while (id && !visited.has(id)) {
          if (id === soloNodeId) return true;
          visited.add(id);
          id = nodes.get(id)?.parent_id ?? null;
        }
        return false;
      }) };
    }
    scene.renderer.updateFrame(visibleFrame ?? { meshes: [], total_vertices: 0, total_indices: 0 });
    const container = scene.view;
    container.scale.set(flipped ? -zoom : zoom, zoom);
    container.position.set(size.width / 2 + pan.x, size.height / 2 + pan.y);
    container.pivot.set(project.canvas.width / 2, project.canvas.height / 2);
    scene.app.render();
    onRendered(frame);
  }, [scene, frame, project.nodes, project.canvas.width, project.canvas.height, soloNodeId, size, pan.x, pan.y, zoom, flipped, revision, onRendered]);

  return <div ref={hostRef} className="absolute inset-0 pointer-events-none" aria-label="Model artwork">
    {error && <div className="absolute bottom-2 left-2 text-xs text-red-400">Texture preview: {error}</div>}
  </div>;
}
