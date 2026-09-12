/**
 * Builds the Overture place files the API serves from apps/api/data/overture-places,
 * using the raw area extracts written by overture_extract.py. Only photocopy,
 * printing and stationery shops are kept, by the API's own rules, and records
 * for the same shop are merged.
 *
 *   npm run overture:places -w @gayatama/api -- <raw directory> [output directory]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { haversineMeters, type LatLng } from '@gayatama/scoring';
import {
  SAME_PLACE_METERS,
  samePlace,
  toOverturePlace,
  type OverturePlace,
  type RawOverturePlace,
} from '../src/overture/overture-place';
import {
  DEFAULT_OVERTURE_DIR,
  OVERTURE_EXTENSION,
  OVERTURE_FORMAT_VERSION,
  parseOvertureArea,
  type OvertureArea,
} from '../src/overture/overture-places';

/** One area as written by overture_extract.py. */
export interface RawOvertureArea {
  id: string;
  name: string;
  center: LatLng;
  radiusMeters: number;
  release: string;
  places: RawOverturePlace[];
}

export function buildOvertureArea(raw: RawOvertureArea, generatedAt: string): OvertureArea {
  // Most confident first, so of two records for one shop the more confident is kept.
  const candidates = raw.places
    .map(toOverturePlace)
    .filter((place): place is OverturePlace => place !== null && haversineMeters(raw.center, place) <= raw.radiusMeters)
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id));

  const places: OverturePlace[] = [];
  for (const place of candidates) {
    if (!places.some((kept) => samePlace(place, kept, SAME_PLACE_METERS))) places.push(place);
  }

  return parseOvertureArea(
    {
      version: OVERTURE_FORMAT_VERSION,
      id: raw.id,
      name: raw.name,
      center: raw.center,
      radiusMeters: raw.radiusMeters,
      release: raw.release,
      generatedAt,
      places: places.sort((a, b) => a.id.localeCompare(b.id)),
    },
    `raw area "${raw.id}"`,
  );
}

function main(): void {
  const [rawDirectory, outputDirectory = DEFAULT_OVERTURE_DIR] = process.argv.slice(2);
  if (rawDirectory === undefined) {
    console.error('Usage: npm run overture:places -w @gayatama/api -- <raw directory> [output directory]');
    process.exit(1);
  }

  mkdirSync(outputDirectory, { recursive: true });
  const generatedAt = new Date().toISOString();
  const files = readdirSync(rawDirectory).filter((file) => file.endsWith('.json')).sort();
  if (files.length === 0) throw new Error(`No raw area files (*.json) in ${rawDirectory}`);

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(rawDirectory, file), 'utf8')) as RawOvertureArea;
    const area = buildOvertureArea(raw, generatedAt);
    const bytes = gzipSync(JSON.stringify(area), { level: 9 });
    const target = join(outputDirectory, `${area.id}${OVERTURE_EXTENSION}`);
    writeFileSync(target, bytes);
    const kinds = area.places.reduce<Record<string, number>>((counts, place) => {
      counts[place.kind] = (counts[place.kind] ?? 0) + 1;
      return counts;
    }, {});
    console.log(
      `${area.id}: ${area.places.length} shops of ${raw.places.length} places ${JSON.stringify(kinds)}, ` +
        `${Math.round(bytes.length / 1024)} KB → ${target}`,
    );
  }
}

if (require.main === module) main();
