import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Download, RefreshCw, X } from 'lucide-react';
import type { AppUpdateState } from '../../electron/preload.js';
import { useI18n } from '../i18n/index.js';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: AppUpdateState;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  open,
  onOpenChange,
  state,
  onCheck,
  onDownload,
  onInstall,
}) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.status !== 'downloading') {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onOpenChange, open, state.status]);

  if (!open) return null;

  const progress = Math.max(0, Math.min(100, state.percent));
  const checking = state.status === 'checking';
  const downloading = state.status === 'downloading';
  const available = state.status === 'available';
  const downloaded = state.status === 'downloaded';
  const failed = state.status === 'error';
  const currentVersion = state.currentVersion || '0.0.0';
  const releaseVersion = state.version ? `v${state.version}` : '';

  const statusText = checking
    ? t('updates.checking')
    : downloading
      ? t('updates.downloading', { percent: Math.round(progress) })
      : available
        ? t('updates.available', { version: releaseVersion })
        : downloaded
          ? t('updates.downloaded', { version: releaseVersion })
          : failed
            ? t('updates.error')
            : state.status === 'up-to-date'
              ? t('updates.up_to_date')
              : state.status === 'disabled'
                ? t('updates.disabled')
                : t('updates.idle');

  const StatusIcon = downloaded || state.status === 'up-to-date'
    ? CheckCircle2
    : failed
      ? AlertCircle
      : checking || downloading
        ? RefreshCw
        : Download;
  const statusTone = failed
    ? 'text-rose-300'
    : downloaded || state.status === 'up-to-date'
      ? 'text-emerald-300'
      : available
        ? 'text-blue-300'
        : 'text-dcc-control';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm select-none">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        tabIndex={-1}
        className="flex w-[560px] max-w-[94vw] flex-col overflow-hidden rounded-lg border border-dcc-border bg-dcc-panel shadow-2xl outline-none"
      >
        <header className="flex h-10 items-center justify-between border-b border-dcc-border bg-dcc-header px-3">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Download className="h-4 w-4 text-dcc-muted" />
            <span id="update-dialog-title">{t('updates.title')}</span>
          </div>
          <button
            type="button"
            className="rounded p-1 text-dcc-muted hover:bg-dcc-hover hover:text-white disabled:opacity-40"
            onClick={() => onOpenChange(false)}
            disabled={downloading}
            aria-label={t('updates.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2 text-dcc-sm">
            <div className="rounded border border-dcc-border bg-dcc-bg/60 px-3 py-2">
              <div className="text-dcc-xs uppercase tracking-wide text-dcc-subtle">{t('updates.current_version')}</div>
              <div className="mt-1 font-mono text-dcc text-dcc-text">v{currentVersion}</div>
            </div>
            <div className="rounded border border-dcc-border bg-dcc-bg/60 px-3 py-2">
              <div className="text-dcc-xs uppercase tracking-wide text-dcc-subtle">{t('updates.source')}</div>
              <div className="mt-1 text-dcc text-dcc-text">{t('updates.source_value')}</div>
            </div>
          </div>

          <div className={`flex items-start gap-3 rounded border border-dcc-border bg-dcc-bg/45 p-3 ${statusTone}`}>
            <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${checking || downloading ? 'animate-spin' : ''}`} />
            <div className="min-w-0 space-y-1">
              <div className="text-dcc font-medium">{statusText}</div>
              {failed && state.error && (
                <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words text-dcc-xs text-rose-200/80">
                  {state.error}
                </pre>
              )}
              {state.releaseDate && (available || downloaded) && (
                <div className="font-mono text-dcc-xs text-dcc-subtle">
                  {new Date(state.releaseDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {downloading && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-dcc-bg ring-1 ring-inset ring-dcc-border">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-dcc-xs text-dcc-subtle">
                <span>{formatBytes(state.transferred)} / {formatBytes(state.total)}</span>
                <span>{formatBytes(state.bytesPerSecond)}/s</span>
              </div>
            </div>
          )}

          {state.releaseNotes && (available || downloaded) && (
            <section className="space-y-1">
              <h3 className="text-dcc-sm font-semibold text-dcc-text">{t('updates.release_notes')}</h3>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words rounded border border-dcc-border bg-dcc-bg/70 p-3 font-sans text-dcc-sm leading-5 text-dcc-muted">
                {state.releaseNotes}
              </pre>
            </section>
          )}

          <p className="text-dcc-xs leading-5 text-dcc-subtle">{t('updates.auto_check')}</p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-dcc-border bg-dcc-header px-3 py-2">
          {available && (
            <button type="button" className="btn btn-primary" onClick={onDownload}>
              <Download className="h-3.5 w-3.5" />
              {t('updates.download')}
            </button>
          )}
          {downloaded && (
            <>
              <button type="button" className="btn" onClick={() => onOpenChange(false)}>
                {t('updates.later')}
              </button>
              <button type="button" className="btn btn-primary" onClick={onInstall}>
                <RefreshCw className="h-3.5 w-3.5" />
                {t('updates.restart')}
              </button>
            </>
          )}
          {!available && !downloaded && (
            <button
              type="button"
              className="btn"
              onClick={onCheck}
              disabled={checking || downloading || state.status === 'disabled'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? t('updates.checking') : t('updates.check')}
            </button>
          )}
          {!downloaded && (
            <button type="button" className="btn" onClick={() => onOpenChange(false)} disabled={downloading}>
              {t('updates.close')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
