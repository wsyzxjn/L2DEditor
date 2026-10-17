import React, { useState, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
} from 'dockview-react';
import {
  evaluateAnimationAtFrameJs,
  evaluateProjectJs,
  lintProjectJs,
  PhysicsSimulatorJs,
  type EvaluatedFrameJs,
  type Project,
} from '@l2d/schema';
import { CommandBus, registerStandardCommands, type Command } from '@l2d/command';
import { EditorContext } from './context/EditorContext.js';
import { HierarchyPanel } from './components/HierarchyPanel.js';
import { ParametersPanel } from './components/ParametersPanel.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { ViewportPanel } from './components/ViewportPanel.js';
import { TimelinePanel } from './components/TimelinePanel.js';
import { PhysicsPanel } from './components/PhysicsPanel.js';
import { HistoryPanel } from './components/HistoryPanel.js';
import { AtlasModal } from './components/AtlasModal.js';
import { AgentSetupModal } from './components/AgentSetupModal.js';
import { CommandPalette } from './components/CommandPalette.js';
import { StatusBar, type StatusMessage } from './components/StatusBar.js';
import { OverflowMenu, OverflowMenuItem } from './components/OverflowMenu.js';
import { AgentActivityCard, type AgentActivity } from './components/AgentActivityCard.js';
import { useI18n } from './i18n/index.js';
import type { L2DApi } from '../electron/preload.js';
import type { EditorViewportControls } from '@l2d/mcp-server/editor-protocol';
import { EditorAutomation } from './components/EditorAutomation.js';
import {
  FilePlus,
  FolderOpen,
  Save,
  FileUp,
  Undo2,
  Redo2,
  Command as CommandIcon,
  Layers,
  PanelsTopLeft,
  RotateCcw,
  FolderTree,
  Monitor,
  SlidersHorizontal,
  Activity,
  History,
  Info,
  Film,
  Bot,
  type LucideIcon,
} from 'lucide-react';

const defaultInitialProject: Project = {
  format_version: 1,
  canvas: {
    width: 1920,
    height: 1080,
    origin_x: 0.5,
    origin_y: 0.5,
    background_color: '#18181b',
  },
  parameters: [
    { id: 'ParamAngleX', name: 'Angle X', min: -30, max: 30, default: 0 },
    { id: 'ParamAngleY', name: 'Angle Y', min: -30, max: 30, default: 0 },
    { id: 'ParamEyeLOpen', name: 'Eye Left Open', min: 0, max: 1, default: 1 },
    { id: 'ParamEyeROpen', name: 'Eye Right Open', min: 0, max: 1, default: 1 },
    { id: 'ParamHairFront', name: 'Hair Front Sway', min: -1, max: 1, default: 0 },
  ],
  nodes: [],
  keyforms: [],
  textures: [],
  glues: [],
  physics: [],
  animations: [],
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const LAYOUT_STORAGE_KEY = 'l2d_layout_v1';

const panelTitleKeys = {
  hierarchy_panel: 'hierarchy.title',
  viewport_panel: 'viewport.title',
  parameters_panel: 'parameters.title',
  physics_panel: 'physics.title',
  history_panel: 'history.title',
  inspector_panel: 'inspector.title',
  timeline_panel: 'timeline.title',
};

type PanelId = keyof typeof panelTitleKeys;
type PanelDirection = 'left' | 'right' | 'above' | 'below' | 'within';

const panelComponentNames: Record<PanelId, keyof typeof dockviewComponents> = {
  hierarchy_panel: 'hierarchy',
  viewport_panel: 'viewport',
  parameters_panel: 'parameters',
  physics_panel: 'physics',
  history_panel: 'history',
  inspector_panel: 'inspector',
  timeline_panel: 'timeline',
};

const panelIcons: Record<PanelId, LucideIcon> = {
  hierarchy_panel: FolderTree,
  viewport_panel: Monitor,
  parameters_panel: SlidersHorizontal,
  physics_panel: Activity,
  history_panel: History,
  inspector_panel: Info,
  timeline_panel: Film,
};

// Where a reopened panel goes: beside the first reference panel that is still open.
const panelPlacement: Record<PanelId, [PanelId, PanelDirection][]> = {
  hierarchy_panel: [['viewport_panel', 'left'], ['timeline_panel', 'left']],
  viewport_panel: [['hierarchy_panel', 'right'], ['parameters_panel', 'left'], ['timeline_panel', 'above']],
  parameters_panel: [['physics_panel', 'within'], ['history_panel', 'within'], ['inspector_panel', 'above'], ['viewport_panel', 'right']],
  physics_panel: [['parameters_panel', 'within'], ['history_panel', 'within'], ['inspector_panel', 'above'], ['viewport_panel', 'right']],
  history_panel: [['parameters_panel', 'within'], ['physics_panel', 'within'], ['inspector_panel', 'above'], ['viewport_panel', 'right']],
  inspector_panel: [['parameters_panel', 'below'], ['physics_panel', 'below'], ['history_panel', 'below'], ['viewport_panel', 'right']],
  timeline_panel: [['viewport_panel', 'below'], ['hierarchy_panel', 'right']],
};

// Stable dockview components dictionary
const dockviewComponents = {
  hierarchy: HierarchyPanel,
  viewport: ViewportPanel,
  parameters: ParametersPanel,
  inspector: InspectorPanel,
  timeline: TimelinePanel,
  physics: PhysicsPanel,
  history: HistoryPanel,
};

export function App() {
  const { t, effectiveLanguage } = useI18n();
  const [project, setProject] = useState<Project>(defaultInitialProject);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [parameterSearchQuery, setParameterSearchQuery] = useState<string>('');
  const [isGridSnapEnabled, setIsGridSnapEnabled] = useState(false);
  const [gridSize, setGridSize] = useState(50);
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [atlasModalOpen, setAtlasModalOpen] = useState(false);
  const [agentSetupOpen, setAgentSetupOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Serialized document at the last load/save; undoing back to it counts as clean.
  const [savedProjectJson, setSavedProjectJson] = useState(() => JSON.stringify(defaultInitialProject));
  const dockviewRef = useRef<DockviewApi | null>(null);
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([]);
  const viewportControls = useRef<EditorViewportControls | null>(null);

  // Mesh editing state
  const [isMeshEditMode, setIsMeshEditMode] = useState(false);
  const [meshEditTool, setMeshEditTool] = useState<'select' | 'add' | 'delete'>('select');
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

  // Physics state
  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(false);
  const [isAutoIdleEnabled, setIsAutoIdleEnabled] = useState(false);
  const [isOnionSkinEnabled, setIsOnionSkinEnabled] = useState(false);
  const [isMotionPathEnabled, setIsMotionPathEnabled] = useState(false);

  // Animation timeline state
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(false);
  const [currentPlayheadFrame, setCurrentPlayheadFrame] = useState(0);
  const [activeAnimationId, setActiveAnimationId] = useState<string | null>(null);
  const [activeExpressionId, setActiveExpressionId] = useState<string | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const physicsSimRef = useRef<PhysicsSimulatorJs>(new PhysicsSimulatorJs());

  const notify = (text: string, type: StatusMessage['type'] = 'info') => {
    const message = { text, type };
    setStatusMessage(message);
    setTimeout(() => {
      setStatusMessage((curr) => (curr === message ? null : curr));
    }, type === 'error' ? 8000 : 4000);
  };

  const recordAgentActivity = (activity: AgentActivity) => {
    setAgentActivities((previous) => {
      const index = previous.findIndex((item) => item.id === activity.id);
      if (index < 0) return [...previous, activity].slice(-8);
      const next = [...previous];
      next[index] = activity;
      return next;
    });
  };

  const reconcileSelection = (nextProject: Project) => {
    const existing = new Set(nextProject.nodes.map((node) => node.id));
    setSelectedNodeIds((previous) => previous.filter((id) => existing.has(id)));
    setSelectedNodeId((previous) => (previous && existing.has(previous) ? previous : null));
  };

  // Command Bus instance
  const bus = useMemo(() => {
    const b = new CommandBus(project);
    registerStandardCommands(b);
    return b;
  }, []);

  // Evaluated frame representation
  const [frame, setFrame] = useState<EvaluatedFrameJs | null>(null);
  const [evaluatedInputs, setEvaluatedInputs] = useState<{ project: Project; parameters: Record<string, number> } | null>(null);
  const frameReady = evaluatedInputs?.project === project && evaluatedInputs.parameters === parameterValues;
  const projectJson = useMemo(() => JSON.stringify(project), [project]);

  // Update evaluator when project, parameters, or active animation frame change
  useEffect(() => {
    const api = (window as unknown as { l2dApi?: L2DApi }).l2dApi;
    const hasFormTracks = project.animations?.some(animation => animation.form_tracks?.length);
    if (api?.evaluateFrame && !hasFormTracks) {
      let active = true;
      void api.evaluateFrame(projectJson, parameterValues).then(evaluated => {
        if (active) {
          setFrame(evaluated);
          setEvaluatedInputs({ project, parameters: parameterValues });
        }
      }).catch(error => {
        if (active) setStatusMessage({ text: `Model evaluation: ${String(error)}`, type: 'error' });
      });
      return () => { active = false; };
    }
    const evaluated = evaluateProjectJs(project, parameterValues, {
      currentFrame: currentPlayheadFrame,
      activeAnimationId,
    });
    setFrame(evaluated);
    setEvaluatedInputs({ project, parameters: parameterValues });
  }, [project, projectJson, parameterValues, currentPlayheadFrame, activeAnimationId]);

  // Live Animation Playback Loop
  useEffect(() => {
    if (!isPlayingAnimation) return;

    let lastTime = performance.now();
    let animHandle: number;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const activeAnim = project.animations?.find((a) => a.id === activeAnimationId) || project.animations?.[0];
      const fps = activeAnim?.fps || 30;
      const duration = activeAnim?.duration_frames || 60;

      setCurrentPlayheadFrame((prev) => {
        let next = prev + dt * fps;
        if (next >= duration) {
          next = activeAnim?.loop_playback !== false ? next % duration : duration;
        }
        if (activeAnim) {
          const evaluatedParams = evaluateAnimationAtFrameJs(activeAnim, next);
          setParameterValues((params) => ({
            ...params,
            ...evaluatedParams,
          }));
        }
        return next;
      });

      animHandle = requestAnimationFrame(tick);
    };

    animHandle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animHandle);
  }, [isPlayingAnimation, project.animations, activeAnimationId]);

  // Live Pendulum Physics Simulation Loop
  useEffect(() => {
    if (!isPhysicsEnabled) {
      physicsSimRef.current.reset();
      return;
    }
    let lastTime = performance.now();
    let animHandle: number;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setParameterValues((prev) => {
        const physOut = physicsSimRef.current.update(project, prev, dt);
        if (Object.keys(physOut).length === 0) return prev;
        return { ...prev, ...physOut };
      });

      animHandle = requestAnimationFrame(tick);
    };

    animHandle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animHandle);
  }, [isPhysicsEnabled, project]);

  // Auto Idle / Natural Breathing Loop
  useEffect(() => {
    if (!isAutoIdleEnabled) return;
    let animHandle: number;
    const start = performance.now();

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const angleX = Math.sin(t * 0.7) * 8.0 + Math.sin(t * 0.25) * 3.0;
      const angleY = Math.cos(t * 0.5) * 5.0;
      const breath = Math.sin(t * 1.5) * 0.5 + 0.5;
      const blinkCycle = t % 3.5;
      const eyeOpen = blinkCycle > 3.35 ? 0.0 : 1.0;

      setParameterValues((prev) => ({
        ...prev,
        ParamAngleX: angleX,
        ParamAngleY: angleY,
        ParamBreath: breath,
        ParamEyeLOpen: eyeOpen,
        ParamEyeROpen: eyeOpen,
      }));

      animHandle = requestAnimationFrame(tick);
    };

    animHandle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animHandle);
  }, [isAutoIdleEnabled]);

  const executeCommand = (cmd: Command<object>) => {
    const res = bus.execute({ ...cmd, params: { ...cmd.params } });
    if (res.success) {
      const next = bus.getProject();
      setProject({ ...next });
      reconcileSelection(next);
    } else {
      console.error('Command failed:', res.error);
      notify(t('notify.command_failed', { error: res.error ?? '' }), 'error');
    }
    return res;
  };

  const loadProject = (loaded: Project, filePath: string | null) => {
    bus.setProject(loaded);
    setSavedProjectJson(JSON.stringify(loaded));
    setProject(loaded);
    setCurrentFilePath(filePath);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setParameterValues({});
    setIsPlayingAnimation(false);
    setCurrentPlayheadFrame(0);
    setActiveAnimationId(loaded.animations?.[0]?.id ?? null);
    setActiveExpressionId(null);
    setIsPhysicsEnabled(false);
    setIsAutoIdleEnabled(false);
  };
  const applyExpression = (id: string | null) => {
    if (id !== null && !project.expressions?.some(expression => expression.id === id)) throw new Error(`Unknown expression '${id}'`);
    setParameterValues(previous => ({
      ...previous,
      ...Object.fromEntries((project.expressions ?? []).map(expression => [`__expression_weight:${expression.id}`, expression.id === id ? 1 : 0])),
    }));
    setActiveExpressionId(id);
  };
  const seekAnimationFrame = (targetFrame: number, animationId = activeAnimationId ?? undefined) => {
    const animation = project.animations?.find(item => item.id === animationId) ?? project.animations?.[0];
    setCurrentPlayheadFrame(targetFrame);
    if (animation) setParameterValues(previous => ({ ...previous, ...evaluateAnimationAtFrameJs(animation, targetFrame) }));
  };
  const saveProjectTo = async (target = currentFilePath ?? undefined) => {
    const api = (window as unknown as { l2dApi?: L2DApi }).l2dApi;
    if (!target) throw new Error('No file path. Pass an explicit path to save a new document.');
    if (!api) throw new Error('Desktop file API unavailable');
    const snapshot = bus.getProject();
    const result = await api.saveProject(target, JSON.stringify(snapshot, null, 2), currentFilePath ?? undefined);
    const rewritten = acceptSavedProject(result, snapshot);
    notify(`${t('notify.saved')}: ${target}${rewritten ? ` (${t('notify.resource_paths_reset')})` : ''}`, 'success');
    return target;
  };

  const acceptSavedProject = (result: { success: boolean; path?: string; content?: string; error?: string }, snapshot: Project) => {
    if (!result.success || !result.path || !result.content) throw new Error(result.error || 'Failed to save project');
    if (bus.getProject() !== snapshot) throw new Error('A copy was saved, but the document changed during saving. The active document has not been replaced.');
    const saved: Project = JSON.parse(result.content);
    // Most saves retain paths and history. Rewritten external/conflicting paths
    // establish a new resource base; old undo patches cannot safely target it.
    const rewritten = saved.textures.some((texture, i) => texture.path !== snapshot.textures[i]?.path);
    if (rewritten) {
      bus.setProject(saved);
      setProject(saved);
    }
    setSavedProjectJson(JSON.stringify(rewritten ? saved : snapshot));
    flushSync(() => setCurrentFilePath(result.path!));
    return rewritten;
  };

  const handleNew = () => {
    loadProject(defaultInitialProject, null);
    notify(t('notify.new_project'), 'info');
  };

  const handleUndo = () => {
    const history = bus.getHistory();
    const undoneId = history.currentIndex >= 0 ? history.entries[history.currentIndex]?.id : undefined;
    const success = bus.undo();
    if (success) {
      const next = bus.getProject();
      setProject({ ...next });
      reconcileSelection(next);
      if (undoneId) {
        setAgentActivities((previous) => previous.map((activity) =>
          activity.commandId === undoneId ? { ...activity, status: 'undone', undoable: false } : activity));
      }
      notify(t('notify.undo'), 'info');
    }
    return success;
  };

  const handleRedo = () => {
    const success = bus.redo();
    if (success) {
      const next = bus.getProject();
      setProject({ ...next });
      reconcileSelection(next);
      const history = bus.getHistory();
      const redoneId = history.currentIndex >= 0 ? history.entries[history.currentIndex]?.id : undefined;
      if (redoneId) {
        setAgentActivities((previous) => previous.map((activity) =>
          activity.commandId === redoneId ? { ...activity, status: 'success', undoable: true } : activity));
      }
      notify(t('notify.redo'), 'info');
    }
    return success;
  };

  const jumpToHistory = (targetIndex: number) => {
    if (bus.jumpToHistory(targetIndex)) {
      const next = bus.getProject();
      setProject({ ...next });
      reconcileSelection(next);
      const history = bus.getHistory();
      const statuses = new Map<string, AgentActivity['status']>(history.entries.map((entry, index) => [
        entry.id,
        index <= history.currentIndex ? 'success' : 'undone',
      ]));
      setAgentActivities((previous) => previous.map((activity) =>
        activity.commandId && statuses.has(activity.commandId)
          ? { ...activity, status: statuses.get(activity.commandId)!, undoable: statuses.get(activity.commandId) === 'success' }
          : activity));
    }
  };
  const handleSave = async () => {
    const json = JSON.stringify(project, null, 2);
    if ((window as any).l2dApi) {
      if (!currentFilePath) {
        await handleSaveAs();
        return;
      }
      try { await saveProjectTo(currentFilePath); }
      catch (error: any) { notify(error.message, 'error'); }
    } else {
      downloadFile(json, 'project.json', 'application/json');
      setSavedProjectJson(projectJson);
      notify(t('notify.saved'), 'success');
    }
  };

  const handleSaveAs = async () => {
    const snapshot = bus.getProject();
    const json = JSON.stringify(snapshot, null, 2);
    if ((window as any).l2dApi) {
      try {
        const res = await (window as unknown as { l2dApi: L2DApi }).l2dApi.saveProjectAsDialog(json, 'project.json', currentFilePath ?? undefined);
        if (res) {
          const rewritten = acceptSavedProject(res, snapshot);
          notify(`${t('notify.saved')}: ${res.path}${rewritten ? ` (${t('notify.resource_paths_reset')})` : ''}`, 'success');
        }
      } catch (error: any) { notify(error.message, 'error'); }
    } else {
      downloadFile(json, 'project.json', 'application/json');
      setSavedProjectJson(JSON.stringify(snapshot));
      notify(t('notify.saved'), 'success');
    }
  };

  const handleOpen = async () => {
    if ((window as any).l2dApi) {
      const res = await (window as any).l2dApi.openProjectDialog();
      if (res) {
        try {
          const parsed: Project = JSON.parse(res.content);
          loadProject(parsed, res.path);
          notify(`${t('notify.opened')}: ${res.path}`, 'success');
        } catch (e: any) {
          notify(t('notify.parse_failed', { error: e?.message || e }), 'error');
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleImportPsd = async () => {
    if ((window as any).l2dApi) {
      const res = await (window as any).l2dApi.importPsdDialog();
      if (res) {
        try {
          const parsed: Project = JSON.parse(res.projectContent);
          loadProject(parsed, res.outputPath);
          notify(`${t('notify.psd_imported')} (${parsed.nodes.length})`, 'success');
        } catch (e: any) {
          notify(t('notify.psd_import_failed', { error: e?.message || e }), 'error');
        }
      }
    } else {
      notify(t('notify.desktop_only'), 'info');
    }
  };

  const isDirty = projectJson !== savedProjectJson;
  const appliedHistory = bus.getHistory();
  const undoableCommandId = appliedHistory.currentIndex >= 0
    ? appliedHistory.entries[appliedHistory.currentIndex]?.id ?? null
    : null;

  // Messages are translated when raised; drop the current one when the language changes.
  useEffect(() => setStatusMessage(null), [effectiveLanguage]);

  // Dockview stores panel titles as plain strings, so refresh them with the language.
  useEffect(() => {
    for (const [panelId, titleKey] of Object.entries(panelTitleKeys)) {
      dockviewRef.current?.getPanel(panelId)?.api.setTitle(t(titleKey));
    }
  }, [effectiveLanguage]);
  useEffect(() => {
    const name = currentFilePath?.split(/[\\/]/).pop() ?? t('status.untitled');
    document.title = `${isDirty ? '● ' : ''}${name} — L2DEditor`;
  }, [currentFilePath, isDirty, t]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpen();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNew();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.metaKey || e.ctrlKey) &&
        ((e.shiftKey && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        setIsPlayingAnimation((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, currentFilePath]);

  const buildDefaultLayout = (api: DockviewApi) => {
    const left = api.addPanel({
      id: 'hierarchy_panel',
      component: 'hierarchy',
      title: t('hierarchy.title'),
      initialWidth: 260,
    });

    const center = api.addPanel({
      id: 'viewport_panel',
      component: 'viewport',
      title: t('viewport.title'),
      position: { referencePanel: left, direction: 'right' },
    });

    const rightTop = api.addPanel({
      id: 'parameters_panel',
      component: 'parameters',
      title: t('parameters.title'),
      position: { referencePanel: center, direction: 'right' },
      initialWidth: 320,
    });

    // Add Physics panel tabbed next to parameters
    api.addPanel({
      id: 'physics_panel',
      component: 'physics',
      title: t('physics.title'),
      position: { referencePanel: rightTop, direction: 'within' },
    });

    // Add History (Undo Tree) panel tabbed next to parameters/physics
    api.addPanel({
      id: 'history_panel',
      component: 'history',
      title: t('history.title'),
      position: { referencePanel: rightTop, direction: 'within' },
    });
    api.addPanel({
      id: 'inspector_panel',
      component: 'inspector',
      title: t('inspector.title'),
      position: { referencePanel: rightTop, direction: 'below' },
    });

    // Add Timeline at bottom
    const timeline = api.addPanel({
      id: 'timeline_panel',
      component: 'timeline',
      title: t('timeline.title'),
      position: { referencePanel: center, direction: 'below' },
      initialHeight: 220,
    });
    left.api.setSize({ width: 260 });
    rightTop.api.setSize({ width: 320 });
    timeline.api.setSize({ height: 220 });
    rightTop.api.setActive();
  };

  const refreshPanelState = (api: DockviewApi) => setOpenPanelIds(api.panels.map((panel) => panel.id));

  const onReady = (event: DockviewReadyEvent) => {
    const api = event.api;
    dockviewRef.current = api;
    let restored = false;
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (savedLayout) {
      try {
        api.fromJSON(JSON.parse(savedLayout));
        restored = api.panels.length > 0;
      } catch {
        localStorage.removeItem(LAYOUT_STORAGE_KEY);
      }
    }
    if (!restored) {
      api.clear();
      buildDefaultLayout(api);
    }
    // Saved layouts carry titles in the language they were saved with.
    for (const panel of api.panels) panel.api.setTitle(t(panelTitleKeys[panel.id as PanelId]));
    refreshPanelState(api);
    api.onDidLayoutChange(() => {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(api.toJSON()));
      refreshPanelState(api);
    });
  };

  const openPanel = (id: PanelId) => {
    const api = dockviewRef.current;
    if (!api) return;
    const existing = api.getPanel(id);
    if (existing) {
      existing.api.setActive();
      return;
    }
    const anchor = panelPlacement[id].find(([reference]) => api.getPanel(reference));
    api.addPanel({
      id,
      component: panelComponentNames[id],
      title: t(panelTitleKeys[id]),
      ...(anchor ? { position: { referencePanel: anchor[0], direction: anchor[1] } } : {}),
    });
  };

  const togglePanel = (id: PanelId) => {
    const panel = dockviewRef.current?.getPanel(id);
    if (panel) dockviewRef.current!.removePanel(panel);
    else openPanel(id);
  };

  const resetLayout = () => {
    const api = dockviewRef.current;
    if (!api) return;
    api.clear();
    buildDefaultLayout(api);
    notify(t('window.layout_reset'), 'info');
  };

  const toggleSelectNodeId = (id: string, multi: boolean = false) => {
    if (!multi) {
      setSelectedNodeId(id);
      setSelectedNodeIds([id]);
    } else {
      setSelectedNodeIds((prev) => {
        const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
        setSelectedNodeId(next[next.length - 1] || null);
        return next;
      });
    }
  };

  const contextValue = {
    project,
    bus,
    frame,
    frameReady,
    activeExpressionId,
    applyExpression,
    selectedNodeId,
    selectedNodeIds,
    parameterValues,
    currentFilePath,
    setSelectedNodeId: (id: string | null) => {
      setSelectedNodeId(id);
      setSelectedNodeIds(id ? [id] : []);
    },
    setSelectedNodeIds,
    toggleSelectNodeId,
    setParameterValue: (id: string, val: number) =>
      setParameterValues((prev) => ({ ...prev, [id]: val })),
    parameterSearchQuery,
    setParameterSearchQuery,
    isGridSnapEnabled,
    setIsGridSnapEnabled,
    gridSize,
    setGridSize,
    executeCommand,
    loadProject,
    saveProjectTo,
    openProject: handleOpen,
    importPsd: handleImportPsd,
    undo: handleUndo,
    redo: handleRedo,
    viewportControls,
    showPanel: (panel: string) => {
      const id = `${panel}_panel`;
      if (!(id in panelTitleKeys)) throw new Error(`Unknown panel '${panel}'`);
      openPanel(id as PanelId);
    },
    jumpToHistory,
    notify,
    // Mesh editing mode
    isMeshEditMode,
    setIsMeshEditMode,
    meshEditTool,
    setMeshEditTool,
    selectedVertexIndex,
    setSelectedVertexIndex,
    // Physics
    isPhysicsEnabled,
    setIsPhysicsEnabled,
    // Auto Idle
    isAutoIdleEnabled,
    setIsAutoIdleEnabled,
    // Onion Skin & Motion Path
    isOnionSkinEnabled,
    setIsOnionSkinEnabled,
    isMotionPathEnabled,
    setIsMotionPathEnabled,
    // Animation
    isPlayingAnimation,
    setIsPlayingAnimation,
    currentPlayheadFrame,
    setCurrentPlayheadFrame: seekAnimationFrame,
    seekAnimationFrame,
    activeAnimationId,
    setActiveAnimationId,
    waveformPeaks,
    setWaveformPeaks,
  };

  return (
    <EditorContext.Provider value={contextValue}>
      <EditorAutomation onActivity={recordAgentActivity} />
      <div className="flex flex-col w-screen h-screen overflow-hidden bg-dcc-bg text-dcc-text">
        {/* Top Menu / App Toolbar */}
        <header
          className={`editor-toolbar flex shrink-0 items-center justify-between h-9 gap-3 ${isMac ? 'pl-[78px]' : 'pl-3'} pr-3 bg-dcc-header border-b border-dcc-border select-none app-drag-region`}
        >
          <div className="flex min-w-0 items-center gap-3 app-no-drag">
            <span className="font-bold tracking-tight text-white flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>L2DEditor</span>
            </span>

            <div className="h-4 w-px bg-dcc-border" />

            <div className="editor-file-actions flex items-center space-x-1">
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-dcc-control transition-colors"
                onClick={handleNew}
                title={`${t('toolbar.new')} (${isMac ? '⌘' : 'Ctrl+'}N)`}
                aria-label={t('toolbar.new')}
              >
                <FilePlus className="w-3.5 h-3.5 mr-1" /> <span className="toolbar-label">{t('toolbar.new')}</span>
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-dcc-control transition-colors"
                onClick={handleOpen}
                title={`${t('toolbar.open')} (${isMac ? '⌘' : 'Ctrl+'}O)`}
                aria-label={t('toolbar.open')}
              >
                <FolderOpen className="w-3.5 h-3.5 mr-1" /> <span className="toolbar-label">{t('toolbar.open')}</span>
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-dcc-control transition-colors"
                onClick={handleSave}
                title={`${t('toolbar.save')} (${isMac ? '⌘' : 'Ctrl+'}S)`}
                aria-label={t('toolbar.save')}
              >
                <Save className="w-3.5 h-3.5 mr-1" /> <span className="toolbar-label">{t('toolbar.save')}</span>
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-dcc-control transition-colors"
                onClick={handleImportPsd}
                title={t('toolbar.import_psd')}
                aria-label={t('toolbar.import_psd')}
              >
                <FileUp className="w-3.5 h-3.5 mr-1" /> <span className="toolbar-label">{t('toolbar.import_psd')}</span>
              </button>
            <button
              className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-dcc-control transition-colors"
              onClick={() => setAtlasModalOpen(true)}
              title={t('toolbar.atlas')}
              aria-label={t('toolbar.atlas')}
            >
              <Layers className="w-3.5 h-3.5 mr-1 text-dcc-muted" /> <span className="toolbar-label">{t('toolbar.atlas')}</span>
            </button>
            </div>

            <div className="h-4 w-px bg-dcc-border" />

            <div className="flex items-center space-x-1">
              <button
                className="p-1 hover:bg-dcc-hover rounded text-dcc-muted hover:text-white transition-colors"
                onClick={handleUndo}
                title={`${t('toolbar.undo')} (${isMac ? '⌘Z' : 'Ctrl+Z'})`}
                aria-label={t('toolbar.undo')}
                disabled={!bus.canUndo()}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1 hover:bg-dcc-hover rounded text-dcc-muted hover:text-white transition-colors"
                onClick={handleRedo}
                title={`${t('toolbar.redo')} (${isMac ? '⌘⇧Z' : 'Ctrl+Y'})`}
                aria-label={t('toolbar.redo')}
                disabled={!bus.canRedo()}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Info & Palette */}
          <div className="editor-toolbar-info flex shrink-0 items-center gap-1.5 app-no-drag">
            <button
              className="btn"
              title={t('toolbar.agent_setup')}
              aria-label={t('toolbar.agent_setup')}
              onClick={() => setAgentSetupOpen(true)}
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span className="toolbar-label">{t('toolbar.agent_setup')}</span>
            </button>
            <OverflowMenu label={t('window.panels')} icon={PanelsTopLeft}>
              {(Object.keys(panelTitleKeys) as PanelId[]).map((id) => (
                <OverflowMenuItem
                  key={id}
                  icon={panelIcons[id]}
                  label={t(panelTitleKeys[id])}
                  checked={openPanelIds.includes(id)}
                  onSelect={() => togglePanel(id)}
                />
              ))}
              <div className="my-1 h-px bg-dcc-border" role="separator" />
              <OverflowMenuItem icon={RotateCcw} label={t('window.reset_layout')} onSelect={resetLayout} />
            </OverflowMenu>
            <button
              className="btn"
              title={t('toolbar.commands')}
              aria-label={t('toolbar.commands')}
              onClick={() => setCommandPaletteOpen(true)}
            >
              <CommandIcon className="w-3 h-3 text-dcc-muted" />
              <span className="toolbar-label">{t('toolbar.commands')}</span>
              <kbd className="px-1 rounded bg-dcc-bg text-dcc-subtle text-dcc-xs font-mono">{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
            </button>
          </div>
        </header>

        {/* Main Dockview Area */}
        <main className="flex-1 min-h-0 w-full relative overflow-hidden">
          <DockviewReact
            className="dockview-theme-dcc w-full h-full"
            onReady={onReady}
            components={dockviewComponents}
          />
        </main>

        <AgentActivityCard
          activities={agentActivities}
          undoableCommandId={undoableCommandId}
          onUndo={() => { handleUndo(); }}
          onDismiss={() => setAgentActivities([])}
        />

        <StatusBar
          filePath={currentFilePath}
          dirty={isDirty}
          message={statusMessage}
          nodeCount={project.nodes.length}
          selectedCount={selectedNodeIds.length}
        />

        {/* Command Palette Modal */}
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          onAction={(action) => {
            if (action === 'new') handleNew();
            else if (action === 'save') handleSave();
            else if (action === 'save_as') handleSaveAs();
            else if (action === 'open') handleOpen();
            else if (action === 'import_psd') handleImportPsd();
            else if (action === 'atlas') setAtlasModalOpen(true);
            else if (action === 'agent_setup') setAgentSetupOpen(true);
            else if (action === 'undo') handleUndo();
            else if (action === 'redo') handleRedo();
            else if (action === 'reset_layout') resetLayout();
            else if (action === 'lint') {
              const diags = lintProjectJs(project);
              if (diags.length === 0) {
                notify(t('notify.lint_clean'), 'success');
              } else {
                notify(t('notify.lint_issues', { count: diags.length, code: diags[0].code }), 'error');
              }
            } else if (action === 'cleanup_empty') {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'project.cleanup_empty',
                params: {},
              });
              notify(t('notify.cleaned_empty'), 'success');
            } else if (action === 'synthesize_corners') {
              if (selectedNodeId) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.synthesize_corners',
                  params: { target_node_id: selectedNodeId },
                });
                notify(t('notify.synthesized_corners'), 'success');
              } else {
                notify(t('notify.need_keyform_node'), 'error');
              }
            } else if (action === 'ai_full_body_deformers') {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'macro.ai_full_body_deformers',
                params: {},
              });
              notify(t('notify.full_body_deformers'), 'success');
            } else if (action === 'macro_turn_xy') {
              if (selectedNodeId) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'macro.setup_turn_xy',
                  params: { target_node_id: selectedNodeId },
                });
                notify(t('notify.setup_turn_xy'), 'success');
              } else {
                notify(t('notify.need_warp'), 'error');
              }
            }
          }}
        />

        {/* Texture Atlas Layout Modal */}
        <AtlasModal open={atlasModalOpen} onOpenChange={setAtlasModalOpen} />
        <AgentSetupModal open={agentSetupOpen} onOpenChange={setAgentSetupOpen} />

        {/* Hidden Web Fallback File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,.l2dproj"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              const text = await file.text();
              try {
                const parsed = JSON.parse(text);
                loadProject(parsed, file.name);
                notify(t('notify.opened_file', { name: file.name }), 'success');
              } catch (err: any) {
                notify(t('notify.parse_failed', { error: err?.message || err }), 'error');
              }
            }
          }}
        />
      </div>
    </EditorContext.Provider>
  );
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
