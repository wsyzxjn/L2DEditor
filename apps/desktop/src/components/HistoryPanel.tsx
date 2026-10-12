import React from 'react';
import { useEditor } from '../context/EditorContext.js';
import { History, RotateCcw, CheckCircle2, CircleDashed } from 'lucide-react';

export const HistoryPanel: React.FC = () => {
  const { bus, jumpToHistory, notify } = useEditor();
  const { entries, currentIndex } = bus.getHistory();

  return (
    <div className="flex flex-col h-full bg-dcc-panel border-l border-dcc-border select-none">
      <div className="flex items-center justify-between h-7 px-2 border-b border-dcc-border bg-dcc-header">
        <div className="flex items-center space-x-1.5 text-dcc font-semibold uppercase tracking-wider text-dcc-muted">
          <History className="w-3.5 h-3.5 text-sky-400" />
          <span>History (Undo Tree)</span>
        </div>
        <span className="text-dcc-sm font-mono text-zinc-500">
          {currentIndex + 1} / {entries.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {/* Initial State Entry */}
        <div
          className={`flex items-center justify-between h-6 px-2 rounded cursor-pointer text-dcc transition-colors ${
            currentIndex === -1
              ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30 font-medium'
              : 'hover:bg-dcc-hover text-zinc-400'
          }`}
          onClick={() => {
            jumpToHistory(-1);
            notify('Reverted to initial project state', 'info');
          }}
        >
          <div className="flex items-center space-x-1.5">
            <RotateCcw className="w-3 h-3 text-zinc-500" />
            <span>[Initial State]</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">#0</span>
        </div>

        {entries.map((entry, idx) => {
          const isCurrent = idx === currentIndex;
          const isApplied = entry.status === 'applied';
          return (
            <div
              key={`${entry.id}_${idx}`}
              className={`flex items-center justify-between h-6 px-2 rounded cursor-pointer text-dcc transition-colors ${
                isCurrent
                  ? 'bg-sky-600/25 text-sky-200 border border-sky-500/40 font-medium'
                  : isApplied
                  ? 'hover:bg-dcc-hover text-dcc-text'
                  : 'hover:bg-dcc-hover text-zinc-500 italic opacity-60'
              }`}
              onClick={() => {
                jumpToHistory(idx);
                notify(`Jumped to step #${idx + 1}: ${entry.name}`, 'info');
              }}
            >
              <div className="flex items-center space-x-1.5 truncate mr-2">
                {isApplied ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <CircleDashed className="w-3 h-3 text-zinc-500 shrink-0" />
                )}
                <span className="truncate font-mono text-dcc-sm">{entry.name}</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                {entry.patchCount}p
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
