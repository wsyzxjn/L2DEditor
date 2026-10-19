import { produceWithPatches, applyPatches, type Patch, enablePatches } from 'immer';
import type { Project } from '@l2d/schema';
import type { Command, CommandExecutionResult, CommandHandler } from './types.js';

enablePatches();

export interface CommandBusOptions {
  /** Maximum number of undo entries kept in memory. */
  maxHistoryEntries?: number;
}

export class CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();
  private undoStack: { command: Command; inversePatches: Patch[]; patches: Patch[] }[] = [];
  private redoStack: { command: Command; inversePatches: Patch[]; patches: Patch[] }[] = [];
  private activeTransaction: { commands: Command[]; patches: Patch[]; inversePatches: Patch[] } | null = null;
  private project: Project;
  private readonly maxHistoryEntries: number;

  constructor(initialProject: Project, options: CommandBusOptions = {}) {
    this.project = initialProject;
    this.maxHistoryEntries = Math.max(1, Math.floor(options.maxHistoryEntries ?? 1000));
  }

  private trimHistory(): void {
    const excess = this.undoStack.length - this.maxHistoryEntries;
    if (excess > 0) {
      this.undoStack.splice(0, excess);
    }
  }

  public register<T>(commandName: string, handler: CommandHandler<T>): void {
    if (this.handlers.has(commandName)) throw new Error(`Command '${commandName}' is already registered`);
    this.handlers.set(commandName, handler);
  }

  public getProject(): Project {
    return this.project;
  }

  public setProject(project: Project): void {
    this.project = project;
    this.undoStack = [];
    this.redoStack = [];
    this.activeTransaction = null;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0 && this.activeTransaction === null;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0 && this.activeTransaction === null;
  }

  public isTransactionActive(): boolean {
    return this.activeTransaction !== null;
  }

  public beginTransaction(): void {
    if (this.activeTransaction) {
      throw new Error('Transaction already in progress');
    }
    this.activeTransaction = { commands: [], patches: [], inversePatches: [] };
  }

  public commitTransaction(): void {
    if (!this.activeTransaction) {
      throw new Error('No active transaction to commit');
    }
    if (this.activeTransaction.commands.length > 0) {
      this.undoStack.push({
        command: {
          id: `tx_${Date.now()}`,
          name: 'transaction.batch',
          params: { commands: this.activeTransaction.commands },
        },
        patches: this.activeTransaction.patches,
        inversePatches: this.activeTransaction.inversePatches,
      });
      this.redoStack = [];
      this.trimHistory();
    }
    this.activeTransaction = null;
  }

  public rollbackTransaction(): void {
    if (!this.activeTransaction) {
      throw new Error('No active transaction to rollback');
    }
    // Revert all patches in reverse order
    if (this.activeTransaction.inversePatches.length > 0) {
      this.project = applyPatches(this.project, this.activeTransaction.inversePatches);
    }
    this.activeTransaction = null;
  }

  public dryRun(command: Command): { success: boolean; patches: Patch[]; error?: string } {
    const handler = this.handlers.get(command.name);
    if (!handler) {
      return { success: false, patches: [], error: `Unknown command: ${command.name}` };
    }
    try {
      const params = structuredClone(command.params);
      const [, patches] = produceWithPatches(this.project, (draft) => {
        handler(draft, params);
      });
      return { success: true, patches };
    } catch (err: any) {
      return { success: false, patches: [], error: err?.message || String(err) };
    }
  }

  public execute(command: Command): CommandExecutionResult {
    const handler = this.handlers.get(command.name);
    if (!handler) {
      return {
        success: false,
        commandId: command.id,
        patches: [],
        inversePatches: [],
        error: `Unknown command: ${command.name}`,
      };
    }

    try {
      const params = structuredClone(command.params);
      const [nextProject, patches, inversePatches] = produceWithPatches(this.project, (draft) => {
        handler(draft, params);
      });

      this.project = nextProject;

      if (this.activeTransaction) {
        if (patches.length > 0) {
          this.activeTransaction.commands.push(command);
          this.activeTransaction.patches.push(...patches);
          // Inverse patches must be unshifted for proper rollback order
          this.activeTransaction.inversePatches.unshift(...inversePatches);
        }
      } else if (patches.length > 0) {
        this.undoStack.push({ command, patches, inversePatches });
        this.redoStack = [];
        this.trimHistory();
      }

      return {
        success: true,
        commandId: command.id,
        patches,
        inversePatches,
      };
    } catch (err: any) {
      return {
        success: false,
        commandId: command.id,
        patches: [],
        inversePatches: [],
        error: err?.message || String(err),
      };
    }
  }

  public undo(): boolean {
    if (this.activeTransaction || this.undoStack.length === 0) {
      return false;
    }
    const entry = this.undoStack.pop()!;
    this.project = applyPatches(this.project, entry.inversePatches);
    this.redoStack.push(entry);
    return true;
  }

  public redo(): boolean {
    if (this.activeTransaction || this.redoStack.length === 0) {
      return false;
    }
    const entry = this.redoStack.pop()!;
    this.project = applyPatches(this.project, entry.patches);
    this.undoStack.push(entry);
    return true;
  }

  public getHistory(): {
    entries: { id: string; name: string; patchCount: number; status: 'applied' | 'undone' }[];
    currentIndex: number;
  } {
    const applied = this.undoStack.map((e) => ({
      id: e.command.id,
      name: e.command.name,
      patchCount: e.patches.length,
      status: 'applied' as const,
    }));
    const undone = [...this.redoStack].reverse().map((e) => ({
      id: e.command.id,
      name: e.command.name,
      patchCount: e.patches.length,
      status: 'undone' as const,
    }));
    return {
      entries: [...applied, ...undone],
      currentIndex: applied.length - 1,
    };
  }

  public jumpToHistory(targetIndex: number): boolean {
    if (this.activeTransaction) return false;
    const currentIndex = this.undoStack.length - 1;
    if (targetIndex === currentIndex) return true;
    if (targetIndex < -1 || targetIndex >= this.undoStack.length + this.redoStack.length) {
      return false;
    }
    while (this.undoStack.length - 1 > targetIndex) {
      if (!this.undo()) break;
    }
    while (this.undoStack.length - 1 < targetIndex) {
      if (!this.redo()) break;
    }
    return true;
  }
}
