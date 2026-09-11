import { ZONE_WEIGHTS } from './constants.js';
import { haversineMeters, zoneFor } from './distance.js';
import { accessFactor, dataQuality, scaleFactor } from './quality.js';
import type { EvaluatedFacility, LocationInput } from './types.js';

/**
 * Measures every facility against the candidate location and attaches the
 * factors the rest of the engine multiplies by. Facilities beyond 1,500 m are
 * dropped.
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
    });
  }
  return evaluated;
}
