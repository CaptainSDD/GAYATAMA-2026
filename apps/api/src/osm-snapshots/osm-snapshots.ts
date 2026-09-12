import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { Logger } from '@nestjs/common';
import { haversineMeters, type LatLng } from '@gayatama/scoring';
import type { OverpassElement } from '../overpass/overpass-element';
import { MAX_SITE_QUERY_RADIUS_METERS, matchesSiteQuery } from '../overpass/queries';

export const OSM_SNAPSHOTS = Symbol('OSM_SNAPSHOTS');

/** apps/api/data/osm-snapshots — the same path from src/osm-snapshots and dist/osm-snapshots. */
export const DEFAULT_SNAPSHOT_DIR = join(__dirname, '..', '..', 'data', 'osm-snapshots');

export const SNAPSHOT_FORMAT_VERSION = 1;
export const SNAPSHOT_EXTENSION = '.json.gz';

/**
 * OpenStreetMap data for one area, prepared offline from a Geofabrik extract
 * (see apps/api/scripts). `pois` holds every element the POI query could return
 * inside the circle; `site` every element the site query could.
 */
export interface OsmSnapshot {
  version: typeof SNAPSHOT_FORMAT_VERSION;
  id: string;
  name: string;
  center: LatLng;
  radiusMeters: number;
  /** When the OpenStreetMap data was current: the extract's replication timestamp. */
  dataTimestamp: string;
  source: string;
  generatedAt: string;
  pois: OverpassElement[];
  site: OverpassElement[];
}

export interface SnapshotAnswer {
  snapshotId: string;
  dataTimestamp: string;
  elements: OverpassElement[];
}

/** A node's position, or the centre Overpass reports for a way or relation. */
export function elementPoint(element: OverpassElement): LatLng | null {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  return lat === undefined || lng === undefined ? null : { lat, lng };
}

export function parseSnapshot(value: unknown, origin: string): OsmSnapshot {
  const snapshot = value as Partial<OsmSnapshot> | null;
  const valid =
    typeof snapshot === 'object' &&
    snapshot !== null &&
    snapshot.version === SNAPSHOT_FORMAT_VERSION &&
    typeof snapshot.id === 'string' &&
    typeof snapshot.name === 'string' &&
    typeof snapshot.center?.lat === 'number' &&
    typeof snapshot.center.lng === 'number' &&
    typeof snapshot.radiusMeters === 'number' &&
    typeof snapshot.dataTimestamp === 'string' &&
    !Number.isNaN(Date.parse(snapshot.dataTimestamp)) &&
    Array.isArray(snapshot.pois) &&
    Array.isArray(snapshot.site);
  if (!valid) throw new Error(`${origin} is not a version ${SNAPSHOT_FORMAT_VERSION} OSM snapshot`);
  return snapshot as OsmSnapshot;
}

/**
 * Answers the POI and site queries from snapshots instead of Overpass. A
 * snapshot answers only when it contains the entire query circle, so its answer
 * is what Overpass would return for the same OpenStreetMap data.
 */
export class OsmSnapshots {
  constructor(private readonly snapshots: readonly OsmSnapshot[]) {}

  get ids(): string[] {
    return this.snapshots.map((snapshot) => snapshot.id);
  }

  /** The elements buildPoiQuery(center, radiusMeters) would return, or null if no snapshot covers the circle. */
  pois(center: LatLng, radiusMeters: number): SnapshotAnswer | null {
    const snapshot = this.covering(center, radiusMeters);
    if (snapshot === undefined) return null;
    return answer(
      snapshot,
      snapshot.pois.filter((element) => {
        const point = elementPoint(element);
        return point !== null && haversineMeters(center, point) <= radiusMeters;
      }),
    );
  }

  /** The elements buildSiteQuery(point) would return, or null if no snapshot covers the site. */
  site(point: LatLng): SnapshotAnswer | null {
    const snapshot = this.covering(point, MAX_SITE_QUERY_RADIUS_METERS);
    if (snapshot === undefined) return null;
    return answer(
      snapshot,
      snapshot.site.filter((element) => matchesSiteQuery(element, point)),
    );
  }

  private covering(center: LatLng, radiusMeters: number): OsmSnapshot | undefined {
    return this.snapshots.find(
      (snapshot) => haversineMeters(snapshot.center, center) + radiusMeters <= snapshot.radiusMeters,
    );
  }

  /** Loads every snapshot in `directory`. A missing directory means no snapshots; an invalid file is an error. */
  static load(directory: string, logger: Pick<Logger, 'log'>): OsmSnapshots {
    if (!existsSync(directory)) {
      logger.log(`No OSM snapshots at ${directory}; every area uses Overpass.`);
      return new OsmSnapshots([]);
    }
    const snapshots = readdirSync(directory)
      .filter((file) => file.endsWith(SNAPSHOT_EXTENSION))
      .sort()
      .map((file) => {
        const path = join(directory, file);
        return parseSnapshot(JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')), path);
      });
    for (const snapshot of snapshots) {
      logger.log(
        `OSM snapshot "${snapshot.id}": ${snapshot.name}, ${snapshot.radiusMeters} m, data as of ${snapshot.dataTimestamp}`,
      );
    }
    return new OsmSnapshots(snapshots);
  }
}

function answer(snapshot: OsmSnapshot, elements: OverpassElement[]): SnapshotAnswer {
  return { snapshotId: snapshot.id, dataTimestamp: snapshot.dataTimestamp, elements };
}
