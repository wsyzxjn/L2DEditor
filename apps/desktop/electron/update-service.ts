import { app, type BrowserWindow } from 'electron';
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater';

export type AppUpdateStatus =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

export interface AppUpdateState {
  status: AppUpdateStatus;
  currentVersion: string;
  version: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
  error: string | null;
}

export interface DesktopUpdateService {
  start: () => void;
  getState: () => AppUpdateState;
  checkForUpdates: () => Promise<AppUpdateState>;
  downloadUpdate: () => Promise<AppUpdateState>;
  installUpdate: () => void;
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_CHECK_DELAY_MS = 15_000;

function plainTextNotes(notes: UpdateInfo['releaseNotes']): string | null {
  const text = typeof notes === 'string'
    ? notes
    : Array.isArray(notes)
      ? notes.map(note => note.note ?? '').filter(Boolean).join('\n\n')
      : '';
  const normalized = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createDesktopUpdateService(getWindow: () => BrowserWindow | null): DesktopUpdateService {
  let state: AppUpdateState = {
    status: app.isPackaged ? 'idle' : 'disabled',
    currentVersion: app.getVersion(),
    version: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    error: null,
  };
  let started = false;
  let startupTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;

  const broadcast = () => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('l2d:update-state', state);
  };

  const updateState = (patch: Partial<AppUpdateState>) => {
    state = { ...state, ...patch };
    broadcast();
    return state;
  };

  const updateAvailable = (info: UpdateInfo) => updateState({
    status: 'available',
    version: info.version,
    releaseName: info.releaseName ?? null,
    releaseNotes: plainTextNotes(info.releaseNotes),
    releaseDate: info.releaseDate ?? null,
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    error: null,
  });

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    updateState({ status: 'checking', error: null });
  });
  autoUpdater.on('update-available', updateAvailable);
  autoUpdater.on('update-not-available', () => {
    updateState({
      status: 'up-to-date',
      version: null,
      releaseName: null,
      releaseNotes: null,
      releaseDate: null,
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
      error: null,
    });
  });
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    updateState({
      status: 'downloading',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
      error: null,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateState({
      status: 'downloaded',
      version: info.version,
      releaseName: info.releaseName ?? null,
      releaseNotes: plainTextNotes(info.releaseNotes),
      releaseDate: info.releaseDate ?? null,
      percent: 100,
      bytesPerSecond: 0,
      transferred: info.files.reduce((sum, file) => sum + (file.size ?? 0), 0),
      total: info.files.reduce((sum, file) => sum + (file.size ?? 0), 0),
      error: null,
    });
  });
  autoUpdater.on('error', (error) => {
    updateState({ status: 'error', error: errorMessage(error) });
  });

  const checkForUpdates = async (): Promise<AppUpdateState> => {
    if (!app.isPackaged) return state;
    if (['checking', 'downloading', 'available', 'downloaded'].includes(state.status)) return state;
    try {
      updateState({ status: 'checking', error: null });
      const result = await autoUpdater.checkForUpdates();
      if (!result) updateState({ status: 'idle' });
    } catch (error) {
      updateState({ status: 'error', error: errorMessage(error) });
    }
    return state;
  };

  const downloadUpdate = async (): Promise<AppUpdateState> => {
    if (state.status !== 'available') return state;
    try {
      updateState({ status: 'downloading', percent: 0, error: null });
      await autoUpdater.downloadUpdate();
    } catch (error) {
      updateState({ status: 'error', error: errorMessage(error) });
    }
    return state;
  };

  return {
    start() {
      if (!app.isPackaged || started) return;
      started = true;
      startupTimer = setTimeout(() => { void checkForUpdates(); }, STARTUP_CHECK_DELAY_MS);
      startupTimer.unref?.();
      intervalTimer = setInterval(() => { void checkForUpdates(); }, CHECK_INTERVAL_MS);
      intervalTimer.unref?.();
    },
    getState: () => state,
    checkForUpdates,
    downloadUpdate,
    installUpdate() {
      if (state.status !== 'downloaded') return;
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
    },
  };
}
