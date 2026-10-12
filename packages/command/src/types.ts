import type { Patch } from 'immer';
import type { Project } from '@l2d/schema';

export interface Command<T = Record<string, unknown>> {
  id: string;
  name: string;
  params: T;
  timestamp?: number;
  source?: 'ui' | 'cli' | 'mcp' | 'script';
}

export interface CommandExecutionResult {
  success: boolean;
  commandId: string;
  patches: Patch[];
  inversePatches: Patch[];
  error?: string;
}

export interface Transaction {
  id: string;
  commands: Command[];
  patches: Patch[];
  inversePatches: Patch[];
}

export type CommandHandler<T = Record<string, unknown>> = (
  draft: Project,
  params: T
) => void;
