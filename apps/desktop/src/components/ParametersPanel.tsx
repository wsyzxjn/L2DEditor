import React, { useState } from 'react';
import { useEditor, useEditorRuntime } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { ScrubInput } from './ScrubInput.js';
import { OverflowMenu, OverflowMenuItem } from './OverflowMenu.js';
import { Plus, ListPlus, Folder, ChevronDown, ChevronRight, FolderPlus, RotateCcw, Lock, Unlock, Compass, Search } from 'lucide-react';
import type { Parameter } from '@l2d/schema';

export const ParametersPanel: React.FC = () => {
  const { t } = useI18n();
  const {
    project,
    parameterSearchQuery,
    setParameterSearchQuery,
    executeCommand,
    selectedNodeId,
    activeExpressionId,
    applyExpression,
    notify,
  } = useEditor();
  const { parameterValues, setParameterValue } = useEditorRuntime();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const handleAddParam = () => {
    const id = `ParamCustom_${Date.now()}`;
    const name = `Param ${project.parameters.length + 1}`;
    executeCommand({
      id: `cmd_${crypto.randomUUID()}`,
      name: 'parameter.add',
      params: {
        id,
        name,
        min: -30,
        max: 30,
        default: 0,
      },
    });
    notify(t('notify.param_created', { name }), 'success');
  };

  const handleAddGroup = () => {
    const id = `group_${Date.now()}`;
    const name = `Group ${(project.parameter_groups?.length || 0) + 1}`;
    executeCommand({
      id: `cmd_${crypto.randomUUID()}`,
      name: 'parameter_group.add',
      params: { id, name, collapsed: false },
    });
    notify(t('notify.param_group_created', { name }), 'success');
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const getKeyformTicks = (paramId: string): number[] => {
    if (!selectedNodeId) return [];
    const binding = project.keyforms.find((k) => k.target_node_id === selectedNodeId);
    if (!binding) return [];
    const dim = binding.dimensions.find((d) => d.param_id === paramId);
    return dim ? dim.keys : [];
  };

  const renderParamItem = (param: Parameter) => {
    const val = parameterValues[param.id] ?? param.default;
    const ticks = getKeyformTicks(param.id);
    const span = param.max - param.min;

    // One compact row per parameter; the ID and range live in the tooltip.
    return (
      <div
        key={param.id}
        className="group flex items-center gap-1.5 h-7 px-1 rounded hover:bg-dcc-hover/50"
        title={`${param.name || param.id}\n${param.id}  [${param.min}, ${param.max}]`}
      >
        <button
          className="shrink-0 p-0.5 rounded text-zinc-600 hover:text-zinc-200"
          onClick={() => {
            executeCommand({
              id: `cmd_${crypto.randomUUID()}`,
              name: 'parameter.set_locked',
              params: { param_id: param.id, locked: !param.locked },
            });
          }}
          title={param.locked ? t('parameters.unlock_param') : t('parameters.lock_param')}
          aria-label={param.locked ? t('parameters.unlock_param') : t('parameters.lock_param')}
          aria-pressed={!!param.locked}
        >
          {param.locked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3" />}
        </button>
        <span className={`w-[38%] min-w-0 shrink-0 truncate text-dcc ${param.locked ? 'text-amber-300/80' : 'text-dcc-text'}`}>
          {param.name || param.id}
        </span>

        {/* Slider with keyform positions; double-click restores the default. */}
        <div className="relative flex min-w-0 flex-1 items-center h-4">
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={span / 200}
            value={val}
            disabled={param.locked}
            aria-label={param.name || param.id}
            onChange={(e) => !param.locked && setParameterValue(param.id, parseFloat(e.target.value))}
            onDoubleClick={() => !param.locked && setParameterValue(param.id, param.default)}
            className={`w-full h-1 bg-zinc-700 rounded-lg appearance-none ${param.locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer accent-dcc-accent'}`}
          />
          {ticks.map((tickVal, idx) => (
            <div
              key={idx}
              className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 pointer-events-none -translate-x-1/2"
              style={{ left: `${((tickVal - param.min) / span) * 100}%`, top: '5px' }}
              title={`${t('parameters.keyform_dot')}: ${tickVal}`}
            />
          ))}
        </div>
        <ScrubInput
          value={val}
          onChange={(v) => !param.locked && setParameterValue(param.id, v)}
          min={param.min}
          max={param.max}
          step={span / 100}
          className="w-14 shrink-0 h-5"
        />
      </div>
    );
  };

  const groups = project.parameter_groups || [];
  const groupedParamIds = new Set(project.parameters.filter((p) => p.group_id).map((p) => p.id));
  const ungroupedParams = project.parameters.filter((p) => !p.group_id);

  // Find standard 2D XY parameter pairs (e.g. Angle X & Angle Y, EyeBall X & EyeBall Y)
  const pAngleX = project.parameters.find((p) => p.id === 'ParamAngleX');
  const pAngleY = project.parameters.find((p) => p.id === 'ParamAngleY');
  const hasAngle2D = pAngleX && pAngleY;

  const valX = pAngleX ? parameterValues[pAngleX.id] ?? pAngleX.default : 0;
  const valY = pAngleY ? parameterValues[pAngleY.id] ?? pAngleY.default : 0;

  const handlePadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pAngleX || !pAngleY) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newX = pAngleX.min + normX * (pAngleX.max - pAngleX.min);
    const newY = pAngleY.max - normY * (pAngleY.max - pAngleY.min);
    setParameterValue(pAngleX.id, Math.round(newX * 10) / 10);
    setParameterValue(pAngleY.id, Math.round(newY * 10) / 10);
  };

  return (
    <div className="panel-root flex flex-col h-full bg-dcc-panel border-l border-dcc-border">
      {/* Toolbar: frequent actions stay visible, the rest live in the overflow menu. */}
      <div className="flex shrink-0 items-center gap-1 h-8 px-2 border-b border-dcc-border bg-dcc-header">
        <button
          className="btn btn-secondary"
          onClick={handleAddParam}
          title={t('parameters.add_param')}
          aria-label={t('parameters.add_param')}
        >
          <Plus className="w-3.5 h-3.5" /><span className="toolbar-label">{t('parameters.add_param')}</span>
        </button>
        <button
          className="btn"
          onClick={() => {
            for (const p of project.parameters) {
              setParameterValue(p.id, p.default);
            }
            notify(t('parameters.reset_all'), 'info');
          }}
          title={t('parameters.reset_all')}
          aria-label={t('parameters.reset_all')}
        >
          <RotateCcw className="w-3.5 h-3.5" /><span className="toolbar-label-optional">{t('parameters.reset_all')}</span>
        </button>
        <div className="flex-1" />
        <OverflowMenu label={t('common.more')}>
          <OverflowMenuItem icon={FolderPlus} label={t('parameters.add_group')} onSelect={handleAddGroup} />
          <OverflowMenuItem
            icon={ListPlus}
            label={t('parameters.preset')}
            onSelect={() => {
              executeCommand({
                id: `cmd_${crypto.randomUUID()}`,
                name: 'parameter.apply_standard_template',
                params: {},
              });
              notify(t('parameters.preset'), 'success');
            }}
          />
        </OverflowMenu>
      </div>

      {(project.expressions?.length ?? 0) > 0 && <div className="flex shrink-0 items-center gap-2 border-b border-dcc-border px-2 py-1">
        <select aria-label="Expression preview" value={activeExpressionId ?? ''} onChange={event => applyExpression(event.target.value || null)}
          className="h-6 min-w-0 flex-1 rounded border border-dcc-border bg-dcc-bg px-1 text-dcc-sm text-dcc-text">
          <option value="">{t('parameters.expression_none')}</option>
          {project.expressions!.map(expression => <option key={expression.id} value={expression.id}>{expression.name || expression.id}</option>)}
        </select>
        <button onClick={() => applyExpression(null)} disabled={activeExpressionId === null}
          className="shrink-0 rounded px-2 py-0.5 text-dcc-sm text-dcc-muted hover:bg-dcc-hover disabled:opacity-40">
          {t('parameters.expression_clear')}
        </button>
      </div>}

      {/* Parameter Search Filter */}
      <div className="px-2 py-1 border-b border-dcc-border bg-dcc-bg/40 flex items-center space-x-1.5">
        <Search className="w-3 h-3 text-dcc-subtle shrink-0" />
        <input
          type="text"
          placeholder={t('parameters.filter_placeholder')}
          className="w-full h-5 bg-transparent text-dcc-sm text-dcc-text outline-none placeholder:text-zinc-600"
          value={parameterSearchQuery}
          onChange={(e) => setParameterSearchQuery(e.target.value)}
        />
      </div>

      {/* Parameter List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* 2D XY Joystick Pad (ParamAngleX / ParamAngleY) */}
        {hasAngle2D && (
          <div className="p-2 bg-dcc-bg/60 border border-dcc-border rounded space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-dcc-sm text-dcc-muted">
              <div className="flex min-w-0 items-center space-x-1 font-semibold">
                <Compass className="w-3.5 h-3.5 shrink-0 text-dcc-muted" />
                <span className="truncate" title={t('parameters.xy_pad')}>{t('parameters.xy_pad')}</span>
              </div>
              <span className="shrink-0 font-mono text-dcc-xs text-dcc-muted">
                ({valX.toFixed(1)}, {valY.toFixed(1)})
              </span>
            </div>

            <div
              className="relative w-full h-24 bg-zinc-950 border border-zinc-700/60 rounded cursor-crosshair overflow-hidden select-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                handlePadPointer(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) handlePadPointer(e);
              }}
              onDoubleClick={() => {
                if (pAngleX && pAngleY) {
                  setParameterValue(pAngleX.id, pAngleX.default);
                  setParameterValue(pAngleY.id, pAngleY.default);
                }
              }}
              title={t('parameters.xy_pad_reset')}
            >
              {/* Crosshair lines */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-dcc-raised" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-dcc-raised" />

              {/* Indicator dot */}
              <div
                className="absolute w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform"
                style={{
                  left: `${((valX - pAngleX.min) / (pAngleX.max - pAngleX.min)) * 100}%`,
                  top: `${((pAngleY.max - valY) / (pAngleY.max - pAngleY.min)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {project.parameters.length === 0 ? (
          <div className="p-4 text-center text-dcc text-dcc-muted">{t('parameters.no_params')}</div>
        ) : (
          <>
            {/* Render groups */}
            {groups.map((group) => {
              let groupParams = project.parameters.filter((p) => p.group_id === group.id);
              if (parameterSearchQuery.trim()) {
                groupParams = groupParams.filter((p) =>
                  `${p.name} ${p.id}`.toLowerCase().includes(parameterSearchQuery.toLowerCase())
                );
              }
              const isCollapsed = collapsedGroups.has(group.id);
              if (parameterSearchQuery.trim() && groupParams.length === 0) return null;

              return (
                <div key={group.id} className="border border-dcc-border/60 rounded bg-dcc-panel/40 overflow-hidden">
                  <div
                    className="flex items-center justify-between h-6 px-2 bg-dcc-header/60 hover:bg-dcc-hover cursor-pointer text-dcc font-medium"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-center space-x-1.5">
                      {isCollapsed ? <ChevronRight className="w-3 h-3 text-dcc-subtle" /> : <ChevronDown className="w-3 h-3 text-dcc-muted" />}
                      <Folder className="w-3.5 h-3.5 text-dcc-muted" />
                      <span className="text-zinc-200">{group.name || group.id}</span>
                    </div>
                    <span className="text-dcc-xs font-mono text-dcc-subtle">{groupParams.length}</span>
                  </div>

                  {!isCollapsed && (
                    <div className="p-0.5">
                      {groupParams.length === 0 ? (
                        <div className="text-dcc-xs text-dcc-subtle px-2 py-1">{t('parameters.no_params_in_group')}</div>
                      ) : (
                        groupParams.map(renderParamItem)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Render ungrouped parameters */}
            <div>
            {ungroupedParams
              .filter((p) =>
                !parameterSearchQuery.trim() ||
                `${p.name} ${p.id}`.toLowerCase().includes(parameterSearchQuery.toLowerCase())
              )
              .map(renderParamItem)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
