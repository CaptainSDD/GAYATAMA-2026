# @gayatama/api

NestJS backend. Loads OpenStreetMap POIs — from an offline snapshot for the demo
areas, otherwise through Overpass — caches them, adds Google business counts
when the client draws a Google map, and runs `@gayatama/scoring` over the result.

## Responsibilities

This service is deliberately thin. Scoring lives in `@gayatama/scoring`, which
both this API and the frontend import — so what remains here is only the work
that genuinely requires a server:

- Load OpenStreetMap data: from an OSM snapshot when one covers the area,
  otherwise from Overpass (slow, rate-limited, better not exposed to browsers
  directly), trying other public instances when one is unavailable
- Normalise OpenStreetMap tags into the engine's facility kinds
- Cache POI results, keyed by a snapped geohash cell — in memory, and in
  Firestore when Firebase is configured
- Add Overture Maps photocopy, printing and stationery shops in the areas
  prepared offline
- When a request sets `googleMap`, count businesses per distance zone with the
  Google Places Aggregate API, falling back to OpenStreetMap on any failure
- Hold the Firebase service account credential and the Google Places server key,
  which cannot live in a browser
- Validate input and rate-limit clients

Controllers orchestrate. They do not calculate — anything that could live in the
engine belongs in the engine.

## Development

```bash
npm run dev:api     # from the repo root → http://localhost:3000
```

Reads `.env` from the repo root. Firebase and Google are optional: without
Firebase the POI cache is in memory and is lost on restart; without
`GOOGLE_PLACES_API_KEY` every facility comes from OpenStreetMap. See
[../../docs/installation.md](../../docs/installation.md).

## Structure

```
src/
├── main.ts          Bootstrap
├── setup.ts         Global prefix, CORS, proxy trust
├── app.module.ts    Configuration, rate limiting, error filter
├── config/          Validated environment variables
├── firebase/        Admin SDK initialisation (optional)
├── osm-snapshots/   Offline OpenStreetMap snapshots for the demo areas
├── overture/        Overture Maps photocopy, printing and stationery shops for prepared areas
├── overpass/        Query builder, HTTP client with fallback instances, tag normaliser, opening hours, site conditions
├── places/          Google Places Aggregate client, type mapping, zone counts and their cache
├── poi/             Snapshot, cache and Overpass lookup; geohash cell logic
├── analysis/        Endpoints, request schemas, response presenters
└── common/          Error contract, Zod validation pipe, geohash, concurrency limiter
data/osm-snapshots/  Snapshot files, published under ODbL 1.0
data/overture-places/ Overture shop files, published under CDLA Permissive 2.0
scripts/             Data pipelines: osm_extract.py, build-osm-snapshots.ts, osm-areas.json;
                     overture_extract.py, build-overture-places.ts, overture-areas.json
test/                Unit tests and end-to-end tests against fake Overpass and Google clients
```

## Testing

```bash
npm test --workspace @gayatama/api
```

The tests never reach the real Overpass or Google APIs. The end-to-end suite
starts the full Nest application with fake Overpass and Google clients, and
without snapshots, and checks every endpoint and error code, with and without
Google counts. `@gayatama/scoring` must be built first;
the root `npm test` does this.

Endpoint reference: [../../docs/api.md](../../docs/api.md). Data pipelines:
[OSM snapshots](../../docs/installation.md#osm-snapshots) and
[Overture places](../../docs/installation.md#overture-places).
