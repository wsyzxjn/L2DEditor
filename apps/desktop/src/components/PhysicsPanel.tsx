import React, { useState } from 'react';
import { useEditor } from '../context/EditorContext.js';
import { Zap, Plus, Trash2, Sliders, Activity } from 'lucide-react';
import { ScrubInput } from './ScrubInput.js';
import type { PhysicsGroup } from '@l2d/schema';

export const PhysicsPanel: React.FC = () => {
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
      id: `cmd_${Date.now()}`,
      name: 'physics.add_group',
      params: newGroup,
    });
    setSelectedGroupId(id);
    notify(`Created Physics Group: ${name}`, 'success');
  };

  const handleDeleteGroup = (id: string) => {
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'physics.delete_group',
      params: { id },
    });
    notify('Deleted Physics Group', 'info');
  };

  const updateGroup = (updated: PhysicsGroup) => {
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'physics.add_group',
      params: updated,
    });
  };

  return (
    <div className="flex flex-col h-full bg-dcc-panel border-l border-dcc-border select-none">
      {/* Header */}
      <div className="flex items-center justify-between h-7 px-2 border-b border-dcc-border bg-dcc-header">
        <div className="flex items-center space-x-1.5 text-dcc font-semibold uppercase tracking-wider text-dcc-muted">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Physics Setting</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            className={`flex items-center px-1.5 py-0.5 text-dcc-sm rounded font-medium transition-colors ${
              isPhysicsEnabled ? 'bg-amber-600/30 text-amber-300' : 'bg-zinc-800 text-zinc-400'
            }`}
            onClick={() => setIsPhysicsEnabled(!isPhysicsEnabled)}
          >
            <Activity className="w-3 h-3 mr-0.5" /> Live
          </button>
          <button
            className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded"
            onClick={handleAddGroup}
            title="Add Physics Group"
          >
            <Plus className="w-3 h-3 mr-0.5" /> Group
          </button>
        </div>
      </div>

      {/* Official Cubism 5.3 Physics Presets Bar (`default_physics_preset40.xml`) */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-dcc-border bg-dcc-bg/60 space-x-1.5">
        <span className="text-[10px] font-semibold uppercase text-zinc-400 shrink-0">Preset:</span>
        <select
          className="flex-1 h-5 px-1 text-dcc-sm bg-dcc-panel border border-dcc-border rounded text-dcc-text"
          defaultValue=""
          onChange={(e) => {
            const preset = e.target.value as any;
            if (!preset) return;
            executeCommand({
              id: `cmd_${Date.now()}`,
              name: 'physics.apply_preset',
              params: {
                group_id: selectedGroup?.id,
                preset,
                input_preset: 'head_input',
              },
            });
            notify(`Applied Cubism 5.3 Physics Preset: ${preset}`, 'success');
            e.target.value = '';
          }}
        >
          <option value="" disabled>Apply Official Rig Preset...</option>
          <option value="hair_short">髪（短い） / Hair Short</option>
          <option value="hair_long">髪（長い） / Hair Long</option>
          <option value="hair_2stage">髪 2段振り子 / Hair 2-Stage</option>
          <option value="hair_3stage">髪 3段振り子 / Hair 3-Stage</option>
          <option value="cloth_light">服（軽い） / Cloth Light</option>
          <option value="cloth_heavy">服（重い） / Cloth Heavy</option>
          <option value="bust_small">胸（小さい） / Bust Small</option>
          <option value="bust_large">胸（大きい） / Bust Large</option>
          <option value="pendulum_10stage">10段振り子 / 10-Stage</option>
          <option value="pendulum_20stage">20段振り子 / 20-Stage</option>
        </select>
      </div>

      {groups.length === 0 ? (
        <div className="p-4 text-center text-dcc text-dcc-muted">
          No physics groups. Click + Group to add hair/clothing sway physics.
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
                    ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
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
                  className="p-1 hover:text-rose-400 text-zinc-500 rounded"
                  onClick={() => handleDeleteGroup(selectedGroup.id)}
                  title="Delete Group"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1. Input Parameters */}
              <div className="bg-dcc-bg/40 p-2 rounded border border-dcc-border/60 space-y-1.5">
                <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">Input Movement</span>
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
                    className="p-0.5 text-zinc-400 hover:text-amber-400"
                    onClick={() => {
                      const nextP = [...selectedGroup.pendulums, { length: 50.0, damping: 0.85, mass: 1.0 }];
                      updateGroup({ ...selectedGroup, pendulums: nextP });
                    }}
                    title="Add Pendulum Node"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {selectedGroup.pendulums.map((pend, pidx) => (
                  <div key={pidx} className="bg-dcc-panel p-1.5 rounded border border-dcc-border/40 space-y-1">
                    <div className="text-dcc-sm text-zinc-400 font-mono">Node #{pidx + 1}</div>
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
                <span className="text-dcc-sm font-semibold text-dcc-muted uppercase">Output Parameter</span>
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
