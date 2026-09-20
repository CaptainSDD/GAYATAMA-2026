export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'lokabis.theme';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

/**
 * Reading storage throws in a private window or when site data is blocked, so
 * every access is guarded and falls back to the product's light default.
 */
export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isPreference(stored)) return stored;
  } catch {
    /* storage unavailable — keep the light default */
  }
  return 'light';
}

export function storePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* storage unavailable — the choice lasts for this page only */
  }
}

/**
 * Every visit has an explicit theme attribute. This keeps an untouched visit in
 * light mode while preserving a visitor's deliberate light/dark choice.
 */
export function applyPreference(preference: ThemePreference): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', preference);
}

/** What the page actually renders as right now. */
export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  return preference;
}
