import React, { useState } from 'react';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { Plus, Trash2, Sliders, Activity } from 'lucide-react';
import { ScrubInput } from './ScrubInput.js';
import type { PhysicsGroup } from '@l2d/schema';

export const PhysicsPanel: React.FC = () => {
  const { t } = useI18n();
  const { project, executeCommand, notify, isPhysicsEnabled, setIsPhysicsEnabled } = useEditor();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    project.physics?.[0]?.id || null
  );

  const groups = project.physics || [];
  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

  const handleAddGroup = () => {
    const id = `physics_${Date.now()}`;
    const name = `Physics Group ${groups.length + 1}`;
    const newGroup: PhysicsGroup = {
      id,
      name,
      inputs: [
        {
          param_id: project.parameters[0]?.id || 'ParamAngleX',
          weight: 1.0,
          reflect: false,
        },
      ],
      outputs: [
        {
          param_id: project.parameters.find((p) => p.id.includes('Hair'))?.id || project.parameters[0]?.id || 'ParamAngleX',
          pendulum_index: 0,
          angle_scale: 0.05,
          weight: 1.0,
        },
      ],
      pendulums: [
        { length: 60.0, damping: 0.85, mass: 1.0 },
      ],
    };

    executeCommand({
      id: `cmd_${crypto.randomUUID()}`,
      name: 'physics.add_group',
      params: newGroup,
    });
    setSelectedGroupId(id);
    notify(t('notify.physics_group_created', { name }), 'success');
  };

  const handleDeleteGroup = (id: string) => {
    executeCommand({
      id: `cmd_${crypto.randomUUID()}`,
      name: 'physics.delete_group',
      params: { id },
    });
    notify(t('notify.physics_group_deleted'), 'info');
  };

  const updateGroup = (updated: PhysicsGroup) => {
    executeCommand({
      id: `cmd_${crypto.randomUUID()}`,
      name: 'physics.add_group',
      params: updated,
    });
  };

  return (
    <div className="panel-root flex flex-col h-full bg-dcc-panel border-l border-dcc-border select-none">
      <div className="flex shrink-0 items-center gap-1 h-8 px-2 border-b border-dcc-border bg-dcc-header">
        <button
          className="btn btn-secondary"
          onClick={handleAddGroup}
          title={t('physics.add_group')}
          aria-label={t('physics.add_group')}
        >
          <Plus className="w-3.5 h-3.5" /><span className="toolbar-label">{t('physics.add_group')}</span>
        </button>
        <div className="flex-1" />
        <button
          className="btn"
          onClick={() => setIsPhysicsEnabled(!isPhysicsEnabled)}
          aria-pressed={isPhysicsEnabled}
          title={t('viewport.physics')}
        >
          <Activity className="w-3.5 h-3.5" /><span className="toolbar-label-optional">{t('physics.live')}</span>
        </button>
      </div>

      {/* Official Cubism 5.3 Physics Presets Bar (`default_physics_preset40.xml`) */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-dcc-border bg-dcc-bg/60 space-x-1.5">
        <span className="text-[10px] font-semibold uppercase text-dcc-muted shrink-0">{t('physics.presets')}:</span>
        <select
          className="flex-1 h-5 px-1 text-dcc-sm bg-dcc-panel border border-dcc-border rounded text-dcc-text"
          defaultValue=""
          onChange={(e) => {
            const preset = e.target.value as any;
            if (!preset) return;
            executeCommand({
              id: `cmd_${crypto.randomUUID()}`,
              name: 'physics.apply_preset',
              params: {
                group_id: selectedGroup?.id,
                preset,
                input_preset: 'head_input',
              },
            });
            notify(t('notify.physics_preset', { name: preset }), 'success');
            e.target.value = '';
          }}
        >
          <option value="" disabled>{t('physics.preset_placeholder')}</option>
          <option value="hair_short">{t('physics.preset_hair_short')}</option>
          <option value="hair_long">{t('physics.preset_hair_long')}</option>
          <option value="hair_2stage">{t('physics.preset_hair_2stage')}</option>
          <option value="hair_3stage">{t('physics.preset_hair_3stage')}</option>
          <option value="cloth_light">{t('physics.preset_cloth_light')}</option>
          <option value="cloth_heavy">{t('physics.preset_cloth_heavy')}</option>
          <option value="bust_small">{t('physics.preset_bust_small')}</option>
          <option value="bust_large">{t('physics.preset_bust_large')}</option>
          <option value="pendulum_10stage">{t('physics.preset_pendulum_10stage')}</option>
          <option value="pendulum_20stage">{t('physics.preset_pendulum_20stage')}</option>
        </select>
      </div>

      {groups.length === 0 ? (
        <div className="p-4 text-center text-dcc text-dcc-muted">
          {t('physics.no_groups')}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Groups Tabs */}
          <div className="flex overflow-x-auto border-b border-dcc-border bg-dcc-header/40 px-1 py-1 space-x-1">
            {groups.map((g) => (
              <button
                key={g.id}
                className={`px-2 py-0.5 text-dcc-sm rounded whitespace-nowrap transition-colors ${
                  selectedGroup?.id === g.id
                    ? 'bg-dcc-hover text-dcc-text font-medium shadow-[inset_0_-2px_0_#3b82f6]'
                    : 'text-dcc-muted hover:text-zinc-200'
                }`}
                onClick={() => setSelectedGroupId(g.id)}
              >
                {g.name || g.id}
              </button>
            ))}
          </div>

          {selectedGroup && (
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {/* Group Name & Delete */}
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  className="h-6 px-1.5 text-dcc bg-dcc-bg border border-dcc-border rounded text-dcc-text outline-none font-medium flex-1 mr-2"
                  value={selectedGroup.name}
                  onChange={(e) => updateGroup({ ...selectedGroup, name: e.target.value })}
                />
                <button
                  className="p-1 hover:text-rose-400 text-dcc-subtle rounded"
                  onClick={() => handleDeleteGroup(selectedGroup.id)}
                  title={t('physics.delete_group')}
                  aria-label={t('physics.delete_group')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1. Input Parameters */}
              <div className="bg-dcc-bg/40 p-2 rounded border border-dcc-border/60 space-y-1.5">
                <span className="text-dcc-sm font-semibold text-dcc-muted ">{t('physics.input')}</span>
                {selectedGroup.inputs.map((inp, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <select
                      className="flex-1 h-6 px-1.5 text-dcc bg-dcc-bg border border-dcc-border rounded text-dcc-text"
                      value={inp.param_id}
                      onChange={(e) => {
                        const nextInp = [...selectedGroup.inputs];
                        nextInp[idx].param_id = e.target.value;
                        updateGroup({ ...selectedGroup, inputs: nextInp });
                      }}
                    >
                      {project.parameters.map((p) => (
                        <option key={p.id} value={p.id}>{p.name || p.id}</option>
                      ))}
                    </select>
                    <ScrubInput
                      label="Weight"
                      value={inp.weight}
                      onChange={(w) => {
                        const nextInp = [...selectedGroup.inputs];
                        nextInp[idx].weight = w;
                        updateGroup({ ...selectedGroup, inputs: nextInp });
                      }}
                      min={0}
                      max={10}
                      step={0.1}
                      className="w-24"
                    />
                  </div>
                ))}
              </div>

              {/* 2. Pendulum Chain */}
              <div className="bg-dcc-bg/40 p-2 rounded border border-dcc-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">Pendulums ({selectedGroup.pendulums.length})</span>
                  <button
                    className="p-0.5 text-dcc-muted hover:text-amber-400"
                    onClick={() => {
                      const nextP = [...selectedGroup.pendulums, { length: 50.0, damping: 0.85, mass: 1.0 }];
                      updateGroup({ ...selectedGroup, pendulums: nextP });
                    }}
                    title={t('physics.add_node')}
                    aria-label={t('physics.add_node')}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {selectedGroup.pendulums.map((pend, pidx) => (
                  <div key={pidx} className="bg-dcc-panel p-1.5 rounded border border-dcc-border/40 space-y-1">
                    <div className="text-dcc-xs text-dcc-muted font-mono">{t('physics.node', { index: pidx + 1 })}</div>
                    <div className="grid grid-cols-3 gap-1">
                      <ScrubInput
                        label="Len"
                        value={pend.length}
                        onChange={(v) => {
                          const nextP = [...selectedGroup.pendulums];
                          nextP[pidx].length = v;
                          updateGroup({ ...selectedGroup, pendulums: nextP });
                        }}
                        min={5}
                        max={300}
                        step={1}
                      />
                      <ScrubInput
                        label="Damp"
                        value={pend.damping}
                        onChange={(v) => {
                          const nextP = [...selectedGroup.pendulums];
                          nextP[pidx].damping = v;
                          updateGroup({ ...selectedGroup, pendulums: nextP });
                        }}
                        min={0.1}
                        max={0.99}
                        step={0.02}
                      />
                      <ScrubInput
                        label="Mass"
                        value={pend.mass}
                        onChange={(v) => {
                          const nextP = [...selectedGroup.pendulums];
                          nextP[pidx].mass = v;
                          updateGroup({ ...selectedGroup, pendulums: nextP });
                        }}
                        min={0.1}
                        max={10}
                        step={0.1}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 3. Output Parameters */}
              <div className="bg-dcc-bg/40 p-2 rounded border border-dcc-border/60 space-y-1.5">
                <span className="text-dcc-sm font-semibold text-dcc-muted ">{t('physics.output')}</span>
                {selectedGroup.outputs.map((out, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <select
                      className="flex-1 h-6 px-1.5 text-dcc bg-dcc-bg border border-dcc-border rounded text-dcc-text"
                      value={out.param_id}
                      onChange={(e) => {
                        const nextOut = [...selectedGroup.outputs];
                        nextOut[idx].param_id = e.target.value;
                        updateGroup({ ...selectedGroup, outputs: nextOut });
                      }}
                    >
                      {project.parameters.map((p) => (
                        <option key={p.id} value={p.id}>{p.name || p.id}</option>
                      ))}
                    </select>
                    <ScrubInput
                      label="Scale"
                      value={out.angle_scale}
                      onChange={(s) => {
                        const nextOut = [...selectedGroup.outputs];
                        nextOut[idx].angle_scale = s;
                        updateGroup({ ...selectedGroup, outputs: nextOut });
                      }}
                      step={0.01}
                      className="w-24"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
