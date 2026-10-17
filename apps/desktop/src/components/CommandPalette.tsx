import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { useI18n } from '../i18n/index.js';
import { Sparkles, FileUp, Plus, ShieldCheck, Undo2, Redo2, Save, LayoutDashboard } from 'lucide-react';

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
  const { t } = useI18n();

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
      <div className="w-full max-w-[92vw] sm:max-w-lg bg-dcc-panel border border-dcc-border rounded-lg shadow-2xl overflow-hidden">
        <Command className="w-full text-dcc">
          <div className="flex items-center justify-between px-3 border-b border-dcc-border">
            <Command.Input
              autoFocus
              placeholder={t('palette.placeholder')}
              className="w-full h-10 bg-transparent text-dcc-text outline-none text-dcc"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onOpenChange(false);
                }
              }}
            />
            <button
              className="px-1.5 py-0.5 text-[10px] font-mono bg-dcc-raised hover:bg-zinc-700 text-dcc-muted hover:text-zinc-200 rounded border border-dcc-border"
              onClick={() => onOpenChange(false)}
              title={t('palette.close')}
              aria-label={t('palette.close')}
            >
              ESC
            </button>
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
            <Command.Empty className="py-6 text-center text-dcc-muted">{t('palette.no_results')}</Command.Empty>

            <Command.Group heading={t('palette.group_file')} className="text-dcc-sm text-dcc-muted px-2 py-1 font-semibold uppercase">
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('atlas'); onOpenChange(false); }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('toolbar.atlas')}</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('import_psd'); onOpenChange(false); }}
              >
                <FileUp className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('toolbar.import_psd')}</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('save'); onOpenChange(false); }}
              >
                <Save className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('toolbar.save')}</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading={t('palette.group_edit')} className="text-dcc-sm text-dcc-muted px-2 py-1 font-semibold uppercase">
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('add_warp'); onOpenChange(false); }}
              >
                <Plus className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('palette.add_warp')}</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('macro_turn_xy'); onOpenChange(false); }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('palette.turn_xy')}</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('ai_full_body_deformers'); onOpenChange(false); }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('palette.full_body')}</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('synthesize_corners'); onOpenChange(false); }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('inspector.synthesize_corners')}</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('cleanup_empty'); onOpenChange(false); }}
              >
                <Sparkles className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('hierarchy.cleanup')}</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('undo'); onOpenChange(false); }}
              >
                <Undo2 className="w-3.5 h-3.5 mr-2" />
                <span>{t('toolbar.undo')}</span>
              </Command.Item>
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('redo'); onOpenChange(false); }}
              >
                <Redo2 className="w-3.5 h-3.5 mr-2" />
                <span>{t('toolbar.redo')}</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading={t('palette.group_view')} className="text-dcc-sm text-dcc-muted px-2 py-1 font-semibold uppercase">
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('reset_layout'); onOpenChange(false); }}
              >
                <LayoutDashboard className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('window.reset_layout')}</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading={t('palette.group_diagnostics')} className="text-dcc-sm text-dcc-muted px-2 py-1 font-semibold uppercase">
              <Command.Item
                className="flex items-center px-2 py-1.5 rounded hover:bg-dcc-hover cursor-pointer text-dcc-text"
                onSelect={() => { onAction('lint'); onOpenChange(false); }}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-2 text-dcc-muted" />
                <span>{t('palette.lint')}</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
