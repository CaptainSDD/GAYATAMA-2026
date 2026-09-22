import type { LatLng } from '@gayatama/scoring';
import type { OverpassElement } from '../src/overpass/overpass-element';

/** UNESA Ketintang, Surabaya. */
export const ORIGIN: LatLng = { lat: -7.3145, lng: 112.7263 };

const METERS_PER_DEGREE = (6_371_008.8 * Math.PI) / 180;
const RECENT_EDIT = '2026-08-01T00:00:00Z';

let nextId = 1;

export function offset(origin: LatLng, northMeters: number, eastMeters: number): { lat: number; lon: number } {
  return {
    lat: origin.lat + northMeters / METERS_PER_DEGREE,
    lon: origin.lng + eastMeters / (METERS_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180)),
  };
}

export function node(tags: Record<string, string>, north: number, east: number, origin = ORIGIN): OverpassElement {
  const { lat, lon } = offset(origin, north, east);
  return { type: 'node', id: nextId++, lat, lon, tags, timestamp: RECENT_EDIT };
}

export function area(tags: Record<string, string>, north: number, east: number, origin = ORIGIN): OverpassElement {
  return { type: 'way', id: nextId++, center: offset(origin, north, east), tags, timestamp: RECENT_EDIT };
}

export function line(tags: Record<string, string>, points: [north: number, east: number][], origin = ORIGIN): OverpassElement {
  return { type: 'way', id: nextId++, geometry: points.map(([n, e]) => offset(origin, n, e)), tags };
}

/** A mapped campus neighbourhood, dense enough for a confident score. */
export function neighbourhood(origin = ORIGIN): OverpassElement[] {
  return [
    node({ amenity: 'university', name: 'Universitas Negeri Surabaya', check_date: '2026-06-01' }, 250, 0, origin),
    node({ amenity: 'school', name: 'SDN Ketintang' }, 0, 500, origin),
    node({ amenity: 'school', name: 'SMPN 22' }, 0, -400, origin),
    node({ office: 'company', name: 'Kantor A' }, -600, 0, origin),
    node({ office: 'government', name: 'Kelurahan Ketintang' }, -600, 100, origin),
    area({ landuse: 'residential' }, 900, 0, origin),
    area({ building: 'apartments', name: 'Apartemen' }, 0, 1100, origin),
    node({ tourism: 'guest_house', name: 'Kos Putri' }, 0, 700, origin),
    node({ highway: 'bus_stop' }, -350, 0, origin),
    node({ amenity: 'cafe', name: 'Kopi Kampus', opening_hours: 'Mo-Su 08:00-22:00' }, 0, -200, origin),
    node({ shop: 'laundry', name: 'Laundry Kilat' }, 0, 900, origin),
    node({ amenity: 'atm' }, 150, 0, origin),
    node({ amenity: 'parking', capacity: '20' }, 0, 120, origin),
    node({ amenity: 'hospital', name: 'RS Bhakti' }, -1300, 0, origin),
    node({ shop: 'convenience', name: 'Minimarket' }, 450, 0, origin),
  ];
}

export function siteElements(origin = ORIGIN): OverpassElement[] {
  return [
    line({ highway: 'tertiary', sidewalk: 'both' }, [[-100, -20], [100, -20]], origin),
    line({ highway: 'service' }, [[-100, 5], [100, 5]], origin),
    node({ highway: 'crossing' }, 40, -20, origin),
  ];
}

interface DocRef {
  collection: 'usernames' | 'users';
  id: string;
}

/**
 * Just enough of the Firestore Admin SDK for `AuthService` to run against —
 * both the transactional writes `registerProfile` uses and the plain
 * `doc().get()`/`doc().set(data, { merge })` reads/writes `getProfile`,
 * `saveWeights` and `setPlan` use outside a transaction.
 */
export class FakeFirestore {
  usernames = new Map<string, unknown>();
  users = new Map<string, unknown>();

  private store(name: 'usernames' | 'users') {
    return name === 'usernames' ? this.usernames : this.users;
  }

  collection(name: 'usernames' | 'users') {
    const store = this.store(name);
    return {
      doc: (id: string): DocRef & { get: () => Promise<unknown>; set: (data: unknown, options?: { merge?: boolean }) => Promise<void> } => ({
        collection: name,
        id,
        get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
        set: async (data: unknown, options?: { merge?: boolean }) => {
          const current = options?.merge === true ? ((store.get(id) as object | undefined) ?? {}) : {};
          store.set(id, { ...current, ...(data as object) });
        },
      }),
    };
  }

  async runTransaction<T>(fn: (tx: FakeFirestoreTransaction) => Promise<T>): Promise<T> {
    return fn(new FakeFirestoreTransaction(this));
  }
}

class FakeFirestoreTransaction {
  constructor(private readonly firestore: FakeFirestore) {}

  async get(ref: DocRef) {
    const store = ref.collection === 'usernames' ? this.firestore.usernames : this.firestore.users;
    return { exists: store.has(ref.id), data: () => store.get(ref.id) };
  }

  set(ref: DocRef, data: unknown) {
    const store = ref.collection === 'usernames' ? this.firestore.usernames : this.firestore.users;
    store.set(ref.id, data);
  }
}
