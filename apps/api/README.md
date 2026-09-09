# @gayatama/api

NestJS backend. Fetches OpenStreetMap POIs through Overpass, caches them in
Firestore, and runs `@gayatama/scoring` over the result.

## Responsibilities

This service is deliberately thin. Scoring lives in `@gayatama/scoring`, which
both this API and the frontend import — so what remains here is only the work
that genuinely requires a server:

- Query Overpass (slow, rate-limited, better not exposed to browsers directly)
- Cache POI results in Firestore, keyed by a snapped geohash cell
- Hold the Firebase service account credential, which cannot live in a browser
- Validate input and rate-limit clients

Controllers orchestrate. They do not calculate — anything that could live in the
engine belongs in the engine.

## Development

```bash
npm run dev:api     # from the repo root → http://localhost:3000
```

Requires `.env` at the repo root. See
[../../docs/installation.md](../../docs/installation.md).

## Structure

```
src/
├── config/      Typed, validated environment configuration
├── firebase/    Admin SDK initialisation, Firestore accessor
├── overpass/    Query builder, HTTP client, tag normaliser
├── poi/         Read-through cache; geohash key derivation
├── analysis/    Orchestration — calls the engine, assembles responses
└── common/      Filters, interceptors, Zod validation pipe
```

Endpoint reference: [../../docs/api.md](../../docs/api.md).
