# Architecture

## Overview

GAYATAMA is an npm-workspaces monorepo with three packages: a React frontend, a
NestJS API, and a shared scoring engine that both depend on.

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  apps/web  (React + Vite)    │         │  apps/api  (NestJS)          │
│                              │  HTTP   │                              │
│  • Map: OpenStreetMap/Google │ ──────► │  • Overpass, Google clients  │
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

Google Maps Platform is optional. With keys, the web app draws a Google map and
the API adds business counts from the Places Aggregate API; without them,
everything runs on OpenStreetMap — see
[data-sources.md](data-sources.md#google-maps-business-counts).

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
- Ask Google for business counts when the client draws a Google map
- Cache POIs and Google counts in memory and Firestore
- Hold the Firebase service account credential and the Google Places server key,
  which cannot live in a browser
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
2. web → POST /api/v1/analysis  { lat, lng, businessType, googleMap }
       │
3. api: validate input (Zod)
       │
4. api: snap coordinate → geohash-7 cache key
       │
5. api: an OSM snapshot if one covers the area (demo areas; no network);
   otherwise cache lookup — memory, then Firestore
       │
       ├── HIT and fresh (< POI_CACHE_TTL_SECONDS) ──┐
       │                                             │
       └── MISS or stale                             │
              │                                      │
              ├─ Overpass query (≈1,608 m radius)    │
              ├─ normalise tags → typed facilities   │
              └─ write to memory and Firestore ──────┤
                                                     ▼
6. api, alongside step 5 when googleMap is true: Google counts for the
   geohash-8 cell — from memory or Firestore if fresh, otherwise 25–75 Places
   Aggregate requests. Counts replace OpenStreetMap facilities of the kinds Google
   covers; if any request fails, none is used
       │
7. api: @gayatama/scoring — compute against the EXACT user coordinate
       │
8. api: build a plain-language narrative from the fixed scoring result
       │
9. api → web: scores, narrative, component breakdown, evidence, confidence
       │
10. web: render the narrative first; retain the facility set in memory
       │
11. User moves a what-if slider
       │
12. web: @gayatama/scoring recomputes locally — no network call
```

Step 12 is the payoff from decision 1.

The explanation and the calculation deliberately stay separate.
`apps/api/src/analysis/narrative.service.ts` first builds the response from the
fixed scoring result, then optionally asks Groq for a clearer Indonesian
narrative when `GROQ_API_KEY` is configured. If Groq is unavailable, too slow,
or returns invalid JSON, the API falls back to the deterministic templates in
`apps/api/src/analysis/narratives.ts`. The LLM may explain and prioritise the
supplied facts, but the scoring package remains the source of truth and the LLM
must never invent or alter numeric results, evidence, warnings, or source
availability.

Within the areas prepared with Overture data, step 5 also adds the photocopy,
printing and stationery shops OpenStreetMap lacks. They are added after the
cache lookup, so the POI cache only ever holds OpenStreetMap data.

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
├── osm-snapshots/        Offline OpenStreetMap snapshots for the demo areas
├── overture/             Overture Maps photocopy, printing and stationery shops for prepared areas
├── overpass/             Query builder, HTTP client with fallback instances, tag normaliser
├── places/               Google Places Aggregate client, type mapping, zone counts and their cache
├── poi/                  Snapshot, cache and Overpass lookup; geohash key derivation
├── analysis/             Orchestration, response assembly, plain-language narratives
└── common/               Filters, interceptors, Zod validation pipe
data/osm-snapshots/       Snapshot files, published under ODbL 1.0
data/overture-places/     Overture shop files, published under CDLA Permissive 2.0
scripts/                  Data pipelines: OSM snapshots from a Geofabrik download; Overture places with DuckDB
```

### `apps/web`

```
src/
├── main.tsx
├── App.tsx               Layout; the selected point and business type live in the URL
├── features/
│   ├── map/              OpenStreetMap or Google map picker, zone rings, business type and location controls
│   ├── location/         Tabs for a selected location
│   ├── score/            Score with its interval, component breakdown, warnings
│   ├── recommend/        All seven categories ranked, with statuses
│   ├── segments/         Target market panel with facility evidence
│   ├── competition/      Competitor equivalents, saturation, strongest competitors
│   ├── simulate/         What-if controls (local recompute) — planned
│   └── report/           Consolidated report and PDF export — planned
├── lib/                  API client and types, query hooks, formatting, labels
└── components/           Shared UI: tabs, loading and error states, notices
```

---

## Data model (Firestore)

Firestore holds two cache collections, plus the planned reports collection.
There are no user accounts, so no document refers to a user — see
[roadmap](roadmap.md#user-accounts-saved-projects-team-sharing).

### `poiCache/{cell}`

The POI cache. The document ID is the geohash-7 cell the facilities were
fetched for.

| Field | Type | Contents |
|-------|------|----------|
| `facilities` | string | JSON array of normalised facilities — the engine's `Facility` type. Stored as one string so Firestore does not index every nested field |
| `fetchedAt` | string | ISO 8601 time of the Overpass query |
| `source` | string | `"geoapify"` or `"overpass"` |

- An entry is fresh for `POI_CACHE_TTL_SECONDS` (default 7 days). After that it
  is refetched, and served stale only if Overpass is unavailable — see
  [Failure modes](#failure-modes).
- An in-memory cache of up to 500 cells sits in front of Firestore, so repeated
  clicks handled by the same API instance never reach the database.
- A cell whose facilities exceed 900 KB is not written, keeping each document
  under Firestore's 1 MiB limit; it stays in the memory cache only.
- Site source elements (roads, pedestrian features, waterways and industrial
  land use) are not stored in Firestore. They are cached in memory per
  geohash-7 cell, then filtered and measured again from the exact selected
  point.
- Overture shops are never stored in the POI cache; they are added to each
  answer from the files in `data/overture-places`.
- Google business counts are cached in memory and in
  `placeCountCache/{geohash-8 cell}` for `PLACE_COUNT_CACHE_TTL_SECONDS`, which
  Google's terms limit to 30 days.

### `placeCountCache/{cell}`

Google Places Aggregate counts for one geohash-8 cell. The API is the only
reader and writer; entries expire according to `PLACE_COUNT_CACHE_TTL_SECONDS`.

| Field | Type | Contents |
|-------|------|----------|
| `counts` | array | Normalised facility counts split into zones A, B and C |
| `fetchedAt` | string | ISO 8601 time of the Google Places Aggregate lookup |

### `reports/{reportId}` _(planned)_

A saved result, written by `POST /api/v1/reports` and read by ID. Firestore
generates the document ID.

| Field | Type | Contents |
|-------|------|----------|
| `kind` | string | `"analysis"` or `"recommend"` — the endpoint whose response was saved |
| `businessType` | string or null | The category for `analysis`; `null` for `recommend` |
| `modelVersion` | string | Engine version that produced `response` |
| `input` | string | JSON of the complete engine input: `location`, `facilities`, `site` and `asOf` — the engine's `LocationInput` |
| `options` | string or null | JSON of the operator options applied (parking, opening hours, delivery) when the report was saved from the simulator |
| `response` | string | JSON of the API response exactly as returned, including its `dataSource` attribution |
| `createdAt` | timestamp | When the report was saved |

Why a report stores its full input:

- **The POI cache is not a record.** Its entries are overwritten whenever an
  area is refetched, so a report holding only scores could never be recomputed.
- **With the input, a report is reproducible.** Running the engine version named
  in `modelVersion` on `input` reproduces the scores in `response`; running a
  newer version on the same `input` shows exactly what a recalibration changed.
- **Segment scores, confidence, warnings and statuses need no separate fields.**
  They are already in `response`, in the shapes [api.md](api.md) documents.

Firestore limits a document to 1 MiB, so the API must refuse to save a larger
report rather than truncate it.

A result built with Google counts cannot be saved as it is: its `input` and
`response` contain the counts, and Google's terms allow caching them for at most
30 days. Before reports are implemented, decide whether such a report expires
after 30 days or keeps only the derived scores.

### Security rules

The rules are versioned in [`firestore.rules`](../firestore.rules) at the
repository root — see [installation.md](installation.md#4-firestore-security-rules).

- `poiCache` — no client access. The API reads and writes it through the Admin
  SDK, which bypasses the rules.
- `reports` — a client may fetch one report by ID but may not list the
  collection, so knowing one ID reveals nothing about other reports. Writes go
  through the API.
- Every other path is denied.

---

## Failure modes

Handled deliberately, because a demo that fails opaquely in front of judges is
worse than one that fails clearly.

| Failure | Behaviour |
|---------|-----------|
| An Overpass instance is unreachable, rate-limits (429) or is overloaded (5xx) | Try the next instance in `OVERPASS_FALLBACK_URLS`; with no fallbacks configured, retry once after 1.5 seconds. Logs name the instance and the low-level cause, such as `UND_ERR_CONNECT_TIMEOUT`. To avoid causing 429s, the API runs at most two Overpass queries at a time — the number of slots Overpass gives one IP address — and requests for a cell that is already loading share its query |
| Overpass times out, or every instance fails | Serve the expired cache entry if one exists, flagged `stale: true` with its original `fetchedAt`; otherwise return `504 UPSTREAM_TIMEOUT`, which the UI explains. A timeout is not retried elsewhere: the request has already waited `OVERPASS_TIMEOUT_MS` |
| Every public Overpass instance is down | Demo areas keep working: they are answered from OSM snapshots, which need no network |
| Site-conditions query fails | Stop waiting after 8 seconds, keep mapped accessibility evidence, use a neutral 50 for risk rather than rewarding missing data, and flag `siteConditions: "unavailable"` so the interface labels the result provisional and the component "not assessed". The unavailable result is cached for 2 minutes so another tab or nearby click does not repeat the timeout |
| The client draws a Google map, but the API has no Google server key | Use OpenStreetMap for every kind and flag `places.status: "not_configured"` |
| A Google count request fails, times out or hits the quota | A rate limit, server error or network failure is retried once. If it still fails, cancel the location's remaining count requests, use OpenStreetMap for every kind, and flag `places.status: "unavailable"` so the interface says so. Failures are not cached, so the next request tries Google again |
| Firestore unavailable | Degrade to the in-memory cache — slower after a restart, still correct. Caching is an optimisation, not a dependency |
| Area has almost no OSM data | Confidence falls and the interval widens; below 40 the API answers `422 INSUFFICIENT_DATA` with an explanation instead of a score |
| Coordinate outside Indonesia | Rejected at validation with `400 VALIDATION_FAILED` |

The Firestore row matters: no single Firestore outage should be able to take the
demo down during judging. Nor should Google: every Google failure ends in a
complete OpenStreetMap result.

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
