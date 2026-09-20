import { useEffect, useState } from 'react';
import { applyPreference, readPreference, resolveTheme, storePreference } from '../lib/theme';
import { MoonIcon, SunIcon } from './Icons';

/**
 * Switches between light and dark. An untouched interface starts in light mode;
 * the visitor's choice is persisted for later visits.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    applyPreference(preference);
  }, [preference]);

  const resolved = resolveTheme(preference);
  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang';

  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => {
        storePreference(next);
        setPreference(next);
      }}
      aria-label={label}
      title={label}
    >
      {resolved === 'dark' ? <SunIcon size={20} /> : <MoonIcon size={20} />}
      <span className="button-text">{resolved === 'dark' ? 'Mode terang' : 'Mode gelap'}</span>
    </button>
  );
}
