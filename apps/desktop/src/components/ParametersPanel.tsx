import React, { useState } from 'react';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { ScrubInput } from './ScrubInput.js';
import { Plus, SlidersHorizontal, Folder, ChevronDown, ChevronRight, FolderPlus, RotateCcw, Lock, Unlock, Compass } from 'lucide-react';
import type { Parameter } from '@l2d/schema';

export const ParametersPanel: React.FC = () => {
  const { t } = useI18n();
  const { project, parameterValues, setParameterValue, executeCommand, selectedNodeId, notify } = useEditor();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const handleAddParam = () => {
    const id = `ParamCustom_${Date.now()}`;
    const name = `Param ${project.parameters.length + 1}`;
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'parameter.add',
      params: {
        id,
        name,
        min: -30,
        max: 30,
        default: 0,
      },
    });
    notify(`Created Parameter: ${name}`, 'success');
  };

  const handleAddGroup = () => {
    const id = `group_${Date.now()}`;
    const name = `Group ${(project.parameter_groups?.length || 0) + 1}`;
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'parameter_group.add',
      params: { id, name, collapsed: false },
    });
    notify(`Created Parameter Group: ${name}`, 'success');
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

    return (
      <div key={param.id} className="flex flex-col space-y-1 bg-dcc-bg/40 p-1.5 rounded border border-dcc-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 truncate flex-1 mr-2">
            <button
              className="p-0.5 rounded text-zinc-500 hover:text-white"
              onClick={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'parameter.set_locked',
                  params: { param_id: param.id, locked: !param.locked },
                });
              }}
              title={param.locked ? t('parameters.unlock_param') : t('parameters.lock_param')}
            >
              {param.locked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3 text-zinc-600 hover:text-zinc-400" />}
            </button>
            <span className={`text-dcc font-medium truncate ${param.locked ? 'text-amber-300/80' : 'text-dcc-text'}`}>
              {param.name || param.id}
            </span>
          </div>
          <ScrubInput
            value={val}
            onChange={(v) => !param.locked && setParameterValue(param.id, v)}
            min={param.min}
            max={param.max}
            step={(param.max - param.min) / 100}
            className="w-20"
          />
        </div>

        {/* Slider Track with Keyform Dots */}
        <div className="relative flex items-center h-4">
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={(param.max - param.min) / 200}
            value={val}
            disabled={param.locked}
            onChange={(e) => !param.locked && setParameterValue(param.id, parseFloat(e.target.value))}
            className={`w-full h-1 bg-zinc-700 rounded-lg appearance-none ${param.locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer accent-dcc-accent'}`}
          />

          {ticks.map((tickVal, idx) => {
            const pct = ((tickVal - param.min) / (param.max - param.min)) * 100;
            return (
              <div
                key={idx}
                className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 pointer-events-none -translate-x-1/2"
                style={{ left: `${pct}%`, top: '5px' }}
                title={`${t('parameters.keyform_dot')}: ${tickVal}`}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-dcc-sm text-dcc-muted">
          <span>{param.min}</span>
          <span className="font-mono text-zinc-500">{param.id}</span>
          <span>{param.max}</span>
        </div>
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
    <div className="flex flex-col h-full bg-dcc-panel border-l border-dcc-border">
      {/* Header */}
      <div className="flex items-center justify-between h-7 px-2 border-b border-dcc-border bg-dcc-header">
        <div className="flex items-center space-x-1.5 text-dcc font-semibold uppercase tracking-wider text-dcc-muted">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{t('parameters.title')}</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded transition-colors"
            onClick={() => {
              for (const p of project.parameters) {
                setParameterValue(p.id, p.default);
              }
              notify(t('parameters.reset_all'), 'info');
            }}
            title={t('parameters.reset_all')}
          >
            <RotateCcw className="w-3 h-3 mr-0.5" /> {t('parameters.reset_all')}
          </button>
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded transition-colors"
            onClick={handleAddGroup}
            title={t('parameters.add_group')}
          >
            <FolderPlus className="w-3 h-3 mr-0.5" /> {t('parameters.add_group')}
          </button>
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded border border-blue-500/30 transition-colors"
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'parameter.apply_standard_template',
                params: {},
              });
              notify(t('parameters.preset'), 'success');
            }}
            title={t('parameters.preset')}
          >
            {t('parameters.preset')}
          </button>
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded transition-colors"
            onClick={handleAddParam}
            title={t('parameters.add_param')}
          >
            <Plus className="w-3 h-3 mr-0.5" /> {t('parameters.add_param')}
          </button>
        </div>
      </div>

      {/* Parameter List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* 2D XY Joystick Pad (ParamAngleX / ParamAngleY) */}
        {hasAngle2D && (
          <div className="p-2 bg-dcc-bg/60 border border-dcc-border rounded space-y-1.5">
            <div className="flex items-center justify-between text-dcc-sm text-dcc-muted">
              <div className="flex items-center space-x-1 font-semibold uppercase">
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span>{t('parameters.xy_pad')}</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-400">
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
              <div className="absolute top-1/2 left-0 right-0 h-px bg-zinc-800" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-800" />

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
              const groupParams = project.parameters.filter((p) => p.group_id === group.id);
              const isCollapsed = collapsedGroups.has(group.id);

              return (
                <div key={group.id} className="border border-dcc-border/60 rounded bg-dcc-panel/40 overflow-hidden">
                  <div
                    className="flex items-center justify-between h-6 px-2 bg-dcc-header/60 hover:bg-dcc-hover cursor-pointer text-dcc font-medium"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div className="flex items-center space-x-1.5">
                      {isCollapsed ? <ChevronRight className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-400" />}
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-zinc-200">{group.name || group.id}</span>
                    </div>
                    <span className="text-dcc-sm font-mono text-zinc-500">{groupParams.length}</span>
                  </div>

                  {!isCollapsed && (
                    <div className="p-1.5 space-y-1.5">
                      {groupParams.length === 0 ? (
                        <div className="text-[10px] text-zinc-500 italic px-2 py-1">{t('parameters.no_params_in_group')}</div>
                      ) : (
                        groupParams.map(renderParamItem)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Render ungrouped parameters */}
            {ungroupedParams.map(renderParamItem)}
          </>
        )}
      </div>
    </div>
  );
};
