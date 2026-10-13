import React, { createContext, useContext } from 'react';
import type { Project, EvaluatedFrameJs } from '@l2d/schema';
import type { CommandBus } from '@l2d/command';

export interface EditorContextValue {
  project: Project;
  bus: CommandBus;
  frame: EvaluatedFrameJs | null;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  parameterValues: Record<string, number>;
  currentFilePath: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  toggleSelectNodeId: (id: string, multi?: boolean) => void;
  setParameterValue: (id: string, val: number) => void;
  parameterSearchQuery: string;
  setParameterSearchQuery: (query: string) => void;
  isGridSnapEnabled: boolean;
  setIsGridSnapEnabled: (val: boolean) => void;
  gridSize: number;
  setGridSize: (size: number) => void;
  executeCommand: (cmd: any) => void;
  jumpToHistory: (targetIndex: number) => void;
  notify: (text: string, type?: 'info' | 'success' | 'error') => void;
  // Mesh Editing Mode
  isMeshEditMode: boolean;
  setIsMeshEditMode: (val: boolean) => void;
  meshEditTool: 'select' | 'add' | 'delete';
  setMeshEditTool: (tool: 'select' | 'add' | 'delete') => void;
  selectedVertexIndex: number | null;
  setSelectedVertexIndex: (idx: number | null) => void;
  // Physics Mode
  isPhysicsEnabled: boolean;
  setIsPhysicsEnabled: (val: boolean) => void;
  // Auto Idle / Natural Breathing Mode
  isAutoIdleEnabled: boolean;
  setIsAutoIdleEnabled: (val: boolean) => void;
  // Onion Skin & Motion Path
  isOnionSkinEnabled: boolean;
  setIsOnionSkinEnabled: (val: boolean) => void;
  isMotionPathEnabled: boolean;
  setIsMotionPathEnabled: (val: boolean) => void;
  // Animation / Timeline Mode
  isPlayingAnimation: boolean;
  setIsPlayingAnimation: (val: boolean) => void;
  currentPlayheadFrame: number;
  setCurrentPlayheadFrame: (frame: number) => void;
  activeAnimationId: string | null;
  setActiveAnimationId: (id: string | null) => void;
  waveformPeaks: number[];
  setWaveformPeaks: (peaks: number[]) => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error('useEditor must be used within EditorContext.Provider');
  }
  return ctx;
}
