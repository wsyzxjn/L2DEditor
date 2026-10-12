import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
} from 'dockview-react';
import type { Project, EvaluatedFrameJs } from '@l2d/schema';
import { CommandBus, registerStandardCommands } from '@l2d/command';
import { EditorContext } from './context/EditorContext.js';
import { HierarchyPanel } from './components/HierarchyPanel.js';
import { ParametersPanel } from './components/ParametersPanel.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { ViewportPanel } from './components/ViewportPanel.js';
import { CommandPalette } from './components/CommandPalette.js';
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
  ],
  nodes: [],
  keyforms: [],
  textures: [],
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

// Stable dockview components dictionary
const dockviewComponents = {
  hierarchy: HierarchyPanel,
  viewport: ViewportPanel,
  parameters: ParametersPanel,
  inspector: InspectorPanel,
};

export function App() {
  const [project, setProject] = useState<Project>(defaultInitialProject);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Update evaluator when project or parameters change
  useEffect(() => {
    const meshes: any[] = [];
    for (const node of project.nodes) {
      if (!node.visible) continue;
      if (node.kind.type === 'ArtMesh') {
        meshes.push({
          id: node.id,
          texture_id: node.kind.texture_id,
          vertices: node.kind.vertices.flat(),
          uvs: node.kind.uvs.flat(),
          indices: node.kind.indices,
          blend_mode: node.kind.blend_mode,
          opacity: node.kind.opacity,
          draw_order: node.kind.draw_order,
          mask_ids: node.kind.mask_ids,
        });
      }
    }
    setFrame({
      meshes,
      total_vertices: meshes.reduce((acc, m) => acc + m.vertices.length / 2, 0),
      total_indices: meshes.reduce((acc, m) => acc + m.indices.length, 0),
    });
  }, [project, parameterValues]);

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
    setParameterValues({});
    notify('Created new blank project', 'info');
  };

  const handleUndo = () => {
    if (bus.undo()) {
      setProject({ ...bus.getProject() });
      notify('Undo', 'info');
    }
  };

  const handleRedo = () => {
    if (bus.redo()) {
      setProject({ ...bus.getProject() });
      notify('Redo', 'info');
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
        notify(`Saved to ${currentFilePath}`, 'success');
      } else {
        notify(`Failed to save to ${currentFilePath}`, 'error');
      }
    } else {
      downloadFile(json, 'project.json', 'application/json');
      notify('Downloaded project.json', 'success');
    }
  };

  const handleSaveAs = async () => {
    const json = JSON.stringify(project, null, 2);
    if ((window as any).l2dApi) {
      const res = await (window as any).l2dApi.saveProjectAsDialog(json, 'project.json');
      if (res && res.success && res.path) {
        setCurrentFilePath(res.path);
        notify(`Saved to ${res.path}`, 'success');
      }
    } else {
      downloadFile(json, 'project.json', 'application/json');
      notify('Downloaded project.json', 'success');
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
          notify(`Opened project from ${res.path}`, 'success');
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
          notify(`Imported PSD: ${parsed.nodes.length} nodes created`, 'success');
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, currentFilePath]);

  const onReady = (event: DockviewReadyEvent) => {
    const left = event.api.addPanel({
      id: 'hierarchy_panel',
      component: 'hierarchy',
      title: 'Hierarchy',
      initialWidth: 260,
    });

    const center = event.api.addPanel({
      id: 'viewport_panel',
      component: 'viewport',
      title: 'Viewport',
      position: { referencePanel: left, direction: 'right' },
    });

    const rightTop = event.api.addPanel({
      id: 'parameters_panel',
      component: 'parameters',
      title: 'Parameters',
      position: { referencePanel: center, direction: 'right' },
      initialWidth: 320,
    });

    event.api.addPanel({
      id: 'inspector_panel',
      component: 'inspector',
      title: 'Inspector',
      position: { referencePanel: rightTop, direction: 'below' },
    });
  };

  const contextValue = {
    project,
    bus,
    frame,
    selectedNodeId,
    parameterValues,
    currentFilePath,
    setSelectedNodeId,
    setParameterValue: (id: string, val: number) =>
      setParameterValues((prev) => ({ ...prev, [id]: val })),
    executeCommand,
    notify,
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
                <FilePlus className="w-3.5 h-3.5 mr-1" /> New
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300 transition-colors"
                onClick={handleOpen}
                title="Open Project (Ctrl+O)"
              >
                <FolderOpen className="w-3.5 h-3.5 mr-1" /> Open
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300 transition-colors"
                onClick={handleSave}
                title="Save Project (Ctrl+S)"
              >
                <Save className="w-3.5 h-3.5 mr-1" /> Save
              </button>
              <button
                className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300 transition-colors"
                onClick={handleImportPsd}
                title="Import PSD Document"
              >
                <FileUp className="w-3.5 h-3.5 mr-1" /> Import PSD
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
              <span className="text-dcc-sm text-dcc-muted font-mono truncate max-w-xs" title={currentFilePath}>
                {currentFilePath.split('/').pop()}
              </span>
            )}

            <button
              className="flex items-center px-2 py-1 text-dcc-sm bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border space-x-1.5 transition-colors"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <CommandIcon className="w-3 h-3 text-blue-400" />
              <span>Commands</span>
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
            else if (action === 'undo') handleUndo();
            else if (action === 'redo') handleRedo();
            else if (action === 'add_warp') {
              const id = `warp_${Date.now()}`;
              const name = `Warp ${project.nodes.filter((n) => n.kind.type === 'WarpDeformer').length + 1}`;
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'node.add',
                params: {
                  id,
                  name,
                  parent_id: selectedNodeId,
                  visible: true,
                  locked: false,
                  kind: {
                    type: 'WarpDeformer',
                    cols: 4,
                    rows: 4,
                    bounds: [760, 340, 400, 400],
                    control_points: [
                      [760, 340], [860, 340], [960, 340], [1060, 340], [1160, 340],
                      [760, 440], [860, 440], [960, 440], [1060, 440], [1160, 440],
                      [760, 540], [860, 540], [960, 540], [1060, 540], [1160, 540],
                      [760, 640], [860, 640], [960, 640], [1060, 640], [1160, 640],
                      [760, 740], [860, 740], [960, 740], [1060, 740], [1160, 740],
                    ],
                  },
                },
              });
              setSelectedNodeId(id);
              notify(`Created Warp Deformer: ${name}`, 'success');
            } else if (action === 'lint') {
              notify('Running project linter...', 'info');
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
