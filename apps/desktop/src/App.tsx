import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
} from 'dockview-react';
import {
  evaluateAnimationAtFrameJs,
  evaluateProjectJs,
  lintProjectJs,
  PhysicsSimulatorJs,
  type EvaluatedFrameJs,
  type Project,
} from '@l2d/schema';
import { CommandBus, registerStandardCommands } from '@l2d/command';
import { EditorContext } from './context/EditorContext.js';
import { HierarchyPanel } from './components/HierarchyPanel.js';
import { ParametersPanel } from './components/ParametersPanel.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { ViewportPanel } from './components/ViewportPanel.js';
import { TimelinePanel } from './components/TimelinePanel.js';
import { PhysicsPanel } from './components/PhysicsPanel.js';
import { HistoryPanel } from './components/HistoryPanel.js';
import { AtlasModal } from './components/AtlasModal.js';
import { CommandPalette } from './components/CommandPalette.js';
import { useI18n, type LanguageSetting } from './i18n/index.js';
import {
  FilePlus,
  FolderOpen,
  Save,
  FileUp,
  Undo2,
  Redo2,
  Command as CommandIcon,
  Check,
  AlertCircle,
  Layers,
  Globe,
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
  const { t, localeSetting, effectiveLanguage, setLanguageSetting } = useI18n();
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
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const physicsSimRef = useRef<PhysicsSimulatorJs>(new PhysicsSimulatorJs());

  const notify = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage((curr) => (curr?.text === text ? null : curr));
    }, 3500);
  };

  // Command Bus instance
  const bus = useMemo(() => {
    const b = new CommandBus(project);
    registerStandardCommands(b);
    return b;
  }, []);

  // Evaluated frame representation
  const [frame, setFrame] = useState<EvaluatedFrameJs | null>(null);

  // Update evaluator when project, parameters, or active animation frame change
  useEffect(() => {
    const evaluated = evaluateProjectJs(project, parameterValues, {
      currentFrame: currentPlayheadFrame,
      activeAnimationId,
    });
    setFrame(evaluated);
  }, [project, parameterValues, currentPlayheadFrame, activeAnimationId]);

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

  const executeCommand = (cmd: any) => {
    const res = bus.execute(cmd);
    if (res.success) {
      setProject({ ...bus.getProject() });
    } else {
      console.error('Command failed:', res.error);
      notify(`Error: ${res.error}`, 'error');
    }
  };

  const handleNew = () => {
    bus.setProject(defaultInitialProject);
    setProject({ ...defaultInitialProject });
    setCurrentFilePath(null);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setParameterValues({});
    notify(t('notify.new_project'), 'info');
  };

  const handleUndo = () => {
    if (bus.undo()) {
      setProject({ ...bus.getProject() });
      notify(t('notify.undo'), 'info');
    }
  };

  const handleRedo = () => {
    if (bus.redo()) {
      setProject({ ...bus.getProject() });
      notify(t('notify.redo'), 'info');
    }
  };

  const jumpToHistory = (targetIndex: number) => {
    if (bus.jumpToHistory(targetIndex)) {
      setProject({ ...bus.getProject() });
    }
  };
  const handleSave = async () => {
    const json = JSON.stringify(project, null, 2);
    if ((window as any).l2dApi) {
      if (!currentFilePath) {
        await handleSaveAs();
        return;
      }
      const success = await (window as any).l2dApi.saveProject(currentFilePath, json);
      if (success) {
        notify(`${t('notify.saved')}: ${currentFilePath}`, 'success');
      } else {
        notify(`${t('notify.save_failed')}: ${currentFilePath}`, 'error');
      }
    } else {
      downloadFile(json, 'project.json', 'application/json');
      notify(t('notify.saved'), 'success');
    }
  };

  const handleSaveAs = async () => {
    const json = JSON.stringify(project, null, 2);
    if ((window as any).l2dApi) {
      const res = await (window as any).l2dApi.saveProjectAsDialog(json, 'project.json');
      if (res && res.success && res.path) {
        setCurrentFilePath(res.path);
        notify(`${t('notify.saved')}: ${res.path}`, 'success');
      }
    } else {
      downloadFile(json, 'project.json', 'application/json');
      notify(t('notify.saved'), 'success');
    }
  };

  const handleOpen = async () => {
    if ((window as any).l2dApi) {
      const res = await (window as any).l2dApi.openProjectDialog();
      if (res) {
        try {
          const parsed: Project = JSON.parse(res.content);
          bus.setProject(parsed);
          setProject(parsed);
          setCurrentFilePath(res.path);
          setSelectedNodeId(null);
          setSelectedNodeIds([]);
          notify(`${t('notify.opened')}: ${res.path}`, 'success');
        } catch (e: any) {
          notify(`Failed to parse project: ${e?.message || e}`, 'error');
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
          bus.setProject(parsed);
          setProject(parsed);
          setCurrentFilePath(res.outputPath);
          setSelectedNodeId(null);
          setSelectedNodeIds([]);
          notify(`${t('notify.psd_imported')} (${parsed.nodes.length})`, 'success');
        } catch (e: any) {
          notify(`Failed to import PSD: ${e?.message || e}`, 'error');
        }
      }
    } else {
      notify('PSD import dialog requires Electron runtime', 'info');
    }
  };

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

  const onReady = (event: DockviewReadyEvent) => {
    const left = event.api.addPanel({
      id: 'hierarchy_panel',
      component: 'hierarchy',
      title: t('hierarchy.title'),
      initialWidth: 260,
    });

    const center = event.api.addPanel({
      id: 'viewport_panel',
      component: 'viewport',
      title: t('viewport.title'),
      position: { referencePanel: left, direction: 'right' },
    });

    const rightTop = event.api.addPanel({
      id: 'parameters_panel',
      component: 'parameters',
      title: t('parameters.title'),
      position: { referencePanel: center, direction: 'right' },
      initialWidth: 320,
    });

    // Add Physics panel tabbed next to parameters
    event.api.addPanel({
      id: 'physics_panel',
      component: 'physics',
      title: t('physics.title'),
      position: { referencePanel: rightTop, direction: 'within' },
    });

    // Add History (Undo Tree) panel tabbed next to parameters/physics
    event.api.addPanel({
      id: 'history_panel',
      component: 'history',
      title: t('history.title'),
      position: { referencePanel: rightTop, direction: 'within' },
    });
    event.api.addPanel({
      id: 'inspector_panel',
      component: 'inspector',
      title: t('inspector.title'),
      position: { referencePanel: rightTop, direction: 'below' },
    });

    // Add Timeline at bottom
    event.api.addPanel({
      id: 'timeline_panel',
      component: 'timeline',
      title: t('timeline.title'),
      position: { referencePanel: center, direction: 'below' },
      initialHeight: 220,
    });
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
    setCurrentPlayheadFrame,
    activeAnimationId,
    setActiveAnimationId,
    waveformPeaks,
    setWaveformPeaks,
  };

  return (
    <EditorContext.Provider value={contextValue}>
      <div className="flex flex-col w-screen h-screen bg-dcc-bg text-dcc-text">
        {/* Top Menu / App Toolbar */}
        <header
          className={`flex items-center justify-between h-9 ${isMac ? 'pl-[78px]' : 'pl-3'} pr-3 bg-dcc-header border-b border-dcc-border select-none app-drag-region`}
        >
          <div className="flex items-center space-x-3 app-no-drag">
            <span className="font-bold tracking-tight text-white flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>L2DEditor</span>
            </span>

            <div className="h-4 w-px bg-dcc-border" />

            <div className="flex items-center space-x-1">
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300 transition-colors"
                onClick={handleNew}
                title="New Project (Ctrl+N)"
              >
                <FilePlus className="w-3.5 h-3.5 mr-1" /> {t('toolbar.new')}
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300 transition-colors"
                onClick={handleOpen}
                title="Open Project (Ctrl+O)"
              >
                <FolderOpen className="w-3.5 h-3.5 mr-1" /> {t('toolbar.open')}
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300 transition-colors"
                onClick={handleSave}
                title="Save Project (Ctrl+S)"
              >
                <Save className="w-3.5 h-3.5 mr-1" /> {t('toolbar.save')}
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300 transition-colors"
                onClick={handleImportPsd}
                title="Import PSD Document"
              >
                <FileUp className="w-3.5 h-3.5 mr-1" /> {t('toolbar.import_psd')}
              </button>
            <button
              className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300 transition-colors"
              onClick={() => setAtlasModalOpen(true)}
              title="Edit Texture Atlas"
            >
              <Layers className="w-3.5 h-3.5 mr-1 text-pink-400" /> {t('toolbar.atlas')}
            </button>
            </div>

            <div className="h-4 w-px bg-dcc-border" />

            <div className="flex items-center space-x-1">
              <button
                className="p-1 hover:bg-dcc-hover rounded text-zinc-400 hover:text-white transition-colors"
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1 hover:bg-dcc-hover rounded text-zinc-400 hover:text-white transition-colors"
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Info & Palette */}
          <div className="flex items-center space-x-3 app-no-drag">
            {/* Language Switcher */}
            <div className="flex items-center space-x-1 text-dcc-sm bg-zinc-800/80 px-2 py-0.5 rounded border border-dcc-border text-zinc-300">
              <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
              <select
                className="bg-transparent text-dcc-sm text-zinc-300 outline-none cursor-pointer"
                value={localeSetting}
                onChange={(e) => {
                  setLanguageSetting(e.target.value as LanguageSetting);
                  notify(t('notify.lang_changed'), 'info');
                }}
              >
                <option value="auto" className="bg-zinc-900 text-zinc-200">
                  {t('toolbar.lang_auto')} ({effectiveLanguage === 'zh-CN' ? '中文' : effectiveLanguage === 'ja' ? '日本語' : 'EN'})
                </option>
                <option value="zh-CN" className="bg-zinc-900 text-zinc-200">{t('toolbar.lang_zh')}</option>
                <option value="ja" className="bg-zinc-900 text-zinc-200">{t('toolbar.lang_ja')}</option>
                <option value="en" className="bg-zinc-900 text-zinc-200">{t('toolbar.lang_en')}</option>
              </select>
            </div>

            {statusMessage && (
              <span
                className={`flex items-center text-dcc-sm px-2 py-0.5 rounded font-medium transition-all ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <Check className="w-3 h-3 mr-1 text-emerald-400" />
                ) : statusMessage.type === 'error' ? (
                  <AlertCircle className="w-3 h-3 mr-1 text-rose-400" />
                ) : null}
                {statusMessage.text}
              </span>
            )}

            {currentFilePath && (
              <span className="text-dcc-sm text-dcc-muted font-mono truncate max-w-[120px] lg:max-w-xs hidden sm:inline" title={currentFilePath}>
                {currentFilePath.split('/').pop()}
              </span>
            )}

            <button
              className="flex items-center px-2 py-1 text-dcc-sm bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border space-x-1.5 transition-colors"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <CommandIcon className="w-3 h-3 text-blue-400" />
              <span>{t('toolbar.commands')}</span>
              <kbd className="px-1 py-0.2 bg-zinc-900 text-zinc-400 rounded text-[9px] font-mono">⌘K</kbd>
            </button>
          </div>
        </header>

        {/* Main Dockview Area */}
        <main className="flex-1 w-full h-full relative overflow-hidden">
          <DockviewReact
            className="dockview-theme-dcc w-full h-full"
            onReady={onReady}
            components={dockviewComponents}
          />
        </main>

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
            else if (action === 'undo') handleUndo();
            else if (action === 'redo') handleRedo();
            else if (action === 'lint') {
              const diags = lintProjectJs(project);
              if (diags.length === 0) {
                notify('Project Linter: 0 errors, 0 warnings', 'success');
              } else {
                notify(`Linter found ${diags.length} issue(s): ${diags[0].code}`, 'error');
              }
            } else if (action === 'cleanup_empty') {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'project.cleanup_empty',
                params: {},
              });
              notify('Cleaned up empty Parts, Deformers, and unused Parameters', 'success');
            } else if (action === 'synthesize_corners') {
              if (selectedNodeId) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'keyform.synthesize_corners',
                  params: { target_node_id: selectedNodeId },
                });
                notify('Synthesized 4-corner keyforms (Ctrl+4)', 'success');
              } else {
                notify('Select a node with 2D keyforms first', 'error');
              }
            } else if (action === 'ai_full_body_deformers') {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'macro.ai_full_body_deformers',
                params: {},
              });
              notify('Generated Official Cubism 5.3 Full-Body 24-Deformer Tree', 'success');
            } else if (action === 'macro_turn_xy') {
              if (selectedNodeId) {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'macro.setup_turn_xy',
                  params: { target_node_id: selectedNodeId },
                });
                notify('Applied 3x3 Turn XY Macro', 'success');
              } else {
                notify('Please select a Warp Deformer first', 'error');
              }
            }
          }}
        />

      {/* Texture Atlas Layout Modal */}
      <AtlasModal open={atlasModalOpen} onOpenChange={setAtlasModalOpen} />

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
                bus.setProject(parsed);
                setProject(parsed);
                setCurrentFilePath(file.name);
                notify(`Opened ${file.name}`, 'success');
              } catch (err: any) {
                notify(`Failed to parse file: ${err?.message || err}`, 'error');
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
