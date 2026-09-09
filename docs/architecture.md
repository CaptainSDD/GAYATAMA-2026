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

The trade-off is stated plainly: a location near a cell boundary reuses the
neighbouring cell's POI set, so its facility distances are computed from the
cell centre rather than the exact click. At precision 7 the error is bounded by
roughly 75 m — well inside Zone A's 300 m band, so zone assignment is unchanged
for all but facilities sitting almost exactly on a zone boundary. Scoring still
uses the user's exact coordinate; only the POI *fetch* is shared.

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
├── constants.ts          Zone weights, category weights, T values, thresholds
├── types.ts              Facility, Competitor, Segment, ScoreResult
├── distance.ts           Haversine, zone assignment, distance weighting
├── quality.ts            Data Quality and Access Factor derivation
├── segments.ts           Six target market segment scores
├── demand.ts             Segment scores → per-category Demand Fit
├── competition.ts        Competitor Equivalent Count, saturation, opportunity
├── accessibility.ts      Road, transit, walkability, parking
├── risk.ts               Risk and Operability
├── confidence.ts         Confidence Score and uncertainty margin
├── location-score.ts     Weighted composition of the five components
├── recommend.ts          Rank all seven categories
└── simulate.ts           What-if parameter overrides
```

Every constant lives in `constants.ts` rather than inline, so recalibration is a
single-file change and the numbers can be diffed against
[methodology.md](methodology.md).

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
| Overpass times out | Serve stale cache if any exists, flagged as stale with a reduced Confidence Score; otherwise return a typed error the UI explains |
| Overpass rate-limits (429) | Exponential backoff, then the above |
| Firestore unavailable | Degrade to direct Overpass queries — slower, still correct. Caching is an optimisation, not a dependency |
| Area has almost no OSM data | Not an error. Confidence falls, the interval widens, and below 40 the recommendation is suppressed with an explanation |
| Coordinate outside any mapped area | Rejected at validation with a clear message |

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
