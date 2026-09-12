# @gayatama/api

NestJS backend. Fetches OpenStreetMap POIs — through Geoapify Places when
`GEOAPIFY_API_KEY` is set, otherwise Overpass — caches them, and runs
`@gayatama/scoring` over the result.

## Responsibilities

This service is deliberately thin. Scoring lives in `@gayatama/scoring`, which
both this API and the frontend import — so what remains here is only the work
that genuinely requires a server:

- Query the POI source: Geoapify Places for facilities, Overpass for site
  conditions (slow, rate-limited, better not exposed to browsers directly)
- Hold the Geoapify API key, which must stay off the browser
- Normalise OpenStreetMap tags into the engine's facility kinds — Geoapify
  passes the original OSM tags through, so one normaliser serves both sources
- Cache POI results, keyed by a snapped geohash cell — in memory, and in
  Firestore when Firebase is configured
- Hold the Firebase service account credential, which cannot live in a browser
- Validate input and rate-limit clients

Controllers orchestrate. They do not calculate — anything that could live in the
engine belongs in the engine.

## Development

```bash
npm run dev:api     # from the repo root → http://localhost:3000
```

Reads `.env` from the repo root. Firebase is optional: without it the POI cache
is in memory and is lost on restart. See
[../../docs/installation.md](../../docs/installation.md).

## Structure

```
src/
├── main.ts          Bootstrap
├── setup.ts         Global prefix, CORS, proxy trust
├── app.module.ts    Configuration, rate limiting, error filter
├── config/          Validated environment variables
├── firebase/        Admin SDK initialisation (optional)
├── overpass/        Query builder, HTTP client, tag normaliser, opening hours, site conditions
├── poi/             Read-through cache and geohash cell logic
├── analysis/        Endpoints, request schemas, response presenters
└── common/          Error contract, Zod validation pipe, geohash
test/                Unit tests and end-to-end tests against a fake Overpass client
```

## Testing

```bash
npm test --workspace @gayatama/api
```

The tests never reach the real Overpass API. The end-to-end suite starts the
full Nest application with a fake Overpass client and checks every endpoint and
error code. `@gayatama/scoring` must be built first; the root `npm test` does
this.

Endpoint reference: [../../docs/api.md](../../docs/api.md).
