import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  BookOpen,
  Bot,
  Braces,
  Cable,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  FileCode2,
  PlugZap,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import type { AgentSetupInfo } from '../../electron/preload.js';
import { useI18n } from '../i18n/index.js';

interface AgentSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SetupTab = 'mcp' | 'skills' | 'verify';
type McpFormat = 'codex' | 'json';
type SkillScope = 'user' | 'repo';

const FALLBACK_REPO_ROOT = '/path/to/L2DEditor';

const fallbackSetupInfo: AgentSetupInfo = {
  repoRoot: FALLBACK_REPO_ROOT,
  mcpServerPath: `${FALLBACK_REPO_ROOT}/packages/mcp-server/dist/bin.js`,
  mcpServerBuilt: true,
  editorUrl: 'ws://127.0.0.1:22033',
  skills: [
    {
      id: 'l2deditor-mcp',
      path: `${FALLBACK_REPO_ROOT}/skills/l2deditor-mcp`,
      required: true,
    },
    {
      id: 'live2d-model-building',
      path: `${FALLBACK_REPO_ROOT}/skills/live2d-model-building`,
      required: false,
    },
  ],
};

const shellQuote = (value: string) => `"${value.replace(/["\\$`]/g, '\\$&')}"`;

interface CodeBlockProps {
  code: string;
  label: string;
  copyKey: string;
  copiedKey: string | null;
  copyLabel: string;
  copiedLabel: string;
  onCopy: (key: string, text: string) => void;
  wrap?: boolean;
}

function CodeBlock({
  code,
  label,
  copyKey,
  copiedKey,
  copyLabel,
  copiedLabel,
  onCopy,
  wrap = false,
}: CodeBlockProps) {
  const copied = copiedKey === copyKey;

  return (
    <div className={`agent-setup-code-block ${wrap ? 'is-wrapped' : ''}`}>
      <div className="agent-setup-code-header">
        <span>{label}</span>
        <button
          type="button"
          className="btn btn-icon"
          title={copied ? copiedLabel : copyLabel}
          aria-label={copied ? copiedLabel : copyLabel}
          onClick={() => onCopy(copyKey, code)}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const AgentSetupModal: React.FC<AgentSetupModalProps> = ({ open, onOpenChange }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SetupTab>('mcp');
  const [mcpFormat, setMcpFormat] = useState<McpFormat>('codex');
  const [skillScope, setSkillScope] = useState<SkillScope>('user');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [setupInfo, setSetupInfo] = useState<AgentSetupInfo>(fallbackSetupInfo);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const api = (window as unknown as { l2dApi?: { getAgentSetupInfo?: () => Promise<AgentSetupInfo> } }).l2dApi;
    let active = true;
    void api?.getAgentSetupInfo?.()
      .then(info => {
        if (active && info) setSetupInfo(info);
      })
      .catch(() => {
        // The browser preview has no native setup metadata; keep the generic paths.
      });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => {
        if (previousFocus.current?.isConnected) previousFocus.current.focus();
      });
    };
  }, [open, onOpenChange]);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const codexConfig = useMemo(() => {
    const tomlString = (value: string) => JSON.stringify(value);
    return [
      '[mcp_servers.l2deditor]',
      'command = "node"',
      `args = [${tomlString(setupInfo.mcpServerPath)}]`,
      `cwd = ${tomlString(setupInfo.repoRoot)}`,
      '',
      '[mcp_servers.l2deditor.env]',
      `L2D_EDITOR_URL = ${tomlString(setupInfo.editorUrl)}`,
    ].join('\n');
  }, [setupInfo.editorUrl, setupInfo.mcpServerPath, setupInfo.repoRoot]);

  const genericJsonConfig = useMemo(() => JSON.stringify({
    mcpServers: {
      l2deditor: {
        command: 'node',
        args: [setupInfo.mcpServerPath],
        env: {
          L2D_EDITOR_URL: setupInfo.editorUrl,
        },
      },
    },
  }, null, 2), [setupInfo.editorUrl, setupInfo.mcpServerPath]);

  const codexCliCommand = useMemo(
    () => `codex mcp add l2deditor --env L2D_EDITOR_URL=${setupInfo.editorUrl} -- node ${shellQuote(setupInfo.mcpServerPath)}`,
    [setupInfo.editorUrl, setupInfo.mcpServerPath],
  );

  const skillInstallCommand = useMemo(() => {
    const baseDirectory = skillScope === 'user'
      ? '$HOME/.agents/skills'
      : `${setupInfo.repoRoot.replace(/[\\/]$/, '')}/.agents/skills`;
    const quoteDestination = (directory: string) =>
      directory.startsWith('$HOME') ? `"${directory}"` : shellQuote(directory);
    const destinations = setupInfo.skills.map(skill => `${baseDirectory}/${skill.id}`);
    return [
      `mkdir -p ${destinations.map(quoteDestination).join(' ')}`,
      ...setupInfo.skills.map((skill, index) =>
        `cp -R ${shellQuote(`${skill.path}/.`)} ${quoteDestination(destinations[index])}`),
    ].join('\n');
  }, [setupInfo.repoRoot, setupInfo.skills, skillScope]);

  const verificationPrompt = t('agentSetup.verify.prompt');

  const copy = async (key: string, text: string) => {
    setCopyError(false);
    try {
      const api = (window as unknown as { l2dApi?: { copyText?: (value: string) => Promise<void> } }).l2dApi;
      if (api?.copyText) {
        await api.copyText(text);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopiedKey(key);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      setCopyError(true);
    }
  };

  if (!open) return null;

  const tabs: { id: SetupTab; label: string; icon: React.ReactNode; description: string }[] = [
    {
      id: 'mcp',
      label: t('agentSetup.tabs.mcp'),
      description: t('agentSetup.tabs.mcpHint'),
      icon: <PlugZap className="h-4 w-4" />,
    },
    {
      id: 'skills',
      label: t('agentSetup.tabs.skills'),
      description: t('agentSetup.tabs.skillsHint'),
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: 'verify',
      label: t('agentSetup.tabs.verify'),
      description: t('agentSetup.tabs.verifyHint'),
      icon: <BadgeCheck className="h-4 w-4" />,
    },
  ];

  const moveTabFocus = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? -1
        : 0;
    if (!direction) return;
    event.preventDefault();
    const next = tabs[(currentIndex + direction + tabs.length) % tabs.length];
    setActiveTab(next.id);
    setCopyError(false);
    document.getElementById(`agent-setup-tab-${next.id}`)?.focus();
  };

  const selectTab = (tab: SetupTab) => {
    setActiveTab(tab);
    setCopyError(false);
    setCopiedKey(null);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <section
        ref={dialogRef}
        className="agent-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-setup-title"
        tabIndex={-1}
        data-testid="agent-setup-modal"
      >
        <header className="agent-setup-header">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="agent-setup-mark"><Bot className="h-4 w-4" /></div>
            <div className="min-w-0">
              <h2 id="agent-setup-title" className="truncate text-dcc font-semibold text-white">
                {t('agentSetup.title')}
              </h2>
              <p className="truncate text-dcc-sm text-dcc-muted">{t('agentSetup.subtitle')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`agent-setup-readiness ${setupInfo.mcpServerBuilt ? 'is-ready' : 'is-warning'}`}
              title={setupInfo.mcpServerBuilt
                ? t('agentSetup.status.readyHint')
                : t('agentSetup.status.missingHint')}
            >
              <span />
              {setupInfo.mcpServerBuilt
                ? t('agentSetup.status.ready')
                : t('agentSetup.status.missing')}
            </span>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => onOpenChange(false)}
              aria-label={t('agentSetup.close')}
              title={t('agentSetup.close')}
              autoFocus
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="agent-setup-body">
          <nav className="agent-setup-nav" role="tablist" aria-label={t('agentSetup.tabs.label')}>
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                id={`agent-setup-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`agent-setup-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className="agent-setup-nav-item"
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => moveTabFocus(event, index)}
              >
                {tab.icon}
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.description}</small>
                </span>
              </button>
            ))}
            <div className="agent-setup-nav-note">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t('agentSetup.localOnly')}</span>
            </div>
          </nav>

          <div
            id={`agent-setup-panel-${activeTab}`}
            className="agent-setup-content"
            role="tabpanel"
            aria-labelledby={`agent-setup-tab-${activeTab}`}
          >
            {activeTab === 'mcp' && (
              <div className="space-y-4">
                <section>
                  <div className="agent-setup-section-heading">
                    <PlugZap className="h-4 w-4 text-blue-400" />
                    <div>
                      <h3>{t('agentSetup.mcp.title')}</h3>
                      <p>{t('agentSetup.mcp.description')}</p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="agent-setup-status-card">
                    <div className="agent-setup-status-icon"><Cable className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <strong>{t('agentSetup.mcp.bridge')}</strong>
                      <code>{setupInfo.editorUrl}</code>
                      <small>{t('agentSetup.mcp.bridgeHint')}</small>
                    </div>
                  </div>
                  <div className={`agent-setup-status-card ${setupInfo.mcpServerBuilt ? 'is-ready' : 'is-warning'}`}>
                    <div className="agent-setup-status-icon">
                      {setupInfo.mcpServerBuilt ? <CheckCircle2 className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <strong>{t('agentSetup.mcp.server')}</strong>
                      <code>{setupInfo.mcpServerBuilt ? t('agentSetup.mcp.serverReady') : t('agentSetup.mcp.serverMissing')}</code>
                      <small>{t('agentSetup.mcp.serverHint')}</small>
                    </div>
                  </div>
                </div>

                {!setupInfo.mcpServerBuilt && (
                  <CodeBlock
                    code="pnpm --filter @l2d/mcp-server build"
                    label={t('agentSetup.mcp.build')}
                    copyKey="build"
                    copiedKey={copiedKey}
                    copyLabel={t('agentSetup.copy')}
                    copiedLabel={t('agentSetup.copied')}
                    onCopy={copy}
                    wrap
                  />
                )}

                <section className="agent-setup-config-section">
                  <div className="agent-setup-section-title">
                    <div>
                      <h3>{t('agentSetup.mcp.configTitle')}</h3>
                      <p>{t('agentSetup.mcp.configHint')}</p>
                    </div>
                    <div className="agent-setup-segmented" role="group" aria-label={t('agentSetup.mcp.formatLabel')}>
                      <button
                        type="button"
                        aria-pressed={mcpFormat === 'codex'}
                        onClick={() => setMcpFormat('codex')}
                      >
                        <Code2 className="h-3.5 w-3.5" />
                        {t('agentSetup.mcp.codex')}
                      </button>
                      <button
                        type="button"
                        aria-pressed={mcpFormat === 'json'}
                        onClick={() => setMcpFormat('json')}
                      >
                        <Braces className="h-3.5 w-3.5" />
                        {t('agentSetup.mcp.json')}
                      </button>
                    </div>
                  </div>

                  {mcpFormat === 'codex' ? (
                    <>
                      <CodeBlock
                        code={codexConfig}
                        label={t('agentSetup.mcp.codexConfigLabel')}
                        copyKey="codex-config"
                        copiedKey={copiedKey}
                        copyLabel={t('agentSetup.copy')}
                        copiedLabel={t('agentSetup.copied')}
                        onCopy={copy}
                      />
                      <div className="agent-setup-inline-note">
                        <FileCode2 className="h-3.5 w-3.5" />
                        <span>{t('agentSetup.mcp.codexHint')}</span>
                      </div>
                      <CodeBlock
                        code={codexCliCommand}
                        label={t('agentSetup.mcp.cliLabel')}
                        copyKey="codex-cli"
                        copiedKey={copiedKey}
                        copyLabel={t('agentSetup.copy')}
                        copiedLabel={t('agentSetup.copied')}
                        onCopy={copy}
                      />
                    </>
                  ) : (
                    <>
                      <CodeBlock
                        code={genericJsonConfig}
                        label={t('agentSetup.mcp.jsonConfigLabel')}
                        copyKey="json-config"
                        copiedKey={copiedKey}
                        copyLabel={t('agentSetup.copy')}
                        copiedLabel={t('agentSetup.copied')}
                        onCopy={copy}
                      />
                      <div className="agent-setup-inline-note">
                        <Clipboard className="h-3.5 w-3.5" />
                        <span>{t('agentSetup.mcp.jsonHint')}</span>
                      </div>
                    </>
                  )}
                </section>

                {copyError && <p className="agent-setup-copy-error">{t('agentSetup.copyFailed')}</p>}
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="space-y-4">
                <section>
                  <div className="agent-setup-section-heading">
                    <BookOpen className="h-4 w-4 text-emerald-400" />
                    <div>
                      <h3>{t('agentSetup.skills.title')}</h3>
                      <p>{t('agentSetup.skills.description')}</p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-2 md:grid-cols-2">
                  {setupInfo.skills.map(skill => (
                    <article key={skill.id} className="agent-setup-skill-card">
                      <div className="flex items-center justify-between gap-2">
                        <code>${skill.id}</code>
                        <span className={skill.required ? 'is-required' : 'is-recommended'}>
                          {skill.required
                            ? t('agentSetup.skills.required')
                            : t('agentSetup.skills.recommended')}
                        </span>
                      </div>
                      <p>
                        {skill.id === 'l2deditor-mcp'
                          ? t('agentSetup.skills.mcpDescription')
                          : t('agentSetup.skills.modelingDescription')}
                      </p>
                      <small>{skill.path}</small>
                    </article>
                  ))}
                </div>

                <section className="agent-setup-config-section">
                  <div className="agent-setup-section-title">
                    <div>
                      <h3>{t('agentSetup.skills.installTitle')}</h3>
                      <p>{t('agentSetup.skills.installHint')}</p>
                    </div>
                    <div className="agent-setup-segmented" role="group" aria-label={t('agentSetup.skills.scopeLabel')}>
                      <button
                        type="button"
                        aria-pressed={skillScope === 'user'}
                        onClick={() => setSkillScope('user')}
                      >
                        {t('agentSetup.skills.userScope')}
                      </button>
                      <button
                        type="button"
                        aria-pressed={skillScope === 'repo'}
                        onClick={() => setSkillScope('repo')}
                      >
                        {t('agentSetup.skills.repoScope')}
                      </button>
                    </div>
                  </div>
                  <div className="agent-setup-inline-note">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>
                      {skillScope === 'user'
                        ? t('agentSetup.skills.userPathHint')
                        : t('agentSetup.skills.repoPathHint')}
                    </span>
                  </div>
                  <CodeBlock
                    code={skillInstallCommand}
                    label={t('agentSetup.skills.commandLabel')}
                    copyKey={`skills-${skillScope}`}
                    copiedKey={copiedKey}
                    copyLabel={t('agentSetup.copy')}
                    copiedLabel={t('agentSetup.copied')}
                    onCopy={copy}
                    wrap
                  />
                  <div className="agent-setup-inline-note">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t('agentSetup.skills.detectionHint')}</span>
                  </div>
                </section>

                {copyError && <p className="agent-setup-copy-error">{t('agentSetup.copyFailed')}</p>}
              </div>
            )}

            {activeTab === 'verify' && (
              <div className="space-y-4">
                <section>
                  <div className="agent-setup-section-heading">
                    <BadgeCheck className="h-4 w-4 text-blue-400" />
                    <div>
                      <h3>{t('agentSetup.verify.title')}</h3>
                      <p>{t('agentSetup.verify.description')}</p>
                    </div>
                  </div>
                </section>

                <ol className="agent-setup-steps">
                  {[
                    t('agentSetup.verify.stepBuild'),
                    t('agentSetup.verify.stepRestart'),
                    t('agentSetup.verify.stepState'),
                    t('agentSetup.verify.stepPrompt'),
                  ].map((step, index) => (
                    <li key={step}>
                      <span>{index + 1}</span>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>

                <section className="agent-setup-config-section">
                  <div className="agent-setup-section-title">
                    <div>
                      <h3>{t('agentSetup.verify.promptTitle')}</h3>
                      <p>{t('agentSetup.verify.promptHint')}</p>
                    </div>
                  </div>
                  <CodeBlock
                    code={verificationPrompt}
                    label={t('agentSetup.verify.promptLabel')}
                    copyKey="verify-prompt"
                    copiedKey={copiedKey}
                    copyLabel={t('agentSetup.copy')}
                    copiedLabel={t('agentSetup.copied')}
                    onCopy={copy}
                    wrap
                  />
                </section>

                <section>
                  <h3 className="agent-setup-small-title">{t('agentSetup.verify.expectedTitle')}</h3>
                  <div className="agent-setup-tool-list">
                    {[
                      'l2d_gui_state',
                      'l2d_gui_exec',
                      'l2d_gui_history',
                      'l2d_gui_screenshot',
                      'l2d_gui_save',
                    ].map(tool => <code key={tool}>{tool}</code>)}
                  </div>
                  <p className="agent-setup-security-note">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{t('agentSetup.verify.security')}</span>
                  </p>
                </section>

                {copyError && <p className="agent-setup-copy-error">{t('agentSetup.copyFailed')}</p>}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
