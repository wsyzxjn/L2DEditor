import React, { createContext, useContext } from 'react';
import type { Project, EvaluatedFrameJs } from '@l2d/schema';
import type { CommandBus } from '@l2d/command';

export interface EditorContextValue {
  project: Project;
  bus: CommandBus;
  frame: EvaluatedFrameJs | null;
  selectedNodeId: string | null;
  parameterValues: Record<string, number>;
  currentFilePath: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setParameterValue: (id: string, val: number) => void;
  executeCommand: (cmd: any) => void;
  notify: (text: string, type?: 'info' | 'success' | 'error') => void;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error('useEditor must be used within EditorContext.Provider');
  }
  return ctx;
}
