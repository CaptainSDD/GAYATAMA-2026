import { ZONE_LIMITS_METERS, ZONE_WEIGHTS, type LatLng } from '@gayatama/scoring';

/**
 * City-level view before the user chooses a point. This is fractionally wider
 * than a conventional level-12 camera so the default desktop composition
 * matches the compact 80%-scale workspace without asking visitors to zoom out.
 */
export const DEFAULT_MAP_ZOOM = 11.7;

/** Distance zones, drawn largest first so the smaller rings sit on top. */
export const ZONE_RINGS = [
  { zone: 'C', from: ZONE_LIMITS_METERS.b, to: ZONE_LIMITS_METERS.c, color: '#64748b' },
  { zone: 'B', from: ZONE_LIMITS_METERS.a, to: ZONE_LIMITS_METERS.b, color: '#0d9488' },
  { zone: 'A', from: 0, to: ZONE_LIMITS_METERS.a, color: '#0f766e' },
] as const;

export type ZoneRing = (typeof ZONE_RINGS)[number];
export type ZoneName = ZoneRing['zone'];

export const PICK_COLOR = '#b91c1c';

/** Which band the pointer is inside, if any. Drives both the fill and the label. */
export type ZoneHover = ZoneName | null;

export interface ZoneHoverProps {
  hoveredZone: ZoneHover;
  onZoneHover: (zone: ZoneHover) => void;
}

/**
 * Resting fill of a band, scaled by the weight the engine gives that distance.
 * This is what the legend used to say in words: nearer counts for more.
 */
export function zoneFillOpacity(ring: ZoneRing, hovered: boolean): number {
  if (hovered) return 0.28;
  return 0.02 + 0.08 * ZONE_WEIGHTS[ring.zone.toLowerCase() as 'a' | 'b' | 'c'];
}

/** "0–300 m" — the distances the rings stand for, spelled out for the hover label. */
export function zoneRangeLabel(ring: ZoneRing): string {
  return `${ring.from.toLocaleString('id-ID')}–${ring.to.toLocaleString('id-ID')} m`;
}

/** "bobot 100%" — how much a facility in this band counts towards the score. */
export function zoneWeightLabel(ring: ZoneRing): string {
  const weight = ZONE_WEIGHTS[ring.zone.toLowerCase() as 'a' | 'b' | 'c'];
  return `bobot ${Math.round(weight * 100)}%`;
}

const EARTH_RADIUS_METERS = 6371008.8;

/** Enough segments that the fill edge sits under the circle outline at any zoom. */
const RING_SEGMENTS = 128;

/**
 * The point `meters` away from `center` on the given bearing, by the spherical
 * destination-point formula, so it lands on the same curve the map libraries draw
 * their circles along. A flat-earth approximation drifts by metres at 1,5 km,
 * which is enough to leave a hairline gap beside the outline.
 */
function destination(center: LatLng, meters: number, bearing: number): LatLng {
  const lat = (center.lat * Math.PI) / 180;
  const lng = (center.lng * Math.PI) / 180;
  const angular = meters / EARTH_RADIUS_METERS;
  const pointLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing));
  const pointLng =
    lng +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
      Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat),
    );
  return { lat: (pointLat * 180) / Math.PI, lng: (pointLng * 180) / Math.PI };
}

/** A ring of points `radius` metres from `center`. */
function circlePoints(center: LatLng, radius: number): LatLng[] {
  const points: LatLng[] = [];
  for (let index = 0; index < RING_SEGMENTS; index += 1) {
    points.push(destination(center, radius, (2 * Math.PI * index) / RING_SEGMENTS));
  }
  return points;
}

/**
 * Where a band's label sits: halfway across it, due north of the pin. Inside the
 * band itself rather than off in a corner, so the number and the shape it
 * measures are read as one thing.
 */
export function zoneLabelPoint(center: LatLng, ring: ZoneRing): LatLng {
  return destination(center, (ring.from + ring.to) / 2, 0);
}

/**
 * The band itself, as a filled shape: a disc for Zone A, a ring with a hole
 * punched out for B and C. Nested discs would mean hovering anywhere near the
 * pin lights up every zone at once and tints the whole area, so each band gets
 * its own geometry and only the band under the pointer reacts.
 */
export function zoneBandRings(center: LatLng, ring: ZoneRing): LatLng[][] {
  const outer = circlePoints(center, ring.to);
  if (ring.from === 0) return [outer];
  // Reversed, so the winding tells Google Maps this ring is a hole. Leaflet
  // fills by the even-odd rule and reads it as a hole either way.
  return [outer, circlePoints(center, ring.from).reverse()];
}

export interface MapPickerProps {
  initialCenter: LatLng;
  /** Candidate selected by the user; shown as a pin without starting the engine. */
  point: LatLng | null;
  /** Present only after explicit confirmation; enables radii and POI loading. */
  analysisPoint: LatLng | null;
  /** Two locations are being compared, so the pins are lettered A and B. */
  comparing?: boolean;
  /** The second candidate, once picked. Only meaningful while comparing. */
  secondPoint?: LatLng | null;
  /**
   * A point being pointed at elsewhere in the interface — a cell of the
   * opportunity grid under the cursor. Shown, never selected: the grid names
   * nine places by compass direction and distance, which is a poor substitute
   * for seeing which one it means.
   */
  highlightPoint?: LatLng | null;
  onPick: (point: LatLng) => void;
  onCenterChange: (center: LatLng) => void;
}
