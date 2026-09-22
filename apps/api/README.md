# @gayatama/api

NestJS backend. Loads OpenStreetMap POIs — from an offline snapshot for the demo
areas, otherwise through Overpass — caches them, adds Google business counts
when the client draws a Google map, derives mapped access barriers, and runs
`@gayatama/scoring` over the result. It also validates Firebase identity tokens
when an authenticated user registers a profile.

## Responsibilities

This service is deliberately thin. Scoring lives in `@gayatama/scoring`, which
both this API and the frontend import — so what remains here is only the work
that genuinely requires a server:

- Load OpenStreetMap data: from an OSM snapshot when one covers the area,
  otherwise from Overpass (slow, rate-limited, better not exposed to browsers
  directly), trying other public instances when one is unavailable
- Normalise OpenStreetMap tags into the engine's facility kinds
- Map major roads, motorways/toll roads, railways, and rivers/canals onto each
  facility's access penalty, while recognising crossings, fords, bridges, and
  tunnels
- Cache POI results, keyed by a snapped geohash cell — in memory, and in
  Firestore when Firebase is configured
- Add Overture Maps photocopy, printing and stationery shops in the areas
  prepared offline
- When a request sets `googleMap`, count businesses per distance zone with the
  Google Places Aggregate API, falling back to OpenStreetMap on any failure
- Hold the Firebase service account credential and the Google Places server key,
  which cannot live in a browser
- Reserve unique usernames in Firestore for Firebase-authenticated profiles;
  passwords never pass through this API
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

If startup reports `EADDRINUSE :::3000`, another process already owns the
configured port. In PowerShell, identify it with:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
Get-Process -Id <OwningProcess>
```

Stop that old development process, or run this stack on another matching pair
of ports (for example `PORT=3001` and
`VITE_API_BASE_URL=http://localhost:3001`).

## HTTP surface

- `GET /api/v1/health`
- `GET /api/v1/location`
- `POST /api/v1/analysis`
- `POST /api/v1/recommend`
- `POST /api/v1/compare`
- `POST /api/v1/compare-locations`
- `POST /api/v1/simulate`
- `POST /api/v1/opportunities` — sixteen analyses, one per kecamatan of Semarang, no point in the request, throttled to 4/minute
- `GET /api/v1/pois`
- `POST /api/v1/auth/register-profile` (Firebase bearer token required)

Report endpoints are planned, not part of the current API: the web app builds
its print-ready report in the browser from an analysis it already holds.

### Slow or unavailable map providers

Google Places and the public Overpass instances are optional upstream services.
A Google timeout is non-fatal and falls back to OpenStreetMap. For Overpass, the
API tries `OVERPASS_URL` followed by every URL in
`OVERPASS_FALLBACK_URLS`, serves stale cached POIs when available, and reports
upstream unavailability only when every instance fails and the location has
never been cached.

`OVERPASS_TIMEOUT_MS` is a per-instance timeout. A very high value makes each
failed fallback slow; for local development, start with `15000`–`30000` rather
than `60000`. The committed demo areas use offline snapshots and do not depend
on public Overpass availability.

## Structure

```
src/
├── main.ts          Bootstrap
├── setup.ts         Global prefix, CORS, proxy trust
├── app.module.ts    Configuration, rate limiting, error filter
├── config/          Validated environment variables
├── firebase/        Admin SDK initialisation (optional)
├── auth/            Firebase token guard and unique profile registration
├── osm-snapshots/   Offline OpenStreetMap snapshots for the demo areas
├── overture/        Overture Maps photocopy, printing and stationery shops for prepared areas
├── overpass/        Query builder, fallback client, normalisation, site conditions, access-barrier geometry
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
Google counts. Geometry tests cover barrier intersections and mapped passages.
`@gayatama/scoring` must be built first;
the root `npm test` does this.

Endpoint reference: [../../docs/api.md](../../docs/api.md). Data pipelines:
[OSM snapshots](../../docs/installation.md#osm-snapshots) and
[Overture places](../../docs/installation.md#overture-places).
