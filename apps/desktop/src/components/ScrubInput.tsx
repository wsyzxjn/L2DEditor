import React, { useState, useRef, useEffect } from 'react';

interface ScrubInputProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  className?: string;
  onChangeStart?: () => void;
  onChangeEnd?: () => void;
}

export const ScrubInput: React.FC<ScrubInputProps> = ({
  label,
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  precision = 2,
  className = '',
  onChangeStart,
  onChangeEnd,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [textVal, setTextVal] = useState(String(value));
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startVal = useRef(value);

  useEffect(() => {
    if (!isEditing) {
      setTextVal(value.toFixed(precision));
    }
  }, [value, precision, isEditing]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isEditing) return;
    isDragging.current = true;
    startX.current = e.clientX;
    startVal.current = value;
    onChangeStart?.();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const delta = e.clientX - startX.current;
    const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const next = Math.max(min, Math.min(max, startVal.current + delta * step * multiplier));
    onChange(Number(next.toFixed(precision)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      onChangeEnd?.();
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      onChangeEnd?.();
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const num = parseFloat(textVal);
      if (!isNaN(num)) {
        onChange(Math.max(min, Math.min(max, num)));
      }
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`flex items-center h-6 px-1.5 text-dcc bg-dcc-panel border border-dcc-border rounded hover:border-zinc-500 focus-within:border-dcc-accent select-none cursor-ew-resize ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={() => setIsEditing(true)}
    >
      {label && <span className="text-dcc-muted mr-1.5 font-medium">{label}</span>}
      {isEditing ? (
        <input
          type="number"
          autoFocus
          className="w-full bg-transparent text-dcc-text outline-none cursor-text font-mono"
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={() => {
            const num = parseFloat(textVal);
            if (!isNaN(num)) {
              onChange(Math.max(min, Math.min(max, num)));
            }
            setIsEditing(false);
          }}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span className="font-mono text-dcc-text truncate">{value.toFixed(precision)}</span>
      )}
    </div>
  );
};
