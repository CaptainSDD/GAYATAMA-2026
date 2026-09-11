/** An element from an Overpass API `[out:json]` response. */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  /** Present for ways and relations requested with `out center`. */
  center?: { lat: number; lon: number };
  /** Present for ways requested with `out geom`. */
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
  /** Last edit time, present with `out meta`. */
  timestamp?: string;
}
