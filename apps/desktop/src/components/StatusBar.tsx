import React from 'react';
import { AlertCircle, Check, Globe, Info } from 'lucide-react';
import { useI18n, type LanguageSetting } from '../i18n/index.js';

export interface StatusMessage {
  text: string;
  type: 'info' | 'success' | 'error';
}

interface StatusBarProps {
  filePath: string | null;
  dirty: boolean;
  message: StatusMessage | null;
  nodeCount: number;
  selectedCount: number;
}

const messageIcon = { info: Info, success: Check, error: AlertCircle };

export const StatusBar: React.FC<StatusBarProps> = ({ filePath, dirty, message, nodeCount, selectedCount }) => {
  const { t, localeSetting, effectiveLanguage, setLanguageSetting } = useI18n();
  const fileName = filePath?.split(/[\\/]/).pop() ?? t('status.untitled');
  const MessageIcon = message ? messageIcon[message.type] : null;

  return (
    <footer className="status-bar flex shrink-0 items-center gap-3 h-6 px-2 border-t border-dcc-border bg-dcc-header text-dcc-sm text-dcc-muted select-none">
      <span className="flex min-w-0 shrink-0 items-center gap-1.5 max-w-[40%]" title={filePath ?? fileName}>
        <span
          className={`w-1.5 h-1.5 shrink-0 rounded-full ${dirty ? 'bg-zinc-300' : 'bg-transparent ring-1 ring-inset ring-zinc-600'}`}
          aria-hidden
        />
        <span className="truncate text-zinc-300">{fileName}</span>
        <span className="shrink-0">{dirty ? t('status.unsaved') : t('status.saved')}</span>
      </span>

      <span
        role={message?.type === 'error' ? 'alert' : 'status'}
        className={`flex min-w-0 flex-1 items-center gap-1.5 ${message?.type === 'error' ? 'text-rose-300' : 'text-zinc-300'}`}
        title={message?.text}
      >
        {MessageIcon && <MessageIcon className={`w-3 h-3 shrink-0 ${message?.type === 'error' ? 'text-rose-400' : 'text-dcc-muted'}`} />}
        <span className="truncate">{message?.text}</span>
      </span>

      <span className="shrink-0 font-mono text-dcc-xs">
        {selectedCount > 0 ? `${t('status.selected')} ${selectedCount} / ` : ''}{t('status.nodes')} {nodeCount}
      </span>

      <label className="flex shrink-0 items-center gap-1 rounded px-1 hover:bg-dcc-hover hover:text-dcc-text">
        <Globe className="w-3 h-3" />
        <select
          className="bg-transparent text-dcc-sm outline-none cursor-pointer [field-sizing:content]"
          aria-label={t('toolbar.language')}
          value={localeSetting}
          onChange={(event) => setLanguageSetting(event.target.value as LanguageSetting)}
        >
          <option value="auto" className="bg-zinc-900 text-zinc-200">
            {t('toolbar.lang_auto')} ({effectiveLanguage === 'zh-CN' ? '中文' : effectiveLanguage === 'ja' ? '日本語' : 'EN'})
          </option>
          <option value="zh-CN" className="bg-zinc-900 text-zinc-200">{t('toolbar.lang_zh')}</option>
          <option value="ja" className="bg-zinc-900 text-zinc-200">{t('toolbar.lang_ja')}</option>
          <option value="en" className="bg-zinc-900 text-zinc-200">{t('toolbar.lang_en')}</option>
        </select>
      </label>
    </footer>
  );
};
