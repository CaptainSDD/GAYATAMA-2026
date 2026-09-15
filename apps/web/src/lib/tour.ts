const STORAGE_PREFIX = 'lokabis.tour.v1';

export interface TourProgress {
  /** Once true the tour never runs again for this account, however it was left. */
  done: boolean;
  /** Where to resume, so a refresh mid-tour does not start over. */
  step: number;
}

const FRESH: TourProgress = { done: false, step: 0 };

/**
 * Progress is kept per account, not per browser. Signing up is exactly when
 * someone expects to be shown around, and one teammate finishing the tour on a
 * shared laptop should not silently skip it for the next person.
 */
function keyFor(scope: string): string {
  return `${STORAGE_PREFIX}.${scope}`;
}

/**
 * Reading storage throws in a private window or when site data is blocked, so
 * every access is guarded — same approach as lib/theme.ts. A visitor whose
 * storage is unavailable simply sees the tour again on the next visit, which is
 * better than the app failing to render.
 */
export function readProgress(scope: string): TourProgress {
  try {
    const stored = localStorage.getItem(keyFor(scope));
    if (stored === null) return FRESH;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return FRESH;
    const { done, step } = parsed as Partial<TourProgress>;
    return { done: done === true, step: typeof step === 'number' && step >= 0 ? step : 0 };
  } catch {
    /* storage unavailable or corrupt — treat as a first visit */
  }
  return FRESH;
}

export function storeProgress(scope: string, progress: TourProgress): void {
  try {
    localStorage.setItem(keyFor(scope), JSON.stringify(progress));
  } catch {
    /* storage unavailable — the tour lasts for this page only */
  }
}

/** Clears the record so the tour runs again, for the "replay" control. */
export function resetProgress(scope: string): void {
  try {
    localStorage.removeItem(keyFor(scope));
  } catch {
    /* storage unavailable — remounting the tour is enough on its own */
  }
}
