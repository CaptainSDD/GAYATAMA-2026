import { ANALYSIS_RADIUS_METERS, type Facility, type LatLng, type Severance } from '@gayatama/scoring';
import type { OverpassElement } from './overpass-element';

/** Access barriers are fetched across the same circle used by the scoring engine. */
export const ACCESS_BARRIER_RADIUS_METERS = ANALYSIS_RADIUS_METERS;
/** A mapped crossing this close to the straight-line intersection makes the barrier passable. */
export const ACCESS_PASSAGE_RADIUS_METERS = 100;
/** Intersections at the site or facility itself usually mean frontage, not severance. */
export const ACCESS_ENDPOINT_CLEARANCE_METERS = 15;

export const MAJOR_ROAD_HIGHWAYS = ['trunk', 'trunk_link', 'primary', 'primary_link'] as const;
export const TOLL_ROAD_HIGHWAYS = ['motorway', 'motorway_link'] as const;
export const ACCESS_RAILWAYS = ['rail'] as const;
export const ACCESS_WATERWAYS = ['river', 'canal'] as const;
export const RAIL_PASSAGES = ['crossing', 'level_crossing'] as const;

type BarrierKind = 'road' | 'toll' | 'rail' | 'water';
type PassageKind = BarrierKind | 'all';

interface Point {
  x: number;
  y: number;
}

interface Barrier {
  kind: BarrierKind;
  geometry: readonly { lat: number; lon: number }[];
}

interface Passage {
  kind: PassageKind;
  geometry: readonly { lat: number; lon: number }[];
}

export interface AccessContext {
  barriers: readonly Barrier[];
  passages: readonly Passage[];
}

const METERS_PER_DEGREE = (6_371_008.8 * Math.PI) / 180;
const hasTruthyTag = (value: string | undefined): boolean => value !== undefined && value !== 'no';

function geometryOf(element: OverpassElement): { lat: number; lon: number }[] {
  if (element.type === 'node') {
    return element.lat === undefined || element.lon === undefined ? [] : [{ lat: element.lat, lon: element.lon }];
  }
  return element.geometry ?? [];
}

export function barrierKind(tags: Record<string, string>): BarrierKind | null {
  const highway = tags.highway ?? '';
  // A bridge or tunnel is grade-separated at its mapped position, so a line
  // crossing it is not enough evidence that customers are physically severed.
  if (hasTruthyTag(tags.bridge) || hasTruthyTag(tags.tunnel)) return null;
  if (TOLL_ROAD_HIGHWAYS.includes(highway as (typeof TOLL_ROAD_HIGHWAYS)[number]) || tags.toll === 'yes') return 'toll';
  if (MAJOR_ROAD_HIGHWAYS.includes(highway as (typeof MAJOR_ROAD_HIGHWAYS)[number])) return 'road';
  if (ACCESS_RAILWAYS.includes((tags.railway ?? '') as (typeof ACCESS_RAILWAYS)[number])) return 'rail';
  if (ACCESS_WATERWAYS.includes((tags.waterway ?? '') as (typeof ACCESS_WATERWAYS)[number])) return 'water';
  return null;
}

export function passageKind(tags: Record<string, string>): PassageKind | null {
  if (tags.highway === 'crossing') return 'road';
  if (RAIL_PASSAGES.includes((tags.railway ?? '') as (typeof RAIL_PASSAGES)[number])) return 'rail';
  if (tags.highway === 'ford' || hasTruthyTag(tags.ford)) return 'water';
  if (tags.highway !== undefined && (hasTruthyTag(tags.bridge) || hasTruthyTag(tags.tunnel))) return 'all';
  return null;
}

export function accessContext(elements: readonly OverpassElement[]): AccessContext {
  const barriers: Barrier[] = [];
  const passages: Passage[] = [];
  for (const element of elements) {
    const geometry = geometryOf(element);
    if (geometry.length === 0) continue;
    const tags = element.tags ?? {};
    const barrier = barrierKind(tags);
    if (barrier !== null && geometry.length >= 2) barriers.push({ kind: barrier, geometry });
    const passage = passageKind(tags);
    if (passage !== null) passages.push({ kind: passage, geometry });
  }
  return { barriers, passages };
}

function project(origin: LatLng, point: { lat: number; lon: number }): Point {
  return {
    x: (point.lon - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * METERS_PER_DEGREE,
    y: (point.lat - origin.lat) * METERS_PER_DEGREE,
  };
}

const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;

/** Intersection of origin→destination with one barrier segment, in local metres. */
function intersection(destination: Point, a: Point, b: Point): { point: Point; routeDistance: number } | null {
  const segment = { x: b.x - a.x, y: b.y - a.y };
  const denominator = cross(destination, segment);
  if (Math.abs(denominator) < 1e-9) return null;
  const t = cross(a, segment) / denominator;
  const u = cross(a, destination) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  const routeLength = Math.hypot(destination.x, destination.y);
  return { point: { x: t * destination.x, y: t * destination.y }, routeDistance: t * routeLength };
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function distanceToGeometry(point: Point, geometry: readonly { lat: number; lon: number }[], origin: LatLng): number {
  const projected = geometry.map((coordinate) => project(origin, coordinate));
  const first = projected[0];
  if (first === undefined) return Number.POSITIVE_INFINITY;
  if (projected.length === 1) return Math.hypot(point.x - first.x, point.y - first.y);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < projected.length; index += 1) {
    best = Math.min(best, distanceToSegment(point, projected[index - 1]!, projected[index]!));
  }
  return best;
}

function passageMatches(barrier: BarrierKind, passage: PassageKind): boolean {
  if (passage === 'all') return true;
  if (barrier === 'toll') return passage === 'road';
  return barrier === passage;
}

function hasNearbyPassage(intersectionPoint: Point, barrier: BarrierKind, context: AccessContext, origin: LatLng): boolean {
  return context.passages.some(
    (passage) =>
      passageMatches(barrier, passage.kind) &&
      distanceToGeometry(intersectionPoint, passage.geometry, origin) <= ACCESS_PASSAGE_RADIUS_METERS,
  );
}

function mappedSeverance(origin: LatLng, facility: Facility, context: AccessContext): Severance {
  const destination = project(origin, { lat: facility.lat, lon: facility.lng });
  const routeLength = Math.hypot(destination.x, destination.y);
  if (routeLength <= 2 * ACCESS_ENDPOINT_CLEARANCE_METERS) return 'none';

  let result: Severance = 'none';
  for (const barrier of context.barriers) {
    const projected = barrier.geometry.map((coordinate) => project(origin, coordinate));
    for (let index = 1; index < projected.length; index += 1) {
      const hit = intersection(destination, projected[index - 1]!, projected[index]!);
      if (
        hit === null ||
        hit.routeDistance <= ACCESS_ENDPOINT_CLEARANCE_METERS ||
        routeLength - hit.routeDistance <= ACCESS_ENDPOINT_CLEARANCE_METERS ||
        hasNearbyPassage(hit.point, barrier.kind, context, origin)
      ) {
        continue;
      }
      if (barrier.kind === 'road') result = 'major_road';
      else return 'rail_river_toll';
    }
  }
  return result;
}

/** Clone facilities and attach the strongest mapped barrier on the direct path. */
export function withMappedSeverance(
  facilities: readonly Facility[],
  origin: LatLng,
  context: AccessContext,
): Facility[] {
  return facilities.map((facility) => {
    const mapped = mappedSeverance(origin, facility, context);
    const existing = facility.severance ?? 'none';
    const rank: Record<Severance, number> = { none: 0, major_road: 1, rail_river_toll: 2 };
    const severance = rank[existing] >= rank[mapped] ? existing : mapped;
    return severance === 'none' ? { ...facility, severance: undefined } : { ...facility, severance };
  });
}
