import { useEffect, useState } from 'react';
import { applyPreference, readPreference, resolveTheme, storePreference } from '../lib/theme';
import { MoonIcon, SunIcon } from './Icons';

/**
 * Switches between light and dark. The stored preference starts as `system`, so
 * an untouched interface follows the operating system; the first click pins it.
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
      {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
