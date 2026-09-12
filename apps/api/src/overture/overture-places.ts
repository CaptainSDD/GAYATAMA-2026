import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { Logger } from '@nestjs/common';
import { haversineMeters, type Facility, type LatLng } from '@gayatama/scoring';
import { OVERTURE_KINDS, overtureFacility, type OverturePlace } from './overture-place';

export const OVERTURE_PLACES = Symbol('OVERTURE_PLACES');

/** apps/api/data/overture-places — the same path from src/overture and dist/overture. */
export const DEFAULT_OVERTURE_DIR = join(__dirname, '..', '..', 'data', 'overture-places');

export const OVERTURE_FORMAT_VERSION = 1;
export const OVERTURE_EXTENSION = '.json.gz';

/** Photocopy, printing and stationery shops from Overture Maps for one area, prepared offline (see apps/api/scripts). */
export interface OvertureArea {
  version: typeof OVERTURE_FORMAT_VERSION;
  id: string;
  name: string;
  center: LatLng;
  radiusMeters: number;
  /** The Overture release the places come from, such as 2026-08-19.0. */
  release: string;
  generatedAt: string;
  places: OverturePlace[];
}

export interface OvertureAnswer {
  areaId: string;
  release: string;
  facilities: Facility[];
}

function isPlace(value: unknown): value is OverturePlace {
  const place = value as Partial<OverturePlace> | null;
  return (
    typeof place === 'object' &&
    place !== null &&
    typeof place.id === 'string' &&
    typeof place.kind === 'string' &&
    OVERTURE_KINDS.has(place.kind) &&
    typeof place.lat === 'number' &&
    typeof place.lng === 'number' &&
    typeof place.confidence === 'number'
  );
}

export function parseOvertureArea(value: unknown, origin: string): OvertureArea {
  const area = value as Partial<OvertureArea> | null;
  const valid =
    typeof area === 'object' &&
    area !== null &&
    area.version === OVERTURE_FORMAT_VERSION &&
    typeof area.id === 'string' &&
    typeof area.name === 'string' &&
    typeof area.center?.lat === 'number' &&
    typeof area.center.lng === 'number' &&
    typeof area.radiusMeters === 'number' &&
    typeof area.release === 'string' &&
    Array.isArray(area.places) &&
    area.places.every(isPlace);
  if (!valid) throw new Error(`${origin} is not a version ${OVERTURE_FORMAT_VERSION} Overture places file`);
  return area as OvertureArea;
}

/**
 * Overture shops for the areas prepared offline. An area answers only when it
 * contains the entire query circle, so every shop in the circle is included.
 */
export class OverturePlaces {
  constructor(private readonly areas: readonly OvertureArea[]) {}

  get ids(): string[] {
    return this.areas.map((area) => area.id);
  }

  /** Facilities for the shops within the circle, or null if no area contains the whole circle. */
  facilities(center: LatLng, radiusMeters: number): OvertureAnswer | null {
    const area = this.areas.find((candidate) => haversineMeters(candidate.center, center) + radiusMeters <= candidate.radiusMeters);
    if (area === undefined) return null;
    return {
      areaId: area.id,
      release: area.release,
      facilities: area.places.filter((place) => haversineMeters(center, place) <= radiusMeters).map(overtureFacility),
    };
  }

  /** Loads every area file in `directory`. A missing directory means no areas; an invalid file is an error. */
  static load(directory: string, logger: Pick<Logger, 'log'>): OverturePlaces {
    if (!existsSync(directory)) {
      logger.log(`No Overture places at ${directory}; photocopy, printing and stationery shops come from OpenStreetMap only.`);
      return new OverturePlaces([]);
    }
    const areas = readdirSync(directory)
      .filter((file) => file.endsWith(OVERTURE_EXTENSION))
      .sort()
      .map((file) => {
        const path = join(directory, file);
        return parseOvertureArea(JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')), path);
      });
    for (const area of areas) {
      logger.log(`Overture places "${area.id}": ${area.name}, ${area.radiusMeters} m, ${area.places.length} shops, release ${area.release}`);
    }
    return new OverturePlaces(areas);
  }
}
