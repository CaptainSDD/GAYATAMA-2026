# Architecture

## Overview

GAYATAMA is an npm-workspaces monorepo with three packages: a React frontend, a
NestJS API, and a shared scoring engine that both depend on.

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  apps/web  (React + Vite)    │         │  apps/api  (NestJS)          │
│                              │  HTTP   │                              │
│  • Leaflet map picker        │ ──────► │  • Overpass client           │
│  • Score breakdown panel     │ ◄────── │  • Firestore POI cache       │
│  • Business ranking          │         │  • Scoring orchestration     │
│  • What-if simulator ────┐   │         │  • Rate limiting             │
│  • Report / PDF export   │   │         │              │               │
└──────────────────────────┼───┘         └──────────────┼───────────────┘
                           │                            │
                           │   imports the same engine  │
                           └───────────┬────────────────┘
                                       ▼
                        ┌──────────────────────────────┐
                        │  packages/scoring            │
                        │  Pure TypeScript, no deps    │
                        └──────────────────────────────┘
                                       ▲
                                       │  read-through cache
                        ┌──────────────┴───────────────┐
                        │  Overpass API (OpenStreetMap)│
                        └──────────────────────────────┘
```

---

## The three design decisions that shaped everything else

### 1. The scoring engine is a pure package, not a service

`packages/scoring` has no dependencies, performs no I/O, and imports no
framework. It is a set of pure functions: facility data in, scores out.

This was not an aesthetic choice. It buys three specific things:

**The what-if simulator can run client-side.** Moving the parking slider must
feel instant. If scoring lived only on the server, every slider tick would cost
a network round trip, and the feature would be unusable on a conference wifi
connection. Because the engine is a portable pure function, the browser
recomputes locally while the POI data it operates on stays cached from the
original request.

**The frontend and backend cannot disagree.** Two implementations of the same
formula drift. One implementation, imported twice, cannot.

**The methodology becomes testable.** Every worked example in
[methodology.md](methodology.md) is an assertion in the engine's test suite.
Documentation drift turns the build red.

The constraint that keeps this true: **`packages/scoring` must never gain a
runtime dependency.** No HTTP client, no Firebase, no date library. If a
function needs data, it takes it as an argument.

### 2. The API exists for caching and secrets, not for logic

With scoring in a shared package, the API's remaining responsibilities are
narrow and honest:

- Query Overpass (slow, rate-limited, and something we would rather not expose
  a user's browser to directly)
- Cache results in Firestore
- Hold the Firebase service account credential, which cannot live in a browser
- Rate-limit and validate

Business logic that could live in the engine belongs in the engine. Controllers
orchestrate; they do not calculate.

### 3. POI queries are cached on a snapped grid, not on exact coordinates

The naive cache key is the exact latitude and longitude. It is also useless:
two clicks four metres apart produce different keys and both miss, while
returning near-identical data.

Instead, the cache key snaps the coordinate to a **geohash grid at precision 7**
(roughly 150 × 150 m). Every click within the same cell reuses the same cached
POI set.

The fetch is centred on the cell, not on the click, so it must still cover the
full 1,500 m circle around any point in the cell. The query radius is therefore
1,500 m plus the distance from the cell centre to its farthest corner — about
108 m at Surabaya's latitude, so roughly 1,608 m in total. Scoring then measures
every facility from the user's exact coordinate and ignores anything beyond
1,500 m. Snapping changes what is fetched and cached, never what is scored.

For a demo where judges will click repeatedly around the same neighbourhood,
this converts most interactions into cache hits and keeps the interface
responsive.

---

## Request flow

A location analysis, end to end:

```
1. User clicks the map
       │
2. web → POST /api/v1/analysis  { lat, lng, businessType }
       │
3. api: validate input (Zod)
       │
4. api: snap coordinate → geohash-7 cache key
       │
5. api: Firestore lookup
       │
       ├── HIT and fresh (< POI_CACHE_TTL_SECONDS) ──┐
       │                                             │
       └── MISS or stale                             │
              │                                      │
              ├─ Overpass query (1.5 km radius)      │
              ├─ normalise tags → typed facilities   │
              └─ write to Firestore cache ───────────┤
                                                     ▼
6. api: @gayatama/scoring — compute against the EXACT user coordinate
       │
7. api → web: scores, component breakdown, facility evidence, confidence
       │
8. web: render breakdown; retain the facility set in memory
       │
9. User moves a what-if slider
       │
10. web: @gayatama/scoring recomputes locally — no network call
```

Step 10 is the payoff from decision 1.

---

## Module layout

### `packages/scoring`

```
src/
├── index.ts              Public API surface
├── constants.ts          Every weight, factor and threshold
├── types.ts              Facility, LocationInput, LocationScoreResult, …
├── math.ts               Clamping and float-safe threshold comparison
├── distance.ts           Haversine, zone assignment, distance weighting
├── quality.ts            Data Quality, Access Factor, Facility Scale
├── evaluate.ts           Measures every facility against the location
├── segments.ts           Six target market segment scores
├── demand.ts             Segment scores → per-category Demand Fit
├── hours.ts              Opening-hours overlap
├── competition.ts        Competitor Equivalent Count, saturation, opportunity
├── accessibility.ts      Road, transit, walkability, parking
├── supporting.ts         Supporting Facility Fit
├── risk.ts               Risk and Operability, hard warnings
├── confidence.ts         Confidence Score and uncertainty margin
├── location-score.ts     Weighted composition of the five components
├── recommend.ts          Rank all seven categories
└── simulate.ts           What-if parameter overrides
test/                     Worked examples from methodology.md and api.md
```

Every constant lives in `constants.ts` rather than inline, so recalibration is a
single-file change and the numbers can be diffed against
[methodology.md](methodology.md).

The package builds twice — ES modules for the Vite frontend and CommonJS for the
NestJS API — so both apps load the same compiled engine.

### `apps/api`

```
src/
├── main.ts
├── app.module.ts
├── config/               Typed, validated environment configuration
├── firebase/             Admin SDK initialisation, Firestore accessor
├── overpass/             Query builder, HTTP client, tag normaliser
├── poi/                  Read-through cache; geohash key derivation
├── analysis/             Orchestration — calls the engine, assembles responses
└── common/               Filters, interceptors, Zod validation pipe
```

### `apps/web`

```
src/
├── main.tsx
├── App.tsx
├── features/
│   ├── map/              Leaflet picker, zone rings, facility markers
│   ├── score/            Score gauge, component breakdown, confidence interval
│   ├── recommend/        Ranked category list
│   ├── segments/         Target market panel with facility evidence
│   ├── competition/      Competitor list and saturation display
│   ├── simulate/         What-if controls (local recompute)
│   └── report/           Consolidated report and PDF export
├── lib/                  API client, query hooks, Firebase web SDK
└── components/           Shared UI primitives
```

---

## Data model (Firestore)

| Collection | Document ID | Contents |
|------------|-------------|----------|
| `poiCache` | geohash-7 cell | Normalised facilities, `fetchedAt`, source query hash |
| `reports` | auto ID | Saved analysis: coordinate, category, scores, model version, `createdAt` |

`poiCache` is the reason the API exists. `reports` exists so a user can compare
locations across sessions and so a report remains reproducible after weights
change — which is why each document stores the model version that produced it.

### Security rules

- `poiCache` — no client access. Server-side only, via the Admin SDK.
- `reports` — a client may read a report by ID; writes go through the API.

Rules are versioned in `firestore.rules`. See
[installation.md](installation.md#firebase-setup).

---

## Failure modes

Handled deliberately, because a demo that fails opaquely in front of judges is
worse than one that fails clearly.

| Failure | Behaviour |
|---------|-----------|
| Overpass times out or fails | Serve the expired cache entry if one exists, flagged `stale: true` with its original `fetchedAt`; otherwise return `504 UPSTREAM_TIMEOUT`, which the UI explains |
| Overpass rate-limits (429) or overloads (5xx) | Retry once after 1.5 seconds, then the above |
| Site-conditions query fails | Score road, walkability and risk inputs as unknown (neutral) rather than failing the request |
| Firestore unavailable | Degrade to the in-memory cache — slower after a restart, still correct. Caching is an optimisation, not a dependency |
| Area has almost no OSM data | Confidence falls and the interval widens; below 40 the API answers `422 INSUFFICIENT_DATA` with an explanation instead of a score |
| Coordinate outside Indonesia | Rejected at validation with `400 VALIDATION_FAILED` |

The third row matters: no single Firestore outage should be able to take the
demo down during judging.

---

## Deployment

| Component | Target | Notes |
|-----------|--------|-------|
| `apps/web` | Firebase Hosting | Static build; free tier is sufficient |
| `apps/api` | Cloud Run | Container; scales to zero. Cold start is masked by the POI cache |
| Firestore | Google Cloud | Same project as Hosting |

Cloud Run is preferred over Cloud Functions because NestJS cold starts are
noticeably slower under the Functions runtime, and a judge's first click should
not be the slow one.

Full steps: [installation.md](installation.md#deployment).
