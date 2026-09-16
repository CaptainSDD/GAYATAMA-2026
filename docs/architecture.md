# Architecture

## Overview

GAYATAMA is an npm-workspaces monorepo with a React frontend, a NestJS API and a
shared pure-TypeScript scoring package.

```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ apps/web (React + Vite)         │ HTTP │ apps/api (NestJS)               │
│ • Firebase login/signup         │ ───► │ • Firebase token/profile guard  │
│ • Semarang map + location sheet │ ◄─── │ • Geoapify/Overpass/Google I/O │
│ • Score, ranking and evidence   │      │ • POI cache + orchestration     │
└─────────────────────────────────┘      │ • deterministic + LLM narrative │
                                        └──────────────┬──────────────────┘
                                                       │
                                  ┌────────────────────▼──────────────────┐
                                  │ packages/scoring                     │
                                  │ Pure TypeScript, deterministic, no I/O│
                                  └───────────────────────────────────────┘
```

The current web experience is Indonesian and Semarang-facing. It accepts map
points only inside the Semarang boundary, reverse-geocodes a selected point for
confirmation, then presents results in four tabs: **Skor**, **Pilihan usaha**,
**Pelanggan** and **Pesaing**. On narrow screens the analysis panel becomes a
bottom sheet. OpenStreetMap/Leaflet and Google map presentation are both
supported by configuration.

Google Maps Platform is optional. With keys, the web app draws a Google map and
the API adds selected small-business counts from the Places Aggregate API;
without them, scoring uses OpenStreetMap and Overture data. Firebase Auth is
also optional at deployment time: when configured, signed-out visitors are
redirected to login; if it is unavailable, the core map and scoring experience
continues without an account.

---

## The three design decisions that shaped everything else

### 1. The scoring engine is a pure package, not a service

`packages/scoring` has no dependencies, performs no I/O, and imports no
framework. It is a set of pure functions: facility data in, scores out.

This keeps the methodology deterministic and testable. Every worked example in
[methodology.md](methodology.md) is an assertion in the engine test suite, so
documentation drift turns the build red. It also leaves room for a future
client-side what-if simulator without duplicating formulas; that simulator is
not implemented in the current web app.

The constraint that keeps this true: **`packages/scoring` must never gain a
runtime dependency.** No HTTP client, no Firebase, no date library. If a
function needs data, it takes it as an argument.

### 2. The API owns external I/O, cache policy and trusted credentials

The API:

- uses an offline OSM snapshot when available, otherwise Geoapify Places when
  configured or Overpass when it is not, and separately queries Overpass for
  exact-site conditions;
- asks Google for selected small-business counts only when the client draws a
  Google map;
- caches normalized OSM facilities in memory and Firestore, while Google counts
  use bounded process memory only;
- verifies Firebase ID tokens and atomically creates profiles and lowercase
  username reservations in Firestore;
- holds Firebase Admin, Geoapify, Google Places and Groq credentials, and applies
  validation, rate limiting and normalized error handling.

Business logic that can live in the engine belongs there. Controllers and
services orchestrate; they do not calculate the score. Narrative generation is
also downstream of scoring: it may explain fixed facts but cannot alter them.

### 3. POI queries are cached on a snapped grid, not on exact coordinates

The naive cache key is the exact latitude and longitude. It is also useless:
two clicks four metres apart produce different keys and both miss, while
returning near-identical data.

Instead, the cache key snaps the coordinate to a **geohash grid at precision 7**
(roughly 150 × 150 m). Every click within the same cell reuses the same cached
POI set.

The fetch is centred on the cell, not on the click, so it must still cover the
full 1,500 m circle around any point in the cell. The query radius is therefore
1,500 m plus the computed half-diagonal of that cell. Scoring then measures
every facility from the user's exact coordinate and ignores anything beyond
1,500 m. Snapping changes what is fetched and cached, never what is scored.
Raw site elements use a separate bounded geohash-7 memory cache and are likewise
filtered and measured again from the exact selected point; they never enter
Firestore.

For a demo where judges will click repeatedly around the same neighbourhood,
this converts most interactions into cache hits and keeps the interface
responsive.

---

## Request flow

A location analysis, end to end:

```
1. User selects a point inside the Semarang boundary
       │
2. web → GET /api/v1/location?lat=…&lng=…
       │  Geoapify reverse geocoding; coordinates remain usable if unavailable
3. web shows the location preview; user explicitly starts analysis
       │
4. web → POST /api/v1/analysis { lat, lng, businessType, googleMap }
       │
5. api validates input, then loads facilities for the geohash-7 cell:
       │  snapshot when covered; otherwise memory → Firestore POI cache;
       │  on a miss, Geoapify Places when configured, else Overpass
       │
6. api separately loads exact-site inputs:
       │  snapshot when covered; otherwise raw Overpass elements from a bounded
       │  memory-only geohash-7 cache, filtered and measured at the exact point
       │
7. when googleMap is true, api loads Google counts for the geohash-8 cell:
       │  bounded memory cache or 12–36 Places Aggregate requests; the 12
       │  small-business kinds replace matching mapped facilities only when the
       │  complete Google set succeeds
       │
8. api adds prepared-area Overture shops after the POI cache and invokes
   @gayatama/scoring against the exact user coordinate
       │
9. api presents components, availability, named competitors, evidence,
   warnings and attribution, then builds a plain-language narrative
       │
10. api → web; the web renders Skor/Pilihan usaha/Pelanggan/Pesaing tabs
```

The all-seven `/recommend` request is loaded lazily when **Pilihan usaha** first
opens. The current web app does not run the engine locally and has no report/PDF
flow; `simulate.ts` remains an engine capability for a planned what-if feature.

The explanation and calculation deliberately stay separate.
`apps/api/src/analysis/narrative.service.ts` starts from the fixed scoring
result and optionally asks Groq for a clearer Indonesian narrative when
`GROQ_API_KEY` is configured. If Groq is unavailable, too slow, or returns
invalid output, the API falls back to deterministic templates in
`apps/api/src/analysis/narratives.ts`. The LLM may explain and prioritize the
supplied facts, but the scoring package remains the source of truth and the LLM
must never invent or alter numeric results, evidence, warnings, place names or
source availability.

Within areas prepared with Overture data, the facility flow also adds
photocopy, printing and stationery shops that OpenStreetMap lacks. They are
added after cache lookup, so the POI cache contains only normalized
OpenStreetMap-derived data.

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
├── main.ts / setup.ts    Bootstrap, CORS, prefix and global validation
├── app.module.ts         Modules and default/route-specific throttling
├── config/               Typed, validated environment configuration
├── firebase/             Admin SDK, Auth and Firestore accessors
├── auth/                 ID-token guard and profile/username registration
├── location/             Geoapify reverse geocoding for point confirmation
├── geoapify/             Places client and OSM-tag normalization
├── osm-snapshots/        Offline OpenStreetMap snapshots for demo areas
├── overture/             Prepared Overture shops and de-duplication
├── overpass/             Facility/site queries, retries and tag normalization
├── places/               Google Aggregate client, 12 queries and memory cache
├── poi/                  Source selection, POI cache and exact-site lookup
├── analysis/             Scoring orchestration, presenters and narratives
└── common/               Error handling, concurrency and Zod validation
data/osm-snapshots/       Snapshot files, published under ODbL 1.0
data/overture-places/     Overture files, published under CDLA Permissive 2.0
scripts/                  Snapshot and Overture data pipelines
```

### `apps/web`

```
src/
├── main.tsx              /login, /signup and guarded/degraded app routes
├── App.tsx               Semarang boundary, URL state, map + responsive sheet
├── features/
│   ├── auth/             Login, signup, verification and auth gate
│   ├── map/              OSM/Google picker, boundary, rings and markers
│   ├── location/         Reverse-geocode preview and four result tabs
│   ├── score/            Score interval, availability and warnings
│   ├── recommend/        Lazy all-seven ranking and statuses
│   ├── segments/         Target-market evidence
│   └── competition/      Named/aggregate competitors and saturation
├── lib/                  API/auth clients, hooks, formatting and labels
└── components/           Shared loading, error, notice and navigation UI
```

The UI exposes simulator controls and a print-ready report export. Persisted
reports and multi-location comparison remain future work.

---

## Data model (Firebase Auth and Firestore)

Firebase Auth owns email/password identity and verification. The browser talks
to the Firebase Web Auth SDK for signup, login, logout, verification email and
ID-token retrieval; passwords never pass through the NestJS API. After signup,
the browser sends the Firebase ID token to `POST /api/v1/auth/register-profile`
so the API can create application profile data.

Active Firestore storage is limited to the POI cache and auth metadata. Google
place counts use only bounded process memory and are never persisted to
Firestore. Reports remain planned.

### `poiCache/{cell}`

The document ID is the geohash-7 cell used for normalized OSM-derived
facilities.

| Field | Type | Contents |
|-------|------|----------|
| `facilities` | string | JSON array of normalized `Facility` records, kept as a string to avoid indexing nested fields |
| `fetchedAt` | string | ISO 8601 facility-fetch time |
| `source` | string | `"geoapify"` or `"overpass"` |

- Entries use `POI_CACHE_TTL_SECONDS`; an expired entry is served stale only
  when the selected live provider fails.
- A memory cache of at most 500 cells sits in front of Firestore. Documents over
  900 KB are retained in memory but not written, staying below Firestore's 1 MiB
  document limit.
- Raw exact-site elements are separate: a bounded 2,000-entry memory-only
  geohash-7 cache is re-filtered and measured from the selected point. Site data
  is never written to Firestore.
- Overture shops are added after cache lookup and are never stored here.

### `users/{uid}` and `usernames/{lowercaseUsername}`

`users/{uid}` stores `{ email, username, createdAt }`.
`usernames/{lowercaseUsername}` stores the owning `{ uid }`. The profile service
creates both in one Firestore transaction after Firebase Admin verifies the
caller's bearer token. The lowercase reservation enforces case-insensitive
uniqueness; a retry by the same UID is idempotent, while a different UID receives
a username-taken conflict.

### Google place-count memory cache

`PlaceCountsService` keys a private in-process map by geohash-8, shares an
in-flight request for the same cell, applies `PLACE_COUNT_CACHE_TTL_SECONDS`,
and evicts the oldest entry above 2,000 cells. Counts do not survive restart.
Although a legacy `placeCountCache` rule/provider remains in the repository, the
final service neither injects nor calls it; it is not part of the active data
model.

### `reports/{reportId}` _(planned)_

The report endpoints and web report/PDF UI are not implemented. The intended
model is still to retain the complete engine input and response with its
`modelVersion` and `dataSource` attribution, rather than only a bare score. A
future implementation must resolve Firestore's 1 MiB limit and Google's count
retention terms before persisting any result that used Google counts.

### Security model

- `POST /auth/register-profile` is the only API route protected by the Firebase
  token guard. It trusts UID/email only from the verified token, never from the
  request body. Analysis, recommendation, POI, location and health routes are
  not server-authenticated.
- With Firebase configured, the web auth gate redirects signed-out visitors to
  `/login`; if Firebase Auth is unavailable, it deliberately permits the core
  map/scoring app instead of making an optional integration fatal.
- Firestore rules deny all client reads and writes to `poiCache`, `users` and
  `usernames`; the server uses the Admin SDK. The current rules also deny the
  legacy `placeCountCache` path. Planned reports are get-by-ID but not listable
  or client-writable; all unmatched paths are denied.
- Browser Firebase configuration is public by design. Firebase Admin service
  credentials and Geoapify, Google Places and Groq keys stay server-side.
- The API validates input/environment configuration, restricts CORS, applies
  per-IP throttling, disables `x-powered-by`, trusts only configured proxy hops
  and normalizes errors.

---

## Failure modes

Handled deliberately, because a demo that fails opaquely in front of judges is
worse than one that fails clearly.

| Failure | Behaviour |
|---------|-----------|
| A configured Geoapify facility lookup fails | Serve an expired POI cache entry when one exists, flagged `stale: true`; otherwise return an upstream error. The request does not switch to Overpass after selecting Geoapify |
| An Overpass instance is unreachable, rate-limits (429) or is overloaded (5xx) | For Overpass-selected facility lookup or raw site lookup, try configured fallback instances; retry behavior remains bounded, and requests for a cell already loading share work |
| Overpass times out, or every instance fails | Serve the expired cache entry if one exists, flagged `stale: true` with its original `fetchedAt`; otherwise return `504 UPSTREAM_TIMEOUT`, which the UI explains. A timeout is not retried elsewhere: the request has already waited `OVERPASS_TIMEOUT_MS` |
| Every public Overpass instance is down | Demo areas keep working: they are answered from OSM snapshots, which need no network |
| Site-conditions query fails | Stop waiting after 8 seconds, keep mapped accessibility evidence, use a neutral 50 for risk rather than rewarding missing data, and flag `siteConditions: "unavailable"` so the interface labels the result provisional and the component "not assessed". The unavailable result is cached for 2 minutes so another tab or nearby click does not repeat the timeout |
| The client draws a Google map, but the API has no Google server key | Use OpenStreetMap for every kind and flag `places.status: "not_configured"` |
| A Google count request fails, times out or hits the quota | A rate limit, server error or network failure is retried once. If it still fails, cancel the location's remaining count requests, use OpenStreetMap for every kind, and flag `places.status: "unavailable"` so the interface says so. Failures are not cached, so the next request tries Google again |
| Firestore unavailable during POI lookup | Degrade the POI cache to memory-only — slower after a restart, still correct. Google counts are unaffected because they never use Firestore |
| Firestore unavailable during profile registration | Return `503`; profile and username reservation must remain atomic rather than partially succeeding |
| Area has almost no OSM data | Confidence falls and the interval widens; below 40 the API answers `422 INSUFFICIENT_DATA` with an explanation instead of a score |
| Coordinate outside Indonesia | Rejected at validation with `400 VALIDATION_FAILED` |

POI-cache Firestore failures do not take scoring down; profile registration,
which requires an atomic durable write, intentionally fails closed instead.
Google failures likewise fall back to a complete OpenStreetMap result.

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
