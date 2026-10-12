import React, { useRef } from 'react';
import { useEditor } from '../context/EditorContext.js';
import { Play, Pause, Square, Repeat, Key, Plus, Film } from 'lucide-react';
import type { Animation } from '@l2d/schema';

export const TimelinePanel: React.FC = () => {
  const {
    project,
    isPlayingAnimation,
    setIsPlayingAnimation,
    currentPlayheadFrame,
    setCurrentPlayheadFrame,
    activeAnimationId,
    setActiveAnimationId,
    parameterValues,
    executeCommand,
    notify,
  } = useEditor();

  const rulerRef = useRef<HTMLDivElement | null>(null);

  // Active animation or fallback to first
  const activeAnim: Animation = project.animations?.find((a) => a.id === activeAnimationId) || {
    id: 'anim_default',
    name: 'Idle Motion',
    duration_frames: 60,
    fps: 30,
    loop_playback: true,
    tracks: [],
  };

  const duration = Math.max(30, activeAnim.duration_frames || 60);

  const handleCreateAnimation = () => {
    const id = `anim_${Date.now()}`;
    const newAnim: Animation = {
      id,
      name: `Motion ${ (project.animations?.length || 0) + 1 }`,
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
    notify(`Created Animation: ${newAnim.name}`, 'success');
  };

  const handleAddKeyframeAtPlayhead = (paramId: string) => {
    const curVal = parameterValues[paramId] ?? 0;
    executeCommand({
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
    notify(`Keyframe added at frame ${Math.round(currentPlayheadFrame)} for ${paramId}`, 'success');
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetFrame = Math.round(pct * duration);
    setCurrentPlayheadFrame(targetFrame);
  };

  return (
    <div className="flex flex-col h-full bg-dcc-panel border-t border-dcc-border select-none">
      {/* Timeline Controls Header */}
      <div className="flex items-center justify-between h-8 px-3 border-b border-dcc-border bg-dcc-header">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-dcc font-semibold uppercase tracking-wider text-dcc-muted mr-2">
            <Film className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </div>

          {/* Transport buttons */}
          <button
            className="p-1 hover:bg-zinc-700 rounded text-zinc-300 hover:text-white transition-colors"
            onClick={() => setIsPlayingAnimation(!isPlayingAnimation)}
            title={isPlayingAnimation ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlayingAnimation ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
          </button>
          <button
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
            onClick={() => {
              setIsPlayingAnimation(false);
              setCurrentPlayheadFrame(0);
            }}
            title="Stop"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            className={`p-1 rounded transition-colors ${
              activeAnim.loop_playback ? 'text-blue-400 bg-blue-950/60' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            onClick={() => {
              executeCommand({
                id: `cmd_${Date.now()}`,
                name: 'animation.add',
                params: { ...activeAnim, loop_playback: !activeAnim.loop_playback },
              });
            }}
            title="Toggle Loop"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-dcc-border mx-1" />

          {/* Frame Counter */}
          <div className="flex items-center space-x-1 text-dcc font-mono text-zinc-300 bg-dcc-bg px-2 py-0.5 rounded border border-dcc-border">
            <span className="text-blue-400">{Math.round(currentPlayheadFrame)}</span>
            <span className="text-zinc-600">/</span>
            <span>{duration}</span>
            <span className="text-dcc-sm text-zinc-500 ml-1">F</span>
          </div>

          <span className="text-dcc-sm text-zinc-500 font-mono">@{activeAnim.fps || 30}fps</span>
        </div>

        {/* Right Action: Motion Selector / Add Motion */}
        <div className="flex items-center space-x-2">
          {project.animations && project.animations.length > 0 ? (
            <select
              className="h-6 px-1.5 text-dcc-sm bg-dcc-bg text-zinc-300 border border-dcc-border rounded outline-none"
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
            className="flex items-center px-2 py-0.5 text-dcc-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded font-medium transition-colors"
            onClick={handleCreateAnimation}
          >
            <Plus className="w-3 h-3 mr-1" /> New Motion
          </button>
        </div>
      </div>

      {/* Tracks & Ruler Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers */}
        <div className="w-48 border-r border-dcc-border bg-dcc-panel/60 overflow-y-auto shrink-0">
          <div className="h-6 border-b border-dcc-border bg-dcc-header/40 px-2 flex items-center text-dcc-sm text-dcc-muted uppercase font-semibold">
            Track Parameters
          </div>
          {project.parameters.map((param) => (
            <div
              key={param.id}
              className="h-6 px-2 border-b border-dcc-border/40 flex items-center justify-between text-dcc hover:bg-dcc-hover cursor-pointer"
            >
              <span className="truncate text-dcc-text">{param.name || param.id}</span>
              <button
                className="p-0.5 text-zinc-500 hover:text-emerald-400 transition-colors"
                onClick={() => handleAddKeyframeAtPlayhead(param.id)}
                title="Add Keyframe at current frame"
              >
                <Key className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Right Timeline Canvas & Tracks */}
        <div className="flex-1 flex flex-col overflow-x-auto relative">
          {/* Ruler */}
          <div
            ref={rulerRef}
            className="h-6 border-b border-dcc-border bg-dcc-header/40 relative cursor-pointer"
            onClick={handleRulerClick}
          >
            {/* Frame ticks */}
            {Array.from({ length: Math.floor(duration / 5) + 1 }).map((_, i) => {
              const frameNum = i * 5;
              const pct = (frameNum / duration) * 100;
              return (
                <div
                  key={frameNum}
                  className="absolute top-0 bottom-0 flex flex-col justify-between -translate-x-1/2 pointer-events-none"
                  style={{ left: `${pct}%` }}
                >
                  <span className="text-[9px] font-mono text-zinc-500 leading-none">{frameNum}</span>
                  <div className="w-px h-1.5 bg-zinc-600 self-center" />
                </div>
              );
            })}

            {/* Red Playhead on Ruler */}
            <div
              className="absolute top-0 bottom-0 w-2.5 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
              style={{ left: `${(currentPlayheadFrame / duration) * 100}%` }}
            >
              <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-rose-500" />
              <div className="w-0.5 flex-1 bg-rose-500" />
            </div>
          </div>

          {/* Track lanes */}
          <div className="flex-1 overflow-y-auto relative">
            {/* Vertical Playhead Guide Line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-rose-500/80 pointer-events-none z-10"
              style={{ left: `${(currentPlayheadFrame / duration) * 100}%` }}
            />

            {project.parameters.map((param) => {
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
                  {/* Keyframe diamonds */}
                  {keyframes.map((kf, kidx) => {
                    const pct = (kf.frame / duration) * 100;
                    return (
                      <div
                        key={kidx}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-amber-400 border border-zinc-900 z-10 hover:scale-125 transition-transform"
                        style={{ left: `${pct}%` }}
                        title={`Keyframe at frame ${kf.frame}: value ${kf.value}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
