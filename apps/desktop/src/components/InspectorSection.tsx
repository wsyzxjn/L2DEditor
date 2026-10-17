import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface InspectorSectionProps {
  /** Stable key used to remember the open state between sessions. */
  id: string;
  title: string;
  children: React.ReactNode;
}

const storageKey = (id: string) => `l2d_inspector_section:${id}`;

export const InspectorSection: React.FC<InspectorSectionProps> = ({ id, title, children }) => {
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey(id)) !== 'closed');

  return (
    <details
      open={open}
      className="inspector-section border-t border-dcc-border"
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        localStorage.setItem(storageKey(id), next ? 'open' : 'closed');
      }}
    >
      <summary className="flex items-center gap-1 h-7 cursor-pointer select-none rounded text-dcc-sm font-semibold text-dcc-muted hover:text-dcc-text">
        <ChevronRight className="inspector-section-chevron w-3 h-3 shrink-0 transition-transform" />
        {title}
      </summary>
      <div className="space-y-2 pb-2">{children}</div>
    </details>
  );
};
