import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { Sparkles, FileUp, Plus, ShieldCheck, Undo2, Redo2, Save } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  onAction,
}) => {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div className="w-full max-w-lg bg-dcc-panel border border-dcc-border rounded-lg shadow-2xl overflow-hidden">
        <Command className="w-full text-dcc">
          <div className="flex items-center justify-between px-3 border-b border-dcc-border">
            <Command.Input
              autoFocus
              placeholder="Type a command or search..."
              className="w-full h-10 bg-transparent text-dcc-text outline-none text-dcc"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onOpenChange(false);
                }
              }}
            />
            <button
              className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded border border-dcc-border"
              onClick={() => onOpenChange(false)}
              title="Close (ESC)"
            >
              ESC
            </button>
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
            <Command.Empty className="py-6 text-center text-dcc-muted">No commands found.</Command.Empty>

            <Command.Group heading="Project & File" className="text-dcc-sm text-dcc-muted px-2 py-1 font-semibold uppercase">
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('atlas'); onOpenChange(false); }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2 text-pink-400" />
                <span>Edit Texture Atlas (编辑纹理集)...</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('import_psd'); onOpenChange(false); }}
              >
                <FileUp className="w-3.5 h-3.5 mr-2 text-blue-400" />
                <span>Import PSD Document...</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('save'); onOpenChange(false); }}
              >
                <Save className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                <span>Save Project</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Editing & Rigging" className="text-dcc-sm text-dcc-muted px-2 py-1 font-semibold uppercase">
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('add_warp'); onOpenChange(false); }}
              >
                <Plus className="w-3.5 h-3.5 mr-2 text-sky-400" />
                <span>Add Warp Deformer</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('macro_turn_xy'); onOpenChange(false); }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2 text-amber-400" />
                <span>Run Macro: Setup Turn XY (3x3 Grid)</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('undo'); onOpenChange(false); }}
              >
                <Undo2 className="w-3.5 h-3.5 mr-2" />
                <span>Undo</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('redo'); onOpenChange(false); }}
              >
                <Redo2 className="w-3.5 h-3.5 mr-2" />
                <span>Redo</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Diagnostics" className="text-dcc-sm text-dcc-muted px-2 py-1 font-semibold uppercase">
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('lint'); onOpenChange(false); }}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-2 text-purple-400" />
                <span>Run Project Linter</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
