import type { CSSProperties } from 'react';
import { zoneRangeLabel, zoneWeightLabel, type ZoneRing } from './zones';

/**
 * The distance a band stands for, drawn inside the band and inked in its colour.
 * This is what the old legend said in a corner of the screen: the same range and
 * weight, but attached to the shape being pointed at, which is the only way the
 * pairing is obvious without a key to look up.
 *
 * Shared markup so the Leaflet and Google maps label their zones identically.
 */
export function ZoneLabel({ ring }: { ring: ZoneRing }) {
  return (
    <span className="zone-label" style={{ '--zone-color': ring.color } as CSSProperties}>
      <strong>{zoneRangeLabel(ring)}</strong>
      <small>{zoneWeightLabel(ring)}</small>
    </span>
  );
}
