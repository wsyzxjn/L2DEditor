import React, { useRef, useState } from 'react';
import { useEditor } from '../context/EditorContext.js';
import { useI18n } from '../i18n/index.js';
import { OverflowMenu, OverflowMenuItem } from './OverflowMenu.js';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Key,
  Plus,
  TrendingUp,
  List,
  Mic,
  Zap,
  Sparkles,
  Lock,
  Unlock,
} from 'lucide-react';
import { type Animation, analyzeWavForLipSync } from '@l2d/schema';

export const TimelinePanel: React.FC = () => {
  const { t } = useI18n();
  const {
    project,
    isPlayingAnimation,
    setIsPlayingAnimation,
    currentPlayheadFrame,
    setCurrentPlayheadFrame,
    activeAnimationId,
    setActiveAnimationId,
    parameterValues,
    waveformPeaks,
    setWaveformPeaks,
    executeCommand,
    notify,
  } = useEditor();

  const rulerRef = useRef<HTMLDivElement | null>(null);
  const wavInputRef = useRef<HTMLInputElement | null>(null);
  const [viewMode, setViewMode] = useState<'dopesheet' | 'graph'>('dopesheet');
  const [selectedTrackParamId, setSelectedTrackParamId] = useState<string>(
    project.parameters[0]?.id || 'ParamAngleX'
  );

  const activeAnim: Animation = project.animations?.find((a) => a.id === activeAnimationId) || {
    id: 'anim_default',
    name: 'Idle Motion',
    duration_frames: 60,
    fps: 30,
    loop_playback: true,
    tracks: [],
  };

  const duration = Math.max(30, activeAnim.duration_frames || 60);
  const selectedTrack = activeAnim.tracks.find((t) => t.target_param_id === selectedTrackParamId);
  const selectedParamMeta = project.parameters.find((p) => p.id === selectedTrackParamId);
  const paramMin = selectedParamMeta ? selectedParamMeta.min : -30;
  const paramMax = selectedParamMeta ? selectedParamMeta.max : 30;

  const handleCreateAnimation = () => {
    const id = `anim_${Date.now()}`;
    const newAnim: Animation = {
      id,
      name: `Motion ${(project.animations?.length || 0) + 1}`,
      duration_frames: 60,
      fps: 30,
      loop_playback: true,
      tracks: project.parameters.map((p) => ({
        target_param_id: p.id,
        keyframes: [
          { frame: 0, value: p.default, curve: 'linear' },
          { frame: 30, value: p.max * 0.5, curve: 'linear' },
          { frame: 60, value: p.default, curve: 'linear' },
        ],
      })),
    };
    executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'animation.add',
      params: newAnim,
    });
    setActiveAnimationId(id);
    notify(t('notify.motion_created', { name: newAnim.name }), 'success');
  };

  const handleAddKeyframeAtPlayhead = (paramId: string) => {
    const curVal = parameterValues[paramId] ?? 0;
    // Without saved motions the timeline shows a placeholder; store it before keying it.
    if (!project.animations?.some((animation) => animation.id === activeAnim.id)) {
      executeCommand({ id: `cmd_${Date.now()}`, name: 'animation.add', params: activeAnim });
      setActiveAnimationId(activeAnim.id);
    }
    const result = executeCommand({
      id: `cmd_${Date.now()}`,
      name: 'animation.set_keyframe',
      params: {
        animation_id: activeAnim.id,
        param_id: paramId,
        frame: Math.round(currentPlayheadFrame),
        value: curVal,
        curve: 'linear',
      },
    });
    if (result.success) notify(t('notify.keyframe_added', { frame: Math.round(currentPlayheadFrame), param: paramId }), 'success');
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetFrame = Math.round(pct * duration);
    setCurrentPlayheadFrame(targetFrame);
  };

  // Convert frame & value to Graph Editor SVG coords
  const frameToSvgX = (f: number, width: number) => (f / duration) * width;
  const valueToSvgY = (v: number, height: number) => {
    const pct = (v - paramMin) / (paramMax - paramMin || 1);
    return (1.0 - pct) * (height - 20) + 10;
  };

  const svgYToValue = (y: number, height: number) => {
    const pct = 1.0 - (y - 10) / (height - 20);
    return paramMin + pct * (paramMax - paramMin);
  };

  const isKeyed = (paramId: string) =>
    (activeAnim.tracks.find((track) => track.target_param_id === paramId)?.keyframes.length ?? 0) > 0;
  const orderedParams = [
    ...project.parameters.filter((param) => isKeyed(param.id)),
    ...project.parameters.filter((param) => !isKeyed(param.id)),
  ];
  const hasKeyframes = orderedParams.length > 0 && isKeyed(orderedParams[0].id);

  return (
    <div className="panel-root flex flex-col h-full bg-dcc-panel border-t border-dcc-border select-none">
      {/* Timeline Controls Header */}
      <div className="flex shrink-0 items-center gap-2 h-8 px-2 overflow-x-auto whitespace-nowrap [&>*]:shrink-0 border-b border-dcc-border bg-dcc-header">
        <div className="flex items-center space-x-1.5">

          {/* Transport buttons */}
          <button
            className="btn btn-icon"
            onClick={() => setIsPlayingAnimation(!isPlayingAnimation)}
            title={isPlayingAnimation ? t('timeline.pause') : t('timeline.play')}
            aria-label={isPlayingAnimation ? t('timeline.pause') : t('timeline.play')}
            aria-pressed={isPlayingAnimation}
          >
            {isPlayingAnimation ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            className="btn btn-icon"
            onClick={() => {
              setIsPlayingAnimation(false);
              setCurrentPlayheadFrame(0);
            }}
            title={t('timeline.stop')}
            aria-label={t('timeline.stop')}
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            className="btn btn-icon"
            aria-pressed={!!activeAnim.loop_playback}
            aria-label={t('timeline.loop')}
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'animation.add',
                params: { ...activeAnim, loop_playback: !activeAnim.loop_playback },
              });
            }}
            title={t('timeline.loop')}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-dcc-border mx-1" />

          {/* Frame Counter */}
          <div className="flex items-center space-x-1 text-dcc font-mono text-dcc-control bg-dcc-bg px-2 py-0.5 rounded border border-dcc-border">
            <span className="text-blue-400">{Math.round(currentPlayheadFrame)}</span>
            <span className="text-zinc-600">/</span>
            <span>{duration}</span>
            <span className="text-dcc-xs text-dcc-subtle ml-1">F</span>
          </div>

          <span className="toolbar-label-optional text-dcc-xs text-dcc-subtle font-mono">@{activeAnim.fps || 30}fps</span>
        </div>

        {/* View Mode Toggle: Dope Sheet vs Graph Editor */}
        <div className="flex items-center h-6 space-x-0.5 px-0.5 bg-dcc-bg/60 rounded border border-dcc-border">
          <button
            className="btn h-5 px-1.5"
            onClick={() => setViewMode('dopesheet')}
            title={t('timeline.dopesheet')}
            aria-label={t('timeline.dopesheet')}
            aria-pressed={viewMode === 'dopesheet'}
          >
            <List className="w-3 h-3" /><span className="toolbar-label-optional">{t('timeline.dopesheet')}</span>
          </button>
          <button
            className="btn h-5 px-1.5"
            onClick={() => setViewMode('graph')}
            title={t('timeline.graph')}
            aria-label={t('timeline.graph')}
            aria-pressed={viewMode === 'graph'}
          >
            <TrendingUp className="w-3 h-3" /><span className="toolbar-label-optional">{t('timeline.graph')}</span>
          </button>
        </div>

        {/* Right Action: Motion Selector / Add Motion */}
        <div className="flex-1" />

        <div className="flex items-center space-x-1.5">
          {project.animations && project.animations.length > 0 ? (
            <select
              aria-label={t('timeline.title')}
              className="h-6 max-w-[160px] px-1.5 text-dcc-sm bg-dcc-bg text-dcc-control border border-dcc-border rounded outline-none"
              value={activeAnim.id}
              onChange={(e) => setActiveAnimationId(e.target.value)}
            >
              {project.animations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
          ) : null}

          <button
            className="btn btn-secondary"
            onClick={handleCreateAnimation}
            title={t('timeline.new_motion')}
            aria-label={t('timeline.new_motion')}
          >
            <Plus className="w-3 h-3" /><span className="toolbar-label-optional">{t('timeline.new_motion')}</span>
          </button>

          <OverflowMenu label={t('common.more')}>
            <OverflowMenuItem
              icon={Mic}
              label={t('timeline.lipsync')}
              title={t('timeline.lipsync_hint')}
              onSelect={() => wavInputRef.current?.click()}
            />
            <OverflowMenuItem
              icon={Zap}
              label={t('physics.bake_physics')}
              onSelect={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'animation.bake_physics',
                  params: { animation_id: activeAnim.id },
                });
                notify(t('notify.physics_baked', { name: activeAnim.name }), 'success');
              }}
            />
            <OverflowMenuItem
              icon={Sparkles}
              label={t('timeline.auto_face')}
              onSelect={() => {
                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'macro.auto_face_motion',
                  params: { animation_id: activeAnim.id, duration_frames: duration },
                });
                setActiveAnimationId(activeAnim.id);
                notify(t('notify.auto_face_done'), 'success');
              }}
            />
          </OverflowMenu>

          <input
            type="file"
            ref={wavInputRef}
            accept=".wav"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const arr = await file.arrayBuffer();
                const res = analyzeWavForLipSync(new Uint8Array(arr), 30);
                setWaveformPeaks(res.waveformPeaks);
                const targetOpenParam =
                  project.parameters.find((p) => p.id === 'ParamMouthOpen' || p.id === 'ParamMouthOpenY')?.id ||
                  'ParamMouthOpen';
                const targetFormParam =
                  project.parameters.find((p) => p.id === 'ParamMouthForm')?.id || 'ParamMouthForm';

                const updatedTracks = [
                  ...activeAnim.tracks.filter(
                    (t) => t.target_param_id !== targetOpenParam && t.target_param_id !== targetFormParam
                  ),
                ];
                updatedTracks.push({
                  target_param_id: targetOpenParam,
                  keyframes: res.keyframes,
                });
                if (project.parameters.some((p) => p.id === targetFormParam)) {
                  updatedTracks.push({
                    target_param_id: targetFormParam,
                    keyframes: res.mouthFormKeyframes,
                  });
                }

                executeCommand({
                  id: `cmd_${Date.now()}`,
                  name: 'animation.add',
                  params: {
                    ...activeAnim,
                    duration_frames: Math.max(activeAnim.duration_frames, res.durationFrames),
                    tracks: updatedTracks,
                  },
                });
                notify(t('notify.lipsync_done', { name: file.name, count: res.keyframes.length }), 'success');
              } catch (err: any) {
                notify(t('notify.lipsync_failed', { error: err?.message || err }), 'error');
              }
            }}
          />
        </div>
      </div>

      {/* Tracks & Ruler Area: keyed tracks first, untouched parameters dimmed below them. */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers */}
        <div className="w-48 border-r border-dcc-border bg-dcc-panel/60 overflow-y-auto shrink-0">
          <div className="h-6 border-b border-dcc-border bg-dcc-header/40 px-2 flex items-center text-dcc-sm text-dcc-muted font-semibold">
            {t('timeline.tracks')}
          </div>
          {orderedParams.map((param) => {
            const isSelected = selectedTrackParamId === param.id;
            const trackObj = activeAnim.tracks.find((t) => t.target_param_id === param.id);
            const isFrozen = !!trackObj?.frozen;
            return (
              <div
                key={param.id}
                className={`h-6 px-2 border-b border-dcc-border/40 flex items-center justify-between text-dcc hover:bg-dcc-hover cursor-pointer ${
                  isSelected ? 'list-item-selected font-medium' : isKeyed(param.id) ? 'text-dcc-text' : 'text-dcc-subtle'
                }`}
                onClick={() => setSelectedTrackParamId(param.id)}
              >
                <span className="truncate">{param.name || param.id}</span>
                <div className="flex items-center space-x-1">
                  <button
                    className="p-0.5 text-dcc-subtle hover:text-zinc-200 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      executeCommand({
                        id: `cmd_${Date.now()}`,
                        name: 'animation.set_track_freeze',
                        params: {
                          animation_id: activeAnim.id,
                          param_id: param.id,
                          frozen: !isFrozen,
                        },
                      });
                    }}
                    title={isFrozen ? t('timeline.unfreeze') : t('timeline.freeze')}
                    aria-label={isFrozen ? t('timeline.unfreeze') : t('timeline.freeze')}
                    aria-pressed={isFrozen}
                  >
                    {isFrozen ? <Lock className="w-3 h-3 text-blue-300" /> : <Unlock className="w-3 h-3 text-zinc-600" />}
                  </button>
                  <button
                    className="p-0.5 text-dcc-subtle hover:text-zinc-200 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddKeyframeAtPlayhead(param.id);
                    }}
                    title={t('timeline.add_key')}
                    aria-label={t('timeline.add_key')}
                  >
                    <Key className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Content View */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Ruler */}
          <div
            ref={rulerRef}
            className="h-6 border-b border-dcc-border bg-dcc-header/40 relative cursor-pointer shrink-0"
            onClick={handleRulerClick}
          >
            {/* Audio PCM Waveform Bar Chart Overlay */}
            {waveformPeaks.length > 0 && (
              <div className="absolute inset-0 flex items-end pointer-events-none opacity-45 px-0.5">
                {waveformPeaks.slice(0, duration).map((peak, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-purple-400 mx-[0.5px] rounded-t"
                    style={{ height: `${Math.max(8, Math.round(peak * 100))}%` }}
                  />
                ))}
              </div>
            )}
            {Array.from({ length: Math.floor(duration / 5) + 1 }).map((_, i) => {
              const frameNum = i * 5;
              const pct = (frameNum / duration) * 100;
              return (
                <div
                  key={frameNum}
                  className="absolute top-0 bottom-0 flex flex-col justify-between -translate-x-1/2 pointer-events-none"
                  style={{ left: `${pct}%` }}
                >
                  <span className="text-[9px] font-mono text-dcc-subtle leading-none">{frameNum}</span>
                  <div className="w-px h-1.5 bg-zinc-600 self-center" />
                </div>
              );
            })}

            {/* Red Playhead Triangle & Line */}
            <div
              className="absolute top-0 bottom-0 w-2.5 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
              style={{ left: `${(currentPlayheadFrame / duration) * 100}%` }}
            >
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-rose-500" />
              <div className="w-0.5 flex-1 bg-rose-500" />
            </div>
          </div>

          {!hasKeyframes && (
            <div className="absolute inset-x-0 top-6 bottom-0 z-20 flex items-center justify-center p-4 pointer-events-none">
              <div className="max-w-sm rounded border border-dcc-border bg-dcc-panel/95 px-4 py-3 text-center shadow-lg">
                <p className="text-dcc font-medium text-dcc-text">{t('timeline.empty_title')}</p>
                <p className="mt-1 text-dcc-sm leading-relaxed text-dcc-muted">{t('timeline.empty_hint')}</p>
              </div>
            </div>
          )}

          {/* Dope Sheet View vs Graph Editor View */}
          {viewMode === 'dopesheet' ? (
            <div className="flex-1 overflow-y-auto relative">
              {/* Vertical Playhead Guide Line */}
              <div
                className="absolute top-0 bottom-0 w-px bg-rose-500/80 pointer-events-none z-10"
                style={{ left: `${(currentPlayheadFrame / duration) * 100}%` }}
              />

              {orderedParams.map((param) => {
                const track = activeAnim.tracks.find((t) => t.target_param_id === param.id);
                const keyframes = track?.keyframes || [];

                return (
                  <div
                    key={param.id}
                    className="h-6 border-b border-dcc-border/40 relative bg-dcc-bg/20 hover:bg-dcc-bg/40 cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      setCurrentPlayheadFrame(Math.round(pct * duration));
                    }}
                  >
                    {keyframes.map((kf, kidx) => {
                      const pct = (kf.frame / duration) * 100;
                      return (
                        <div
                          key={kidx}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-amber-400 border border-zinc-900 z-10 hover:scale-125 transition-transform"
                          style={{ left: `${pct}%` }}
                          title={t('timeline.keyframe_at', { frame: kf.frame, value: kf.value })}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Graph / Curve Editor View */
            <div className="flex-1 relative bg-dcc-bg overflow-hidden flex flex-col">
              {/* Playhead Guide Line in Graph */}
              <div
                className="absolute top-0 bottom-0 w-px bg-rose-500/80 pointer-events-none z-10"
                style={{ left: `${(currentPlayheadFrame / duration) * 100}%` }}
              />

              {/* Zero-line indicator */}
              <div
                className="absolute left-0 right-0 h-px bg-zinc-700/60 pointer-events-none"
                style={{ top: '50%' }}
              />

              <svg className="w-full h-full">
                {selectedTrack && selectedTrack.keyframes.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    points={selectedTrack.keyframes
                      .map((kf) => {
                        const x = (kf.frame / duration) * 1000;
                        const y = valueToSvgY(kf.value, 150);
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                )}

                {selectedTrack?.keyframes.map((kf, kidx) => {
                  const x = (kf.frame / duration) * 1000;
                  const y = valueToSvgY(kf.value, 150);
                  return (
                    <circle
                      key={kidx}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-ns-resize hover:scale-150 transition-transform"
                    >
                      <title>{`Frame ${kf.frame}: ${kf.value}`}</title>
                    </circle>
                  );
                })}
              </svg>

              <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-dcc-sm font-mono text-dcc-muted">
                Curve: {selectedTrackParamId} ({paramMin} ~ {paramMax})
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
