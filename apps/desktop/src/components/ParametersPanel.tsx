import React from 'react';
import { useEditor } from '../context/EditorContext.js';
import { ScrubInput } from './ScrubInput.js';
import { Plus, SlidersHorizontal } from 'lucide-react';

export const ParametersPanel: React.FC = () => {
  const { project, parameterValues, setParameterValue, executeCommand, selectedNodeId, notify } = useEditor();

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

  // Find keyform points for selected node on this parameter
  const getKeyformTicks = (paramId: string): number[] => {
    if (!selectedNodeId) return [];
    const binding = project.keyforms.find((k) => k.target_node_id === selectedNodeId);
    if (!binding) return [];
    const dim = binding.dimensions.find((d) => d.param_id === paramId);
    return dim ? dim.keys : [];
  };

  return (
    <div className="flex flex-col h-full bg-dcc-panel border-l border-dcc-border">
      {/* Header */}
      <div className="flex items-center justify-between h-7 px-2 border-b border-dcc-border bg-dcc-header">
        <div className="flex items-center space-x-1.5 text-dcc font-semibold uppercase tracking-wider text-dcc-muted">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Parameters</span>
        </div>
        <button
          className="flex items-center px-1.5 py-0.5 text-dcc-sm bg-dcc-hover hover:bg-zinc-700 text-dcc-text rounded transition-colors"
          onClick={handleAddParam}
          title="Add New Parameter"
        >
          <Plus className="w-3 h-3 mr-0.5" /> Add
        </button>
      </div>

      {/* Parameter List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {project.parameters.length === 0 ? (
          <div className="p-4 text-center text-dcc text-dcc-muted">No parameters. Click + Add to create one.</div>
        ) : (
          project.parameters.map((param) => {
            const val = parameterValues[param.id] ?? param.default;
            const ticks = getKeyformTicks(param.id);

            return (
              <div key={param.id} className="flex flex-col space-y-1 bg-dcc-bg/40 p-1.5 rounded border border-dcc-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-dcc font-medium text-dcc-text truncate">{param.name || param.id}</span>
                  <ScrubInput
                    value={val}
                    onChange={(v) => setParameterValue(param.id, v)}
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
                    onChange={(e) => setParameterValue(param.id, parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-dcc-accent"
                  />

                  {/* Ticks */}
                  {ticks.map((t, idx) => {
                    const pct = ((t - param.min) / (param.max - param.min)) * 100;
                    return (
                      <div
                        key={idx}
                        className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 pointer-events-none -translate-x-1/2"
                        style={{ left: `${pct}%`, top: '5px' }}
                        title={`Keyform at ${t}`}
                      />
                    );
                  })}
                </div>

                {/* Parameter range footer */}
                <div className="flex justify-between text-dcc-sm text-dcc-muted">
                  <span>{param.min}</span>
                  <span className="font-mono text-zinc-500">{param.id}</span>
                  <span>{param.max}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
