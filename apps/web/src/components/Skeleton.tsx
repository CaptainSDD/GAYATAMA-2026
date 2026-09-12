/** A grey block standing in for content that is still loading. */
export function Skeleton({ height = '1rem', width = '100%' }: { height?: string; width?: string }) {
  return <span className="skeleton" style={{ display: 'block', height, width }} aria-hidden="true" />;
}

/**
 * The shape of a score result. Showing the layout that is coming reads as
 * progress in a way a lone spinner does not, and an Overpass round trip for a
 * new area takes several seconds.
 */
export function ScoreSkeleton() {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      <Skeleton height="11rem" />
      <Skeleton height="1.5rem" width="60%" />
      <Skeleton height="0.75rem" />
      <Skeleton height="0.75rem" width="85%" />
      <Skeleton height="0.75rem" width="70%" />
    </div>
  );
}
