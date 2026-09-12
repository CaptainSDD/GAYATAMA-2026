import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  /** Decorative: the label already names the tab. */
  icon?: ReactNode;
}

interface TabsProps<K extends string> {
  label: string;
  tabs: readonly TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  children: ReactNode;
}

/** Accessible tabs: arrow keys, Home and End move between tabs, as in the WAI-ARIA tabs pattern. */
export function Tabs<K extends string>({ label, tabs, active, onChange, children }: TabsProps<K>) {
  const id = useId();
  const buttons = useRef<Partial<Record<K, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number;
    switch (event.key) {
      case 'ArrowRight':
        target = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        target = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = tabs[target];
    if (next === undefined) return;
    onChange(next.key);
    buttons.current[next.key]?.focus();
  };

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tab-list">
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(element) => {
              buttons.current[tab.key] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${tab.key}`}
            aria-selected={tab.key === active}
            aria-controls={`${id}-panel`}
            tabIndex={tab.key === active ? 0 : -1}
            className="tab"
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`} className="tab-panel">
        {children}
      </div>
    </div>
  );
}
