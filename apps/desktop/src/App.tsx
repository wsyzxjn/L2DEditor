import React, { useState, useEffect, useMemo } from 'react';
import {
  DockviewReact,
  type DockviewReadyEvent,
} from 'dockview-react';
import type { Project, EvaluatedFrameJs } from '@l2d/schema';
import { CommandBus, registerStandardCommands } from '@l2d/command';
import { HierarchyPanel } from './components/HierarchyPanel.js';
import { ParametersPanel } from './components/ParametersPanel.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { ViewportPanel } from './components/ViewportPanel.js';
import { CommandPalette } from './components/CommandPalette.js';
import {
  FolderOpen,
  Save,
  FileUp,
  Undo2,
  Redo2,
  Command as CommandIcon,
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

export function App() {
  const [project, setProject] = useState<Project>(defaultInitialProject);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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
    }
  };

  const handleUndo = () => {
    if (bus.undo()) {
      setProject({ ...bus.getProject() });
    }
  };

  const handleRedo = () => {
    if (bus.redo()) {
      setProject({ ...bus.getProject() });
    }
  };

  const handleSave = async () => {
    if (currentFilePath && (window as any).l2dApi) {
      const json = JSON.stringify(project, null, 2);
      const success = await (window as any).l2dApi.saveProject(currentFilePath, json);
      if (success) {
        console.log('Project saved to', currentFilePath);
      }
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
        } catch (e) {
          console.error('Failed to parse project:', e);
        }
      }
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
        } catch (e) {
          console.error('Failed to parse imported project:', e);
        }
      }
    }
  };

  // Dockview Components Dictionary
  const components = {
    hierarchy: () => (
      <HierarchyPanel
        project={project}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        onExecuteCommand={executeCommand}
      />
    ),
    viewport: () => (
      <ViewportPanel
        project={project}
        frame={frame}
        selectedNodeId={selectedNodeId}
        onExecuteCommand={executeCommand}
      />
    ),
    parameters: () => (
      <ParametersPanel
        project={project}
        parameterValues={parameterValues}
        onChangeParameter={(id, val) =>
          setParameterValues((prev) => ({ ...prev, [id]: val }))
        }
        onExecuteCommand={executeCommand}
        selectedNodeId={selectedNodeId}
      />
    ),
    inspector: () => (
      <InspectorPanel
        project={project}
        selectedNodeId={selectedNodeId}
        onExecuteCommand={executeCommand}
      />
    ),
  };

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

  return (
    <div className="flex flex-col w-screen h-screen bg-dcc-bg text-dcc-text">
      {/* Top Menu / App Toolbar */}
      <header className="flex items-center justify-between h-9 px-3 bg-dcc-header border-b border-dcc-border select-none">
        <div className="flex items-center space-x-3">
          <span className="font-bold tracking-tight text-white flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>L2DEditor</span>
          </span>

          <div className="h-4 w-px bg-dcc-border" />

          <div className="flex items-center space-x-1">
            <button
              className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300"
              onClick={handleOpen}
              title="Open Project"
            >
              <FolderOpen className="w-3.5 h-3.5 mr-1" /> Open
            </button>
            <button
              className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300"
              onClick={handleSave}
              title="Save Project (Ctrl+S)"
            >
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </button>
            <button
              className="flex items-center px-2 py-1 text-dcc-sm hover:bg-dcc-hover rounded text-zinc-300"
              onClick={handleImportPsd}
              title="Import PSD"
            >
              <FileUp className="w-3.5 h-3.5 mr-1" /> Import PSD
            </button>
          </div>

          <div className="h-4 w-px bg-dcc-border" />

          <div className="flex items-center space-x-1">
            <button
              className="p-1 hover:bg-dcc-hover rounded text-zinc-400 hover:text-white"
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 hover:bg-dcc-hover rounded text-zinc-400 hover:text-white"
              onClick={handleRedo}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Info & Palette */}
        <div className="flex items-center space-x-3">
          {currentFilePath && (
            <span className="text-dcc-sm text-dcc-muted font-mono truncate max-w-xs">
              {currentFilePath}
            </span>
          )}

          <button
            className="flex items-center px-2 py-1 text-dcc-sm bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded border border-dcc-border space-x-1.5"
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
          components={components}
        />
      </main>

      {/* Command Palette Modal */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onAction={(action) => {
          if (action === 'save') handleSave();
          else if (action === 'import_psd') handleImportPsd();
          else if (action === 'undo') handleUndo();
          else if (action === 'redo') handleRedo();
          else if (action === 'macro_turn_xy') {
            if (selectedNodeId) {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'macro.setup_turn_xy',
                params: { target_node_id: selectedNodeId },
              });
            }
          }
        }}
      />
    </div>
  );
}
