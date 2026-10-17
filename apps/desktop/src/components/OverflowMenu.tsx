import React, { useId, useRef } from 'react';
import { MoreHorizontal, Check, type LucideIcon } from 'lucide-react';

interface OverflowMenuProps {
  label: string;
  /** Trigger icon; defaults to the "more" ellipsis. */
  icon?: LucideIcon;
  /** Marks the trigger when a toggle hidden inside the menu is on. */
  active?: boolean;
  children: React.ReactNode;
}

// Native popover handles top-layer rendering, outside-click and Escape dismissal;
// CSS anchor positioning keeps it attached to the trigger (see .panel-menu in theme.css).
export const OverflowMenu: React.FC<OverflowMenuProps> = ({ label, icon: Icon = MoreHorizontal, active = false, children }) => {
  const id = useId();
  const anchorName = `--menu-${id.replace(/[^\w-]/g, '')}`;
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={label}
        aria-haspopup="menu"
        title={label}
        className="panel-menu-trigger"
        data-active={active || undefined}
        style={{ anchorName } as React.CSSProperties}
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
      <div
        id={id}
        ref={menuRef}
        popover="auto"
        role="menu"
        aria-label={label}
        className="panel-menu"
        style={{ positionAnchor: anchorName } as React.CSSProperties}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('[role^="menuitem"]')) menuRef.current?.hidePopover();
        }}
      >
        {children}
      </div>
    </>
  );
};

interface OverflowMenuItemProps {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  /** Renders a checkable item when defined. */
  checked?: boolean;
  title?: string;
}

export const OverflowMenuItem: React.FC<OverflowMenuItemProps> = ({ icon: Icon, label, onSelect, checked, title }) => (
  <button
    type="button"
    role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
    aria-checked={checked}
    title={title}
    className="panel-menu-item"
    onClick={onSelect}
  >
    <Icon className="w-3.5 h-3.5 shrink-0 text-dcc-muted" />
    <span className="flex-1 truncate">{label}</span>
    {checked && <Check className="w-3.5 h-3.5 shrink-0 text-blue-400" />}
  </button>
);

export const OverflowMenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="panel-menu-label">{children}</div>
);
