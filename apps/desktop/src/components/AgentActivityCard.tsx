import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import type { RendererEditorRequest } from '@l2d/mcp-server/editor-protocol';
import { useI18n } from '../i18n/index.js';

export interface AgentActivity {
  id: string;
  action: RendererEditorRequest['action'];
  status: 'running' | 'success' | 'error' | 'undone';
  startedAt: number;
  durationMs?: number;
  commandId?: string;
  commandName?: string;
  dryRun?: boolean;
  patchCount?: number;
  undoable?: boolean;
  error?: string;
}

interface AgentActivityCardProps {
  activities: AgentActivity[];
  /** Command currently at the top of the shared undo stack. */
  undoableCommandId: string | null;
  onUndo: () => void;
  onDismiss: () => void;
}

const statusIcon = {
  running: LoaderCircle,
  success: CheckCircle2,
  error: AlertCircle,
  undone: Undo2,
};

export const AgentActivityCard: React.FC<AgentActivityCardProps> = ({
  activities,
  undoableCommandId,
  onUndo,
  onDismiss,
}) => {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const latest = activities.at(-1);
  if (!latest) return null;

  const undoableActivity = [...activities].reverse().find(
    (activity) => activity.commandId === undoableCommandId && activity.undoable && activity.status === 'success',
  );
  const latestFailed = latest.status === 'error';

  return (
    <aside
      data-testid="agent-activity-card"
      aria-live="polite"
      className={`agent-activity-card fixed right-3 bottom-9 z-[60] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded border bg-dcc-panel shadow-2xl ${
        latestFailed ? 'border-rose-800' : 'border-dcc-border'
      }`}
    >
      <div className={`h-0.5 ${latestFailed ? 'bg-rose-500' : 'bg-blue-500'}`} />
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${
          latestFailed ? 'bg-rose-950 text-rose-300' : 'bg-blue-950 text-blue-300'
        }`}>
          <Sparkles className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-dcc font-semibold text-dcc-text">{t('agent.title')}</span>
            {latest.status === 'running' && (
              <span className="flex items-center gap-1 text-dcc-xs text-blue-300">
                <span className="agent-activity-pulse h-1.5 w-1.5 rounded-full bg-blue-400" />
                {t('agent.running')}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-dcc-sm text-dcc-muted" title={activityLabel(latest, t)}>
            {activityLabel(latest, t)}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-icon h-6 w-6 -mr-1 -mt-0.5"
          onClick={onDismiss}
          title={t('agent.dismiss')}
          aria-label={t('agent.dismiss')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <ol className="mt-2 max-h-32 overflow-y-auto border-y border-dcc-border bg-dcc-bg/35 px-3 py-1">
        {activities.slice(-8).map((activity) => {
          const Icon = statusIcon[activity.status];
          const failed = activity.status === 'error';
          return (
            <li key={activity.id} className="flex min-h-6 items-center gap-2 text-dcc-sm" data-status={activity.status}>
              <Icon className={`w-3 h-3 shrink-0 ${
                activity.status === 'running'
                  ? 'animate-spin text-blue-400'
                  : failed
                    ? 'text-rose-400'
                    : activity.status === 'undone'
                      ? 'text-dcc-subtle'
                      : 'text-emerald-400'
              }`} />
              <span className={`min-w-0 flex-1 truncate ${activity.status === 'undone' ? 'text-dcc-subtle' : 'text-dcc-control'}`}>
                {activityLabel(activity, t)}
              </span>
              {activity.dryRun && <span className="rounded bg-zinc-800 px-1 text-dcc-xs text-zinc-400">{t('agent.dry_run')}</span>}
              {activity.patchCount !== undefined && <span className="font-mono text-dcc-xs text-dcc-subtle">{activity.patchCount}</span>}
              <span className="text-dcc-xs text-dcc-subtle">{t(`agent.status.${activity.status}`)}</span>
            </li>
          );
        })}
      </ol>

      {detailsOpen && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-dcc-border px-3 py-2 text-dcc-sm">
          <dt className="text-dcc-subtle">{t('agent.action')}</dt>
          <dd className="truncate font-mono text-dcc-control">{latest.action}</dd>
          {latest.commandName && (
            <>
              <dt className="text-dcc-subtle">{t('agent.command')}</dt>
              <dd className="truncate font-mono text-dcc-control">{latest.commandName}</dd>
            </>
          )}
          {latest.patchCount !== undefined && (
            <>
              <dt className="text-dcc-subtle">{t('agent.changes')}</dt>
              <dd>{t('agent.patch_count', { count: latest.patchCount })}</dd>
            </>
          )}
          {latest.durationMs !== undefined && (
            <>
              <dt className="text-dcc-subtle">{t('agent.duration')}</dt>
              <dd>{latest.durationMs} ms</dd>
            </>
          )}
          {latest.error && (
            <>
              <dt className="text-rose-400">{t('agent.error')}</dt>
              <dd className="break-words text-rose-300">{latest.error}</dd>
            </>
          )}
        </dl>
      )}

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button type="button" className="btn h-6 px-1.5 text-dcc-xs" onClick={() => setDetailsOpen((open) => !open)}>
          {detailsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          {detailsOpen ? t('agent.hide_details') : t('agent.details')}
        </button>
        {undoableActivity && (
          <button type="button" className="btn btn-secondary h-6 px-2 text-dcc-xs" onClick={onUndo}>
            <Undo2 className="w-3 h-3" />
            {t('agent.undo')}
          </button>
        )}
      </div>
    </aside>
  );
};

function activityLabel(
  activity: AgentActivity,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (activity.action === 'exec' && activity.commandName) return activity.commandName;
  return t(`agent.action.${activity.action}`);
}
