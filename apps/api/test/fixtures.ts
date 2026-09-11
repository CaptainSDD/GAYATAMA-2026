import type { LatLng } from '@gayatama/scoring';
import type { OverpassElement } from '../src/overpass/overpass-element';

/** UNESA Ketintang, Surabaya. */
export const ORIGIN: LatLng = { lat: -7.3145, lng: 112.7263 };

const METERS_PER_DEGREE = (6_371_008.8 * Math.PI) / 180;
const RECENT_EDIT = '2026-08-01T00:00:00Z';

let nextId = 1;

export function offset(origin: LatLng, northMeters: number, eastMeters: number): { lat: number; lon: number } {
  return {
    lat: origin.lat + northMeters / METERS_PER_DEGREE,
    lon: origin.lng + eastMeters / (METERS_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180)),
  };
}

export function node(tags: Record<string, string>, north: number, east: number, origin = ORIGIN): OverpassElement {
  const { lat, lon } = offset(origin, north, east);
  return { type: 'node', id: nextId++, lat, lon, tags, timestamp: RECENT_EDIT };
}

export function area(tags: Record<string, string>, north: number, east: number, origin = ORIGIN): OverpassElement {
  return { type: 'way', id: nextId++, center: offset(origin, north, east), tags, timestamp: RECENT_EDIT };
}

export function line(tags: Record<string, string>, points: [north: number, east: number][], origin = ORIGIN): OverpassElement {
  return { type: 'way', id: nextId++, geometry: points.map(([n, e]) => offset(origin, n, e)), tags };
}

/** A mapped campus neighbourhood, dense enough for a confident score. */
export function neighbourhood(origin = ORIGIN): OverpassElement[] {
  return [
    node({ amenity: 'university', name: 'Universitas Negeri Surabaya', check_date: '2026-06-01' }, 250, 0, origin),
    node({ amenity: 'school', name: 'SDN Ketintang' }, 0, 500, origin),
    node({ amenity: 'school', name: 'SMPN 22' }, 0, -400, origin),
    node({ office: 'company', name: 'Kantor A' }, -600, 0, origin),
    node({ office: 'government', name: 'Kelurahan Ketintang' }, -600, 100, origin),
    area({ landuse: 'residential' }, 900, 0, origin),
    area({ building: 'apartments', name: 'Apartemen' }, 0, 1100, origin),
    node({ tourism: 'guest_house', name: 'Kos Putri' }, 0, 700, origin),
    node({ highway: 'bus_stop' }, -350, 0, origin),
    node({ amenity: 'cafe', name: 'Kopi Kampus', opening_hours: 'Mo-Su 08:00-22:00' }, 0, -200, origin),
    node({ shop: 'laundry', name: 'Laundry Kilat' }, 0, 900, origin),
    node({ amenity: 'atm' }, 150, 0, origin),
    node({ amenity: 'parking', capacity: '20' }, 0, 120, origin),
    node({ amenity: 'hospital', name: 'RS Bhakti' }, -1300, 0, origin),
    node({ shop: 'convenience', name: 'Minimarket' }, 450, 0, origin),
  ];
}

export function siteElements(origin = ORIGIN): OverpassElement[] {
  return [
    line({ highway: 'tertiary', sidewalk: 'both' }, [[-100, -20], [100, -20]], origin),
    line({ highway: 'service' }, [[-100, 5], [100, 5]], origin),
    node({ highway: 'crossing' }, 40, -20, origin),
  ];
}
