import type { Logger } from '@nestjs/common';
import type { Facility } from '@gayatama/scoring';
import type { Firestore } from 'firebase-admin/firestore';

export const POI_CACHE = Symbol('POI_CACHE');

export interface CachedPois {
  cell: string;
  facilities: Facility[];
  fetchedAt: string;
  /** Missing on cache entries created before Geoapify support. */
  via?: 'overpass' | 'geoapify';
}

export interface PoiCache {
  get(cell: string): Promise<CachedPois | null>;
  set(entry: CachedPois): Promise<void>;
}

/** Least-recently-used cache for one API instance. */
export class InMemoryPoiCache implements PoiCache {
  private readonly entries = new Map<string, CachedPois>();

  constructor(private readonly maxEntries = 500) {}

  async get(cell: string): Promise<CachedPois | null> {
    const entry = this.entries.get(cell);
    if (entry === undefined) return null;
    this.entries.delete(cell);
    this.entries.set(cell, entry);
    return entry;
  }

  async set(entry: CachedPois): Promise<void> {
    this.entries.delete(entry.cell);
    this.entries.set(entry.cell, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

const COLLECTION = 'poiCache';
/** Firestore documents are limited to 1 MiB. */
const MAX_DOCUMENT_BYTES = 900_000;

/** `poiCache/{geohash-7 cell}`. Facilities are stored as one JSON string to avoid indexing every field. */
export class FirestorePoiCache implements PoiCache {
  constructor(private readonly firestore: Firestore) {}

  async get(cell: string): Promise<CachedPois | null> {
    const snapshot = await this.firestore.collection(COLLECTION).doc(cell).get();
    const data = snapshot.data();
    if (data === undefined || typeof data.facilities !== 'string' || typeof data.fetchedAt !== 'string') return null;
    const via = data.source === 'geoapify' ? 'geoapify' : 'overpass';
    return { cell, fetchedAt: data.fetchedAt, facilities: JSON.parse(data.facilities) as Facility[], via };
  }

  async set(entry: CachedPois): Promise<void> {
    const facilities = JSON.stringify(entry.facilities);
    if (Buffer.byteLength(facilities) > MAX_DOCUMENT_BYTES) return;
    await this.firestore
      .collection(COLLECTION)
      .doc(entry.cell)
      .set({ facilities, fetchedAt: entry.fetchedAt, source: entry.via ?? 'overpass' });
  }
}

/** Memory first, then Firestore. A Firestore failure degrades to memory only. */
export class LayeredPoiCache implements PoiCache {
  constructor(
    private readonly memory: PoiCache,
    private readonly durable: PoiCache | null,
    private readonly logger: Logger,
  ) {}

  async get(cell: string): Promise<CachedPois | null> {
    const hit = await this.memory.get(cell);
    if (hit !== null || this.durable === null) return hit;
    try {
      const stored = await this.durable.get(cell);
      if (stored !== null) await this.memory.set(stored);
      return stored;
    } catch (error) {
      this.logger.warn(`Firestore read failed, continuing without it: ${String(error)}`);
      return null;
    }
  }

  async set(entry: CachedPois): Promise<void> {
    await this.memory.set(entry);
    if (this.durable === null) return;
    try {
      await this.durable.set(entry);
    } catch (error) {
      this.logger.warn(`Firestore write failed, continuing without it: ${String(error)}`);
    }
  }
}
