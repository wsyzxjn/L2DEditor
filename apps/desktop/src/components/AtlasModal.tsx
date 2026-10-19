import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { Layers, Check, X, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import type { L2DApi } from '../../electron/preload.js';


interface AtlasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AtlasModal: React.FC<AtlasModalProps> = ({ open, onOpenChange }) => {
  const { t } = useI18n();
  const { project, executeCommand, currentFilePath, notify } = useEditor();
  const [atlasSize, setAtlasSize] = useState<number>(2048);
  const [padding, setPadding] = useState<number>(4);
  const [previewBuffer, setPreviewBuffer] = useState<string | null>(null);
  const [coveragePct, setCoveragePct] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const api = (window as unknown as { l2dApi?: L2DApi }).l2dApi;

  // Compute preview whenever atlasSize or padding changes
  const runPackPreview = async () => {
    try {
      if (api?.generateAtlas) {
        const res = await api.generateAtlas(project, atlasSize, padding, currentFilePath ?? undefined);
        if (!res.success) throw new Error(res.error);
        if (res.atlasList.length > 0) {
          setPreviewBuffer(`data:image/png;base64,${res.atlasList[0].base64}`);
          setCoveragePct(Math.min(95, Math.round((project.nodes.filter(n => n.kind.type === 'ArtMesh').length * 200 * 200 / (atlasSize * atlasSize)) * 100)));
        }
      }
    } catch (e: any) {
      setPreviewBuffer(null);
      notify(t('notify.atlas_failed', { error: e?.message || e }), 'error');
    }
  };

  useEffect(() => {
    if (open) {
      runPackPreview();
    }
  }, [open, atlasSize, padding]);

  const handleApply = async () => {
    try {
      if (api?.generateAtlas) {
        const res = await api.generateAtlas(project, atlasSize, padding, currentFilePath ?? undefined);
        if (!res.success) throw new Error(res.error);
        {
          const meshes = res.updatedProject.nodes
            .filter((node: any) => node.kind?.type === 'ArtMesh')
            .map((node: any) => ({
              id: node.id,
              texture_id: node.kind.texture_id,
              uvs: node.kind.uvs,
            }));
          const result = executeCommand({
            id: `cmd_${crypto.randomUUID()}`,
            name: 'atlas.apply',
            params: {
              textures: res.updatedProject.textures,
              meshes,
            },
          });
          if (!result.success) {
            throw new Error(result.error || 'atlas.apply failed');
          }
          notify(t('notify.atlas_applied', { size: atlasSize }), 'success');
          onOpenChange(false);
        }
      } else {
        notify(t('notify.desktop_only'), 'info');
      }
    } catch (err: any) {
      notify(t('notify.atlas_failed', { error: err?.message || err }), 'error');
    }
  };

  if (!open) return null;

  const artMeshes = project.nodes.filter((n) => n.kind.type === 'ArtMesh');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm select-none">
      <div className="flex flex-col w-[920px] max-w-[94vw] h-[640px] max-h-[92vh] bg-dcc-panel border border-dcc-border rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between h-9 px-3 border-b border-dcc-border bg-dcc-header">
          <div className="flex items-center space-x-2 text-dcc font-semibold text-white">
            <Layers className="w-4 h-4 text-dcc-muted" />
            <span>{t('atlas.title')}</span>
          </div>
          <button
            className="p-1 text-dcc-muted hover:text-white rounded hover:bg-zinc-700"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Settings Sidebar */}
          <div className="w-72 border-r border-dcc-border bg-dcc-panel/80 p-3 flex flex-col space-y-4">
            <div>
              <label className="text-dcc-sm text-dcc-muted uppercase font-semibold">{t('atlas.size')}</label>
              <select
                className="w-full mt-1 h-7 px-2 text-dcc bg-dcc-bg border border-dcc-border rounded text-dcc-text outline-none"
                value={atlasSize}
                onChange={(e) => setAtlasSize(Number(e.target.value))}
              >
                <option value={1024}>1024 x 1024 px</option>
                <option value={2048}>2048 × 2048 px · {t('atlas.standard')}</option>
                <option value={4096}>4096 × 4096 px · {t('atlas.high_res')}</option>
              </select>
            </div>

            <div>
              <label className="text-dcc-sm text-dcc-muted uppercase font-semibold">{t('atlas.padding')}</label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="number"
                  min={1}
                  max={32}
                  className="w-full h-7 px-2 text-dcc bg-dcc-bg border border-dcc-border rounded text-dcc-text outline-none font-mono"
                  value={padding}
                  onChange={(e) => setPadding(Math.max(1, Number(e.target.value)))}
                />
                <span className="text-dcc-sm text-dcc-subtle font-mono">px</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 border-t border-dcc-border pt-2">
              <span className="text-dcc-sm text-dcc-muted uppercase font-semibold mb-1">
                Included Meshes ({artMeshes.length})
              </span>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {artMeshes.map((mesh) => (
                  <div
                    key={mesh.id}
                    className="flex items-center justify-between h-6 px-1.5 bg-dcc-bg/60 rounded border border-dcc-border/40 text-dcc-sm"
                  >
                    <span className="truncate text-dcc-text">{mesh.name || mesh.id}</span>
                    <span className="text-emerald-400 font-mono text-dcc-xs">{t('atlas.packed')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coverage info */}
            <div className="bg-dcc-bg p-2 rounded border border-dcc-border text-dcc-sm flex justify-between items-center font-mono">
              <span className="text-dcc-muted">{t('atlas.coverage')}</span>
              <span className="text-blue-400 font-semibold">{coveragePct}%</span>
            </div>

            {/* Action buttons */}
            <div className="flex space-x-2 pt-2">
              <button
                className="flex-1 flex items-center justify-center h-8 text-dcc bg-dcc-raised hover:bg-zinc-700 text-zinc-200 rounded border border-dcc-border font-medium transition-colors"
                onClick={runPackPreview}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t('atlas.pack_button')}
              </button>
              <button
                className="flex-1 flex items-center justify-center h-8 text-dcc bg-blue-600 hover:bg-blue-500 text-white rounded font-medium shadow transition-colors"
                onClick={handleApply}
              >
                <Check className="w-3.5 h-3.5 mr-1" /> {t('atlas.apply_button')}
              </button>
            </div>
          </div>

          {/* Right Atlas Preview Canvas */}
          <div className="flex-1 bg-dcc-canvas flex items-center justify-center p-4 relative overflow-hidden">
            {previewBuffer ? (
              <div className="relative border border-zinc-700 shadow-2xl bg-zinc-900/60 checkerboard-bg">
                <img
                  src={previewBuffer}
                  alt="Atlas Preview"
                  className="max-h-[540px] max-w-[540px] object-contain"
                />
              </div>
            ) : (
              <div className="text-dcc text-dcc-muted flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-dcc-muted" />
                <span>{t('atlas.computing')}</span>
              </div>
            )}

            <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 backdrop-blur rounded text-dcc-sm font-mono text-dcc-muted">
              {atlasSize} x {atlasSize} px
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
