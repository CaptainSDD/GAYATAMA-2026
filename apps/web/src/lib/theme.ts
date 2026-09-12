export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'lokabis.theme';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Reading storage throws in a private window or when site data is blocked, so
 * every access is guarded and falls back to following the operating system.
 */
export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isPreference(stored)) return stored;
  } catch {
    /* storage unavailable — follow the system */
  }
  return 'system';
}

export function storePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* storage unavailable — the choice lasts for this page only */
  }
}

/**
 * `system` removes the attribute entirely so the `prefers-color-scheme` rules in
 * styles.css decide. An explicit choice stamps the attribute, which wins in
 * both directions.
 */
export function applyPreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

/** What the page actually renders as right now, after the system is consulted. */
export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
