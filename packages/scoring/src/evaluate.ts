import { ACCESS_FACTOR, COUNTED_DATA_QUALITY, CROWDING, ZONE_LIMITS_METERS, ZONE_WEIGHTS } from './constants.js';
import { haversineMeters, zoneFor } from './distance.js';
import { accessFactor, dataQuality, scaleFactor } from './quality.js';
import type { EvaluatedFacility, Facility, LocationInput } from './types.js';

/**
 * Measures every facility against the candidate location and attaches the
 * factors the rest of the engine multiplies by. Facilities beyond 1,500 m are
 * dropped.
 *
 * Counted facilities become one entry per kind and zone. PROPOSED: such an entry
 * sits at the outer edge of its zone, so its zone and the competitor-radius test
 * are exact; it has no barrier, the "date unknown" Data Quality and, having no
 * opening hours, the documented unknown-hours factor.
 */
export function evaluateFacilities(input: LocationInput): EvaluatedFacility[] {
  if (Number.isNaN(Date.parse(input.asOf))) {
    throw new RangeError(`asOf must be an ISO date, received "${input.asOf}"`);
  }

  const evaluated: EvaluatedFacility[] = [];
  for (const facility of input.facilities) {
    const distanceMeters = haversineMeters(input.location, facility);
    const zone = zoneFor(distanceMeters);
    if (zone === null) continue;
    evaluated.push({
      facility,
      distanceMeters,
      zone,
      distanceWeight: ZONE_WEIGHTS[zone],
      accessFactor: accessFactor(facility),
      dataQuality: dataQuality(facility, input.asOf),
      scaleFactor: scaleFactor(facility),
      count: 1,
      weight: 1,
    });
  }

  for (const counted of input.facilityCounts ?? []) {
    if (!(counted.count > 0)) continue;
    const facility: Facility = {
      // One source may count a kind twice at different scales, such as large and ordinary transit stops.
      id: [counted.source, counted.kind, counted.zone, counted.scale].filter((part) => part !== undefined).join(':'),
      kind: counted.kind,
      lat: input.location.lat,
      lng: input.location.lng,
    };
    if (counted.scale !== undefined) facility.scale = counted.scale;
    evaluated.push({
      facility,
      distanceMeters: ZONE_LIMITS_METERS[counted.zone],
      zone: counted.zone,
      distanceWeight: ZONE_WEIGHTS[counted.zone],
      accessFactor: ACCESS_FACTOR.none,
      dataQuality: COUNTED_DATA_QUALITY,
      scaleFactor: scaleFactor(facility),
      count: counted.count,
      weight: counted.count,
      countedFrom: counted.source,
    });
  }

  applyCrowding(evaluated);
  return evaluated;
}

/**
 * The tenth cafe in a zone says less about the area than the first. Facilities
 * of one kind sharing one zone count fully up to `CROWDING.freeCount`; past
 * that, each further facility adds less. Counted facilities and individually
 * mapped ones are treated alike, so the weighting does not depend on the source.
 * PROPOSED in model 0.1.0.
 */
export function effectiveCount(count: number): number {
  const { freeCount, scale } = CROWDING;
  return count <= freeCount ? count : freeCount + scale * Math.log(1 + (count - freeCount) / scale);
}

function applyCrowding(evaluated: EvaluatedFacility[]): void {
  const totals = new Map<string, number>();
  for (const entry of evaluated) {
    const key = `${entry.facility.kind}:${entry.zone}`;
    totals.set(key, (totals.get(key) ?? 0) + entry.count);
  }
  for (const entry of evaluated) {
    const total = totals.get(`${entry.facility.kind}:${entry.zone}`) ?? entry.count;
    entry.weight = total <= CROWDING.freeCount ? entry.count : entry.count * (effectiveCount(total) / total);
  }
}
