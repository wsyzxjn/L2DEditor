import React from 'react';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { RotateCcw, CheckCircle2, CircleDashed } from 'lucide-react';

export const HistoryPanel: React.FC = () => {
  const { t } = useI18n();
  const { bus, jumpToHistory, notify } = useEditor();
  const { entries, currentIndex } = bus.getHistory();

  return (
    <div className="panel-root flex flex-col h-full bg-dcc-panel border-l border-dcc-border select-none">

      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {/* Initial State Entry */}
        <div
          className={`flex items-center justify-between h-6 px-2 rounded cursor-pointer text-dcc transition-colors ${
            currentIndex === -1
              ? 'list-item-selected font-medium'
              : 'hover:bg-dcc-hover text-dcc-muted'
          }`}
          onClick={() => {
            jumpToHistory(-1);
            notify(t('notify.history_initial'), 'info');
          }}
        >
          <div className="flex items-center space-x-1.5">
            <RotateCcw className="w-3 h-3 text-dcc-subtle" />
            <span>[{t('history.initial_state')}]</span>
          </div>
          <span className="text-[10px] font-mono text-dcc-subtle">#0</span>
        </div>

        {entries.map((entry, idx) => {
          const isCurrent = idx === currentIndex;
          const isApplied = entry.status === 'applied';
          return (
            <div
              key={`${entry.id}_${idx}`}
              className={`flex items-center justify-between h-6 px-2 rounded cursor-pointer text-dcc transition-colors ${
                isCurrent
                  ? 'list-item-selected font-medium'
                  : isApplied
                  ? 'hover:bg-dcc-hover text-dcc-text'
                  : 'hover:bg-dcc-hover text-dcc-subtle italic opacity-60'
              }`}
              onClick={() => {
                jumpToHistory(idx);
                notify(t('notify.history_jump', { step: idx + 1, name: entry.name }), 'info');
              }}
            >
              <div className="flex items-center space-x-1.5 truncate mr-2">
                {isApplied ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <CircleDashed className="w-3 h-3 text-dcc-subtle shrink-0" />
                )}
                <span className="truncate font-mono text-dcc-sm">{entry.name}</span>
              </div>
              <span className="text-[10px] font-mono text-dcc-subtle shrink-0">
                {entry.patchCount}p
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
