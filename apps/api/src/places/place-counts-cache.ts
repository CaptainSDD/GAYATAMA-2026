import type { Logger } from '@nestjs/common';
import type { FacilityCount } from '@gayatama/scoring';
import type { Firestore } from 'firebase-admin/firestore';

export const PLACE_COUNTS_CACHE = Symbol('PLACE_COUNTS_CACHE');

export interface CachedPlaceCounts {
  cell: string;
  counts: FacilityCount[];
  fetchedAt: string;
}

export interface PlaceCountsCache {
  get(cell: string): Promise<CachedPlaceCounts | null>;
  set(entry: CachedPlaceCounts): Promise<void>;
}

/** Least-recently-used cache for one API process. */
export class InMemoryPlaceCountsCache implements PlaceCountsCache {
  private readonly entries = new Map<string, CachedPlaceCounts>();

  constructor(private readonly maxEntries = 2000) {}

  async get(cell: string): Promise<CachedPlaceCounts | null> {
    const entry = this.entries.get(cell);
    if (entry === undefined) return null;
    this.entries.delete(cell);
    this.entries.set(cell, entry);
    return entry;
  }

  async set(entry: CachedPlaceCounts): Promise<void> {
    this.entries.delete(entry.cell);
    this.entries.set(entry.cell, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

const COLLECTION = 'placeCountCache';

/** Durable Google aggregate counts; their TTL is enforced by PlaceCountsService. */
export class FirestorePlaceCountsCache implements PlaceCountsCache {
  constructor(private readonly firestore: Firestore) {}

  async get(cell: string): Promise<CachedPlaceCounts | null> {
    const data = (await this.firestore.collection(COLLECTION).doc(cell).get()).data();
    if (data === undefined || !Array.isArray(data.counts) || typeof data.fetchedAt !== 'string') return null;
    return { cell, counts: data.counts as FacilityCount[], fetchedAt: data.fetchedAt };
  }

  async set(entry: CachedPlaceCounts): Promise<void> {
    await this.firestore.collection(COLLECTION).doc(entry.cell).set({ counts: entry.counts, fetchedAt: entry.fetchedAt });
  }
}

/** Memory first, then Firestore. Firebase trouble must never stop an analysis. */
export class LayeredPlaceCountsCache implements PlaceCountsCache {
  constructor(
    private readonly memory: PlaceCountsCache,
    private readonly durable: PlaceCountsCache | null,
    private readonly logger: Pick<Logger, 'warn'>,
  ) {}

  async get(cell: string): Promise<CachedPlaceCounts | null> {
    const hit = await this.memory.get(cell);
    if (hit !== null || this.durable === null) return hit;
    try {
      const stored = await this.durable.get(cell);
      if (stored !== null) await this.memory.set(stored);
      return stored;
    } catch (error) {
      this.logger.warn(`Firestore place-count read failed, continuing without it: ${String(error)}`);
      return null;
    }
  }

  async set(entry: CachedPlaceCounts): Promise<void> {
    await this.memory.set(entry);
    if (this.durable === null) return;
    try {
      await this.durable.set(entry);
    } catch (error) {
      this.logger.warn(`Firestore place-count write failed, continuing without it: ${String(error)}`);
    }
  }
}
