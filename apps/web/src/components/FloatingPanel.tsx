import { useId, type ReactNode } from 'react';
import { ChevronDownIcon } from './Icons';

interface FloatingPanelProps {
  title: string;
  /** Shown beside the title — used to keep the chosen business type in sight. */
  badge?: string;
  /**
   * Controls that live in the bar itself, between the title and the collapse
   * toggle. They cannot sit inside the toggle: a button nested in a button is
   * invalid, and these need their own focus and activation.
   */
  barControls?: ReactNode;
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
 *
 * The bar used to be one big button. It is now a row — heading, optional
 * controls, then the toggle — because the location card needs real tabs up
 * there, and tabs inside a button are not operable.
 */
export function FloatingPanel({
  title,
  badge,
  barControls,
  collapsed,
  onToggle,
  tourId,
  className,
  children,
}: FloatingPanelProps) {
  const bodyId = useId();

  return (
    <section
      className={`floating-panel${className === undefined ? '' : ` ${className}`}`}
      // Collapsing has to stop the results card from stretching as well as hide
      // its body, otherwise the folded bar keeps the map covered.
      data-collapsed={collapsed}
      data-tour={tourId}
    >
      <h2 className="floating-panel-bar">
        {/* The heading is the toggle, so the whole left side of the bar stays a
            target the way it was before the tabs moved in here. */}
        <button
          type="button"
          className="floating-panel-heading-button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="floating-panel-heading">
            {title}
            {badge !== undefined && <span className="floating-panel-badge">{badge}</span>}
          </span>
        </button>
        {barControls}
        {/* A second target for the same action, so the chevron stays clickable.
            Hidden from assistive tech: the heading button already exposes it,
            and two controls for one panel is noise in a screen reader. */}
        <span
          className="floating-panel-toggle"
          aria-hidden="true"
          onClick={onToggle}
        >
          <ChevronDownIcon size={18} />
        </span>
      </h2>

      <div id={bodyId} className="floating-panel-body" hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
