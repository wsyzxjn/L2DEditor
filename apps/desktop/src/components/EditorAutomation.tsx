import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { RendererEditorRequest } from '@l2d/mcp-server/editor-protocol';
import type { L2DApi } from '../../electron/preload.js';
import { useEditor } from '../context/EditorContext.js';

/** GUI and MCP share the same context actions, document and Command Bus. */
export function EditorAutomation() {
  const editor = useEditor();
  const current = useRef(editor);
  current.current = editor;

  useEffect(() => {
    const api = (window as unknown as { l2dApi?: L2DApi }).l2dApi;
    if (!api?.onEditorRequest) return;
    const inspect = (offset = 0, limit = 50): Record<string, unknown> => {
      const e = current.current;
      const history = e.bus.getHistory();
      return {
        filePath: e.currentFilePath,
        canvas: e.project.canvas,
        nodeCount: e.project.nodes.length,
        nodes: e.project.nodes.slice(offset, offset + limit).map(node => ({ id: node.id, name: node.name, parentId: node.parent_id, type: node.kind.type })),
        nodeOffset: offset, nextNodeOffset: offset + limit < e.project.nodes.length ? offset + limit : null,
        parameters: e.project.parameters.map(parameter => ({ ...parameter, value: e.parameterValues[parameter.id] ?? parameter.default })),
        selectedNodeIds: e.selectedNodeIds,
        viewport: e.viewportControls.current?.getState() ?? null,
        renderReady: e.frameReady && e.viewportControls.current?.hasRenderedFrame(e.frame) === true,
        textureCount: e.project.textures.length,
        activeExpressionId: e.activeExpressionId,
        expressions: e.project.expressions ?? [],
        display: { meshEdit: e.isMeshEditMode, physics: e.isPhysicsEnabled, autoIdle: e.isAutoIdleEnabled, gridSnap: e.isGridSnapEnabled },
        timeline: { animationId: e.activeAnimationId, playing: e.isPlayingAnimation, frame: e.currentPlayheadFrame, animations: (e.project.animations ?? []).map(animation => ({ id: animation.id, name: animation.name, fps: animation.fps, durationFrames: animation.duration_frames })) },
        history: { currentIndex: history.currentIndex, count: history.entries.length, canUndo: e.bus.canUndo(), canRedo: e.bus.canRedo(), recentEntries: history.entries.slice(-20) },
      };
    };
    const apply = (request: RendererEditorRequest): Record<string, unknown> => {
      const e = current.current;
      switch (request.action) {
        case 'state': return inspect(request.nodeOffset, request.nodeLimit);
        case 'load_project': e.loadProject(request.project, request.path); break;
        case 'select': {
          const ids = [...new Set(request.nodeIds)];
          if (ids.some(id => !e.project.nodes.some(node => node.id === id))) throw new Error('Selection contains an unknown node ID');
          e.setSelectedNodeId(ids[0] ?? null);
          e.setSelectedNodeIds(ids);
          break;
        }
        case 'set_parameters': {
          // Validate the whole batch before updating any React state.
          for (const [id, value] of Object.entries(request.values)) {
            const parameter = e.project.parameters.find(p => p.id === id);
            if (!parameter) throw new Error(`Unknown parameter '${id}'`);
            if (parameter.locked) throw new Error(`Parameter '${id}' is locked`);
            if (!Number.isFinite(value) || value < parameter.min || value > parameter.max) throw new Error(`${id} must be in [${parameter.min}, ${parameter.max}]`);
          }
          for (const [id, value] of Object.entries(request.values)) e.setParameterValue(id, value);
          break;
        }
        case 'viewport': {
          if (!e.viewportControls.current) throw new Error('Open the viewport panel first');
          e.viewportControls.current.update(request);
          if (request.meshEdit !== undefined) e.setIsMeshEditMode(request.meshEdit);
          if (request.physics !== undefined) e.setIsPhysicsEnabled(request.physics);
          if (request.autoIdle !== undefined) e.setIsAutoIdleEnabled(request.autoIdle);
          if (request.gridSnap !== undefined) e.setIsGridSnapEnabled(request.gridSnap);
          break;
        }
        case 'playback': {
          const id = request.animationId ?? e.activeAnimationId ?? e.project.animations?.[0]?.id;
          const animation = e.project.animations?.find(item => item.id === id);
          if (!animation) throw new Error(`No animation '${id ?? ''}' in this project`);
          if (request.frame !== undefined && request.frame > animation.duration_frames) throw new Error(`Frame must be <= ${animation.duration_frames}`);
          e.setActiveAnimationId(animation.id);
          if (request.frame !== undefined) {
            e.seekAnimationFrame(request.frame, animation.id);
          }
          if (request.playing !== undefined) e.setIsPlayingAnimation(request.playing);
          break;
        }
        case 'show_panel': e.showPanel(request.panel); break;
        case 'expression': e.applyExpression(request.expressionId); break;
        case 'exec': {
          const result = request.dryRun ? e.bus.dryRun(request.command) : e.executeCommand(request.command);
          if (!result.success) throw new Error(result.error ?? 'Command failed');
          return { commandResult: result };
        }
        case 'history': {
          if (request.operation === 'undo' && !e.undo()) throw new Error('No edit to undo');
          if (request.operation === 'redo' && !e.redo()) throw new Error('No edit to redo');
          if (request.operation === 'jump') {
            const history = e.bus.getHistory();
            if (request.index === undefined || request.index < -1 || request.index >= history.entries.length || e.bus.isTransactionActive()) throw new Error('Invalid history index');
            e.jumpToHistory(request.index);
          }
          break;
        }
        case 'save':
        case 'wait_for_preview':
        case 'capture_model': break; // Async operations below.
      }
      return {};
    };
    return api.onEditorRequest(message => {
      void (async () => {
        try {
          let extra: Record<string, unknown> = {};
          if (message.request.action === 'wait_for_preview' || message.request.action === 'capture_model') {
            const deadline = performance.now() + 8000;
            while (true) {
              const e = current.current, controls = e.viewportControls.current, viewport = controls?.getState();
              const live = e.isPlayingAnimation || e.isPhysicsEnabled || e.isAutoIdleEnabled;
              // The controls effect can lag one commit behind the editor state.
              if (viewport?.texturesReady && controls?.hasRenderedFrame(e.frame) && (e.frameReady || live)) break;
              if (performance.now() > deadline) throw new Error('Preview did not finish rendering');
              await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            }
            if (message.request.action === 'capture_model') {
              const png = await current.current.viewportControls.current!.captureModel(message.request.scale);
              api.respondToEditor({ id: message.id, result: { mimeType: 'image/png', data: png.replace(/^data:image\/png;base64,/, '') } });
              return;
            }
          } else if (message.request.action === 'save') extra = { savedPath: await current.current.saveProjectTo(message.request.path) };
          else if (message.request.action === 'state') {
            api.respondToEditor({ id: message.id, result: apply(message.request) });
            return;
          } else flushSync(() => { extra = apply(message.request); });
          api.respondToEditor({ id: message.id, result: { ...inspect(), ...extra } });
        } catch (error) {
          api.respondToEditor({ id: message.id, error: error instanceof Error ? error.message : String(error) });
        }
      })();
    });
  }, []);

  useEffect(() => {
    (window as unknown as { l2dApi?: L2DApi }).l2dApi?.syncEditorState({ project: editor.project });
  }, [editor.project]);
  useEffect(() => {
    (window as unknown as { l2dApi?: L2DApi }).l2dApi?.syncEditorState({ parameters: editor.parameterValues });
  }, [editor.project, editor.parameterValues]);
  return null;
}
