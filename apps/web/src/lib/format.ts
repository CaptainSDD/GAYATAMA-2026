import { band, ZONE_LIMITS_METERS, type LatLng, type ScoreSummary, type Zone } from '@gayatama/scoring';

/**
 * A score for display. Whole numbers normally, but when rounding would carry a
 * score into the next band (69.6 → 70), show it truncated to one decimal
 * (69.6) so the number never contradicts its band label.
 */
export function displayScore(value: number): string {
  const rounded = Math.round(value);
  if (band(rounded) === band(value)) return rounded.toString();
  return (Math.floor(value * 10 + 1e-9) / 10).toFixed(1);
}

export function formatRange({ range }: ScoreSummary): string {
  return `${range[0]}–${range[1]}`;
}

export function formatWhole(value: number): string {
  return Math.round(value).toString();
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatDistance(meters: number): string {
  const rounded = Math.round(meters);
  return rounded < 1000 ? `${rounded} m` : `${(meters / 1000).toFixed(1)} km`;
}

const ZONE_STARTS_METERS: Record<Zone, number> = { a: 0, b: ZONE_LIMITS_METERS.a, c: ZONE_LIMITS_METERS.b };

/** "Zone B, 300 m–800 m". */
export function formatZone(zone: Zone): string {
  return `Zone ${zone.toUpperCase()}, ${formatDistance(ZONE_STARTS_METERS[zone])}–${formatDistance(ZONE_LIMITS_METERS[zone])}`;
}

export function formatCoordinate({ lat, lng }: LatLng): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
