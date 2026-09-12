/**
 * Builds the OSM snapshots the API serves from apps/api/data/osm-snapshots, using
 * the raw area extracts written by osm_extract.py. Filtering uses the API's own
 * tag tables and query rules, so a snapshot holds exactly the elements the
 * Overpass queries could return inside its circle.
 *
 *   npm run osm:snapshots -w @gayatama/api -- <raw directory> [output directory]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { haversineMeters, type LatLng } from '@gayatama/scoring';
import {
  DEFAULT_SNAPSHOT_DIR,
  SNAPSHOT_EXTENSION,
  SNAPSHOT_FORMAT_VERSION,
  elementPoint,
  parseSnapshot,
  type OsmSnapshot,
} from '../src/osm-snapshots/osm-snapshots';
import { facilityKind } from '../src/overpass/normalize';
import type { OverpassElement } from '../src/overpass/overpass-element';
import { elementGeometry, isSiteQueryCandidate } from '../src/overpass/queries';
import { distanceToGeometryMeters } from '../src/overpass/site';

/** One area as written by osm_extract.py. */
export interface RawArea {
  id: string;
  name: string;
  center: LatLng;
  radiusMeters: number;
  source: string;
  dataTimestamp: string;
  elements: OverpassElement[];
}

/** The only tags the site conditions read; everything else is dropped from site elements. */
const SITE_TAG_KEYS = new Set(['highway', 'waterway', 'landuse', 'sidewalk']);

const round7 = (value: number): number => Math.round(value * 1e7) / 1e7;

const byTypeAndId = (a: OverpassElement, b: OverpassElement): number =>
  a.type.localeCompare(b.type) || a.id - b.id;

function poiElement(element: OverpassElement, point: LatLng): OverpassElement {
  const out: OverpassElement = { type: element.type, id: element.id };
  if (element.type === 'node') {
    out.lat = round7(point.lat);
    out.lon = round7(point.lng);
  } else {
    out.center = { lat: round7(point.lat), lon: round7(point.lng) };
  }
  if (element.tags !== undefined) out.tags = element.tags;
  if (element.timestamp !== undefined) out.timestamp = element.timestamp;
  return out;
}

function siteElement(element: OverpassElement): OverpassElement {
  const tags = Object.fromEntries(Object.entries(element.tags ?? {}).filter(([key]) => SITE_TAG_KEYS.has(key)));
  const geometry = elementGeometry(element).map((p) => ({ lat: round7(p.lat), lon: round7(p.lon) }));
  const out: OverpassElement = { type: element.type, id: element.id, tags };
  if (element.type === 'node') {
    const [position] = geometry;
    if (position !== undefined) {
      out.lat = position.lat;
      out.lon = position.lon;
    }
  } else {
    out.geometry = geometry;
  }
  return out;
}

export function buildSnapshot(raw: RawArea, generatedAt: string): OsmSnapshot {
  const pois: OverpassElement[] = [];
  const site: OverpassElement[] = [];

  for (const element of raw.elements) {
    const point = elementPoint(element);
    if (
      point !== null &&
      facilityKind(element.tags ?? {}) !== null &&
      haversineMeters(raw.center, point) <= raw.radiusMeters
    ) {
      pois.push(poiElement(element, point));
    }
    if (
      isSiteQueryCandidate(element) &&
      distanceToGeometryMeters(raw.center, elementGeometry(element)) <= raw.radiusMeters
    ) {
      site.push(siteElement(element));
    }
  }

  return parseSnapshot(
    {
      version: SNAPSHOT_FORMAT_VERSION,
      id: raw.id,
      name: raw.name,
      center: raw.center,
      radiusMeters: raw.radiusMeters,
      dataTimestamp: raw.dataTimestamp,
      source: raw.source,
      generatedAt,
      pois: pois.sort(byTypeAndId),
      site: site.sort(byTypeAndId),
    },
    `raw area "${raw.id}"`,
  );
}

function main(): void {
  const [rawDirectory, outputDirectory = DEFAULT_SNAPSHOT_DIR] = process.argv.slice(2);
  if (rawDirectory === undefined) {
    console.error('Usage: npm run osm:snapshots -w @gayatama/api -- <raw directory> [output directory]');
    process.exit(1);
  }

  mkdirSync(outputDirectory, { recursive: true });
  const generatedAt = new Date().toISOString();
  const files = readdirSync(rawDirectory).filter((file) => file.endsWith('.json')).sort();
  if (files.length === 0) throw new Error(`No raw area files (*.json) in ${rawDirectory}`);

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(rawDirectory, file), 'utf8')) as RawArea;
    const snapshot = buildSnapshot(raw, generatedAt);
    const bytes = gzipSync(JSON.stringify(snapshot), { level: 9 });
    const target = join(outputDirectory, `${snapshot.id}${SNAPSHOT_EXTENSION}`);
    writeFileSync(target, bytes);
    console.log(
      `${snapshot.id}: ${snapshot.pois.length} POI elements, ${snapshot.site.length} site elements, ` +
        `${Math.round(bytes.length / 1024)} KB → ${target}`,
    );
  }
}

if (require.main === module) main();
