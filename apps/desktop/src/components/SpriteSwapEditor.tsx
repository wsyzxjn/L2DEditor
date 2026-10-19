import { useState } from 'react';
import type { ArtMeshData, Node } from '@l2d/schema';
import { useEditor, useEditorRuntime } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';

export function SpriteSwapEditor({ node }: { node: Omit<Node, 'kind'> & { kind: ArtMeshData & { type: 'ArtMesh' } } }) {
  const { project, executeCommand, notify } = useEditor();
  const { parameterValues, setParameterValue } = useEditorRuntime();
  const { t } = useI18n();
  const siblings = project.nodes.filter(sibling => sibling.id.startsWith(`${node.id}_sprite_`) && sibling.parent_id === node.parent_id && sibling.kind.type === 'ArtMesh');
  const binding = project.keyforms.find(binding => binding.target_node_id === node.id);
  const [parameterId, setParameterId] = useState((siblings.length ? binding?.dimensions.at(-1)?.param_id : undefined) ?? project.parameters.find(parameter => parameter.id === 'ParamEyeLOpen')?.id ?? project.parameters[0]?.id ?? '');
  const parameter = project.parameters.find(parameter => parameter.id === parameterId);
  const [states, setStates] = useState(() => [node, ...siblings].map(sibling => {
    if (sibling.kind.type !== 'ArtMesh') throw new Error('Expected mesh');
    const stateBinding = project.keyforms.find(binding => binding.target_node_id === sibling.id);
    const axis = stateBinding?.dimensions.findIndex(dimension => dimension.param_id === parameterId) ?? -1;
    const active = stateBinding?.keyforms.find(form => form.payload.kind === 'ArtMesh' && (form.payload.opacity ?? 1) > 1e-6);
    return {
      id: sibling.id, value: String(axis >= 0 && active ? active.coordinates[axis] : parameter?.default ?? 0), texture: sibling.kind.texture_id,
      x: String((sibling.kind.vertices[0]?.[0] ?? 0) - (node.kind.vertices[0]?.[0] ?? 0)), y: String((sibling.kind.vertices[0]?.[1] ?? 0) - (node.kind.vertices[0]?.[1] ?? 0)),
    };
  }));
  const configured = siblings.length > 0;
  const fieldClass = 'h-6 min-w-0 w-full px-1 text-dcc bg-dcc-bg border border-dcc-border rounded';
  const update = (index: number, changes: Partial<typeof states[number]>) => setStates(previous => previous.map((state, i) => i === index ? { ...state, ...changes } : state));
  return (
    <details className="pt-2 border-t border-dcc-border space-y-2">
      <summary className="cursor-pointer text-dcc-sm font-semibold text-dcc-muted">{t('sprite.title')}</summary>
      <p className="text-dcc-sm text-dcc-muted">{t('sprite.description')}</p>
      <label className="block text-dcc-sm">{t('sprite.parameter')}
        <select className={fieldClass} value={parameterId} disabled={configured} onChange={event => setParameterId(event.target.value)}>
          {project.parameters.map(parameter => <option key={parameter.id} value={parameter.id}>{parameter.name} ({parameter.id})</option>)}
        </select>
      </label>
      {states.map((state, index) => (
        <div key={state.id} className="space-y-1 rounded border border-dcc-border p-1.5">
          <div className="flex items-center justify-between text-dcc-sm text-dcc-muted">
            <span>{index === 0 ? t('sprite.base') : `${t('sprite.state')} ${index}`}</span>
            {index > 0 && <button type="button" disabled={project.nodes.some(node => node.id === state.id)} aria-label={`${t('sprite.remove')} ${index}`} onClick={() => setStates(previous => previous.filter(item => item.id !== state.id))}>{t('sprite.remove')}</button>}
          </div>
          <label className="block text-dcc-sm">{t('sprite.texture')}
            <select className={fieldClass} value={state.texture} disabled={index === 0} onChange={event => update(index, { texture: event.target.value })}>
              {project.textures.map(texture => <option key={texture.id} value={texture.id}>{texture.id}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-1">
            <label className="text-dcc-sm">{t('sprite.value')}<input className={fieldClass} type="number" step="any" disabled={configured} value={state.value} onChange={event => update(index, { value: event.target.value })} /></label>
            <label className="text-dcc-sm">X<input aria-label={`${t('sprite.offset')} X ${index}`} className={fieldClass} type="number" step="any" disabled={index === 0} value={state.x} onChange={event => update(index, { x: event.target.value })} /></label>
            <label className="text-dcc-sm">Y<input aria-label={`${t('sprite.offset')} Y ${index}`} className={fieldClass} type="number" step="any" disabled={index === 0} value={state.y} onChange={event => update(index, { y: event.target.value })} /></label>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" className="text-dcc-sm px-2 py-1 border border-dcc-border rounded disabled:opacity-40" disabled={!parameter || configured} onClick={() => setStates(previous => [...previous, { id: `${node.id}_sprite_${crypto.randomUUID()}`, value: String(parameter!.min), texture: project.textures.find(texture => texture.id !== node.kind.texture_id)?.id ?? node.kind.texture_id, x: '0', y: '0' }])}>{t('sprite.add')}</button>
        <button type="button" className="text-dcc-sm px-2 py-1 bg-blue-600 rounded disabled:opacity-40" disabled={!parameter || states.length < 2 || node.locked} onClick={() => {
          const number = (value: string) => value.trim() ? Number(value) : NaN;
          const result = executeCommand({ id: `sprite_${Date.now()}`, name: 'macro.sprite_swap', params: { base_node_id: node.id, param_id: parameterId, states: states.map(state => ({ node_id: state.id, texture_id: state.texture, value: number(state.value), offset: [number(state.x), number(state.y)] })) } });
          if (result.success) notify(t('sprite.applied'), 'success');
        }}>{t('sprite.apply')}</button>
      </div>
      {parameter && <label className="block text-dcc-sm">{t('sprite.preview')} ({parameterValues[parameter.id] ?? parameter.default})
        <input className="w-full" type="range" min={parameter.min} max={parameter.max} step={(parameter.max - parameter.min) / 200} value={parameterValues[parameter.id] ?? parameter.default} onChange={event => setParameterValue(parameter.id, Number(event.target.value))} />
      </label>}
    </details>
  );
}
