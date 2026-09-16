import { useId, type ReactNode } from 'react';
import { ChevronDownIcon } from './Icons';

interface FloatingPanelProps {
  title: string;
  /** Shown beside the title — used to keep the chosen business type in sight. */
  badge?: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Marks the panel for the onboarding tour to point at. */
  tourId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A glass card that floats over the map and can be folded away to uncover it.
 * Shared by the controls and the results so the two never drift apart on the
 * details that are easy to get wrong: the toggle owns the panel through
 * aria-controls, and collapsing hides the body from assistive tech too.
 */
export function FloatingPanel({ title, badge, collapsed, onToggle, tourId, className, children }: FloatingPanelProps) {
  const bodyId = useId();

  return (
    <section className={`floating-panel${className === undefined ? '' : ` ${className}`}`} data-tour={tourId}>
      <h2 className="floating-panel-bar">
        <button type="button" className="floating-panel-toggle" aria-expanded={!collapsed} aria-controls={bodyId} onClick={onToggle}>
          <span className="floating-panel-heading">
            {title}
            {badge !== undefined && <span className="floating-panel-badge">{badge}</span>}
          </span>
          <ChevronDownIcon size={18} />
        </button>
      </h2>
      <div id={bodyId} className="floating-panel-body" hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
