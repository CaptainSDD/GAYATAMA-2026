import { ACCESS_FACTOR, COUNTED_DATA_QUALITY, ZONE_LIMITS_METERS, ZONE_WEIGHTS } from './constants.js';
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
      countedFrom: counted.source,
    });
  }
  return evaluated;
}
