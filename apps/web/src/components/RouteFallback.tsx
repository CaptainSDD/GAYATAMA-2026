import { Skeleton } from './Skeleton';

/**
 * Shown while a route's chunk is fetched.
 *
 * Deliberately shapeless. The first version of this reused `AuthLoading`, which
 * draws a 26rem auth card: a visitor heading for the membership page or the
 * account page was shown the silhouette of a login form and then handed
 * something else entirely. A fallback that promises the wrong shape is worse
 * than one that promises nothing, so this states only that something is coming.
 */
export function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">Memuat halaman…</span>
      <Skeleton height="1rem" width="9rem" />
    </div>
  );
}
