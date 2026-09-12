import { ZONE_LIMITS_METERS, type LatLng } from '@gayatama/scoring';

/** Distance zones, drawn largest first so the smaller rings sit on top. */
export const ZONE_RINGS = [
  { zone: 'C', from: ZONE_LIMITS_METERS.b, to: ZONE_LIMITS_METERS.c, color: '#64748b' },
  { zone: 'B', from: ZONE_LIMITS_METERS.a, to: ZONE_LIMITS_METERS.b, color: '#0d9488' },
  { zone: 'A', from: 0, to: ZONE_LIMITS_METERS.a, color: '#0f766e' },
] as const;

export const PICK_COLOR = '#b91c1c';

export interface MapPickerProps {
  initialCenter: LatLng;
  point: LatLng | null;
  onPick: (point: LatLng) => void;
  onCenterChange: (center: LatLng) => void;
}
