# API Reference

Base URL (development): `http://localhost:3000`
All endpoints are prefixed `/api/v1`.

> **Status.** Implemented in `apps/api`, except endpoints marked _planned_.
> Example values are illustrative. The scores, margins, ranges, bands, statuses
> and competition figures in them are recomputed by the scoring engine's test
> suite (`packages/scoring/test/api-examples.test.ts`); names, IDs and text are
> not.

---

## Conventions

- All requests and responses are JSON.
- All scores are numbers in `[0, 100]`, unrounded — clients round for display.
  Examples in this document show two decimal places for readability.
- Every threshold (bands, recommendation statuses, the confidence floor) is
  applied to the unrounded value.
- Coordinates are WGS84 decimal degrees and must fall inside Indonesia:
  latitude −11.5 to 6.5, longitude 94.5 to 141.5.
- Every scored response carries `modelVersion`, identifying the constant set
  used, so a stored result stays reproducible after recalibration.
- Request bodies are validated with Zod; a failure returns `400` with the
  offending field paths. Unknown fields are rejected.

### Score object

Every scored result, in every endpoint, uses the same shape. A client renders
all of them the same way, and never has a score without its interval.

```json
{ "value": 75.15, "band": "suitable", "confidence": 81, "margin": 8, "range": [67, 83] }
```

| Field | Meaning |
|-------|---------|
| `value` | Unrounded score, 0–100 |
| `band` | `highly_suitable` (≥ 80) · `suitable` (≥ 70, < 80) · `moderately_suitable` (≥ 60, < 70) · `risky` (≥ 50, < 60) · `not_recommended` (< 50) |
| `confidence` | Confidence Score, 0–100 — see [methodology](methodology.md#confidence-score-and-warnings) |
| `margin` | `round(5 + 0.15 × (100 − confidence))` |
| `range` | `[round(value − margin), round(value + margin)]`, clamped to `[0, 100]` |

### Data source object

Every scored response carries its sources and their attribution:

```json
{
  "provider": "OpenStreetMap",
  "attribution": "© OpenStreetMap contributors",
  "licence": "ODbL 1.0",
  "fetchedAt": "2026-09-09T13:22:41Z",
  "cacheHit": true,
  "stale": false,
  "via": "overpass",
  "siteConditions": "available",
  "places": { "provider": "Google Maps", "status": "not_requested", "attribution": null, "fetchedAt": null, "cacheHit": null, "kinds": [] },
  "overture": null
}
```

The top-level fields describe the OpenStreetMap data; `places` describes Google
Maps business counts, and `overture` the shops added from Overture Maps.

- `stale` is `true` when Overpass was unavailable and an expired cache entry was
  served instead; `fetchedAt` then shows how old the data is.
- `via` is `"overpass"` for data from a live Overpass query (possibly cached),
  or `"snapshot"` for one of the offline OSM snapshots covering the demo areas.
  For a snapshot, `fetchedAt` is the date of its OpenStreetMap data and
  `cacheHit` is `false`.
- `siteConditions` is `"unavailable"` when the query for conditions at the site
  itself — road class, pedestrian features, waterways, industrial land use —
  failed and nothing was cached. Those inputs are then scored as unknown and
  Data Completeness falls, so the result is incomplete and a client must say
  so. Requesting again later can return the full result.
- `places.status` says whether Google counts were used:

  | `status` | Meaning |
  |----------|---------|
  | `used` | The kinds listed in `kinds` were counted by Google and replace OpenStreetMap facilities of those kinds. `attribution` is `"Google Maps"` and must be shown with the result; `fetchedAt` and `cacheHit` describe the counts |
  | `not_requested` | The request did not set `googleMap`. Every facility comes from OpenStreetMap |
  | `not_configured` | The request set `googleMap`, but the API has no Google server key. Every facility comes from OpenStreetMap |
  | `unavailable` | Google failed or its quota ran out. Every facility comes from OpenStreetMap, which misses many small businesses, so a client must say so. Requesting again later can return Google counts |

  See [data-sources.md](data-sources.md#google-maps-business-counts).
- `overture` is `null` outside the areas prepared with Overture data. Inside
  them, Overture Maps shops were added to the photocopy, printing and stationery
  kinds, and `attribution` must be shown with the result:

  ```json
  { "provider": "Overture Maps Foundation", "attribution": "Overture Maps Foundation", "licence": "CDLA-Permissive-2.0", "release": "2026-08-19.0", "kinds": ["copyshop", "printer", "stationery_shop"] }
  ```

  See [data-sources.md](data-sources.md#overture-maps-places).

### Business category identifiers

`beverages` · `food` · `laundry` · `stationery` · `minimarket` · `salon` ·
`pharmacy`

### Errors

```json
{
  "statusCode": 422,
  "error": "INSUFFICIENT_DATA",
  "message": "Not enough mapped facilities within 1500 m to produce a reliable score.",
  "details": { "facilitiesFound": 3, "confidence": 22 }
}
```

| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_FAILED` | 400 | Malformed body, invalid field, unknown field, or a coordinate outside Indonesia. `details.issues` lists each problem |
| `NOT_FOUND` | 404 | Unknown route |
| `INSUFFICIENT_DATA` | 422 | Confidence below 40 — no definitive recommendation given |
| `RATE_LIMITED` | 429 | Client exceeded the throttle |
| `UPSTREAM_TIMEOUT` | 504 | Overpass did not respond and nothing was cached for the area |

`INSUFFICIENT_DATA` is a deliberate design choice, not a failure: below a
confidence of 40 the system refuses to answer rather than guessing. See
[methodology](methodology.md#confidence-score-and-warnings).

---

## `POST /api/v1/analysis`

Full analysis of one location for one business category. This is the primary
endpoint.

### Request

```json
{
  "lat": -7.301234,
  "lng": 112.717890,
  "businessType": "laundry",
  "googleMap": false
}
```

| Field | Type | Notes |
|-------|------|-------|
| `lat`, `lng` | number | Required |
| `businessType` | string | Required — see [identifiers](#business-category-identifiers) |
| `googleMap` | boolean | Optional, default `false`. Set it only when the result is shown on a Google map: Google Maps Platform terms forbid using Google data with any other map, so the API uses Google business counts only then |

### Response `200`

```json
{
  "modelVersion": "0.1.0",
  "location": { "lat": -7.301234, "lng": 112.717890 },
  "businessType": "laundry",

  "score": {
    "value": 75.15,
    "band": "suitable",
    "confidence": 81,
    "margin": 8,
    "range": [67, 83]
  },

  "components": {
    "demandFit":         { "value": 74.75, "weight": 0.35 },
    "accessibility":     { "value": 67.0,  "weight": 0.20 },
    "competition":       { "value": 75.71, "weight": 0.20 },
    "supportingFacility":{ "value": 73.0,  "weight": 0.15 },
    "risk":              { "value": 95.0,  "weight": 0.10 }
  },

  "segments": {
    "student":   { "score": 77, "role": "primary" },
    "office":    { "score": 48, "role": "secondary" },
    "resident":  { "score": 82, "role": "primary" },
    "commuter":  { "score": 35, "role": "supporting" },
    "health":    { "score": 20, "role": "insignificant" },
    "general":   { "score": 55, "role": "secondary" }
  },

  "competition": {
    "rawCount": 5,
    "equivalentCount": 2.06,
    "density": "low",
    "saturationRatio": 0.55,
    "reading": "healthy",
    "radiusMeters": 1500,
    "strongest": [
      { "id": "node/4012345678", "name": "Laundry Kilat", "kind": "laundry", "zone": "b", "distanceMeters": 420, "count": 1, "source": "openstreetmap", "contribution": 0.6 }
    ]
  },

  "strengths": [
    { "factor": "risk", "detail": "Risk and Operability scores 95/100" },
    { "factor": "competition", "detail": "Competition Opportunity scores 76/100" },
    { "factor": "demandFit", "detail": "Demand Fit scores 75/100" }
  ],
  "risks": [],
  "warnings": [],

  "evidence": {
    "facilityCount": 47,
    "zones": { "a": 12, "b": 21, "c": 14 }
  },

  "dataSource": {
    "provider": "OpenStreetMap",
    "attribution": "© OpenStreetMap contributors",
    "licence": "ODbL 1.0",
    "fetchedAt": "2026-09-09T13:22:41Z",
    "cacheHit": true,
    "stale": false,
    "via": "overpass",
    "siteConditions": "available",
    "places": { "provider": "Google Maps", "status": "not_requested", "attribution": null, "fetchedAt": null, "cacheHit": null, "kinds": [] },
    "overture": null
  }
}
```

- `score.value` is unrounded; `score.range` is already rounded because it is a
  display artefact.
- `competition.strongest` lists up to five competitors by contribution to the
  Competitor Equivalent Count. A listed competitor's `source` is
  `"openstreetmap"`, or `"overture"` for a shop added from Overture Maps, whose
  `id` starts with `overture/`. An entry counted by Google stands for `count`
  competitors in one zone: its `source` is `"google"`, its `id` is
  `google:<kind>:<zone>` (with `:<scale>` when not medium), and its `name` and
  `distanceMeters` are `null`, because a count has no single place or position.
- `evidence.facilityCount` and `evidence.zones` include every facility Google
  counted.
- `strengths` are up to three components scoring 60 or more; `risks` are up to
  three scoring below 60.
- `warnings` entries are `{ code, message }`. Codes: `flood_risk_proxy`,
  `stale_data` — see [hard warnings](methodology.md#hard-warnings-the-engine-raises).
- `dataSource.fetchedAt` is required for ODbL-compliant attribution in exported
  reports — see [data-sources.md](data-sources.md).

---

## `POST /api/v1/recommend`

Score all seven categories for one location and rank them. Answers "what should
I open here?".

### Request

```json
{ "lat": -7.301234, "lng": 112.717890, "googleMap": false }
```

`googleMap` is optional and means the same as in [`/analysis`](#request).

### Response `200`

```json
{
  "modelVersion": "0.1.0",
  "location": { "lat": -7.301234, "lng": 112.717890 },

  "recommendations": [
    {
      "businessType": "laundry",
      "score": { "value": 75.15, "band": "suitable", "confidence": 81, "margin": 8, "range": [67, 83] },
      "status": "primary",
      "dominantSegment": "resident",
      "rationale": "Resident score 82 with healthy competitor saturation (0.55)",
      "differentiator": "Lower footfall dependence than food or beverages"
    },
    {
      "businessType": "salon",
      "score": { "value": 71.6, "band": "suitable", "confidence": 81, "margin": 8, "range": [64, 80] },
      "status": "primary",
      "dominantSegment": "resident",
      "rationale": "Resident score 82 with low competitor saturation (0.31)",
      "differentiator": "Relies on repeat local customers rather than passing trade"
    },
    {
      "businessType": "minimarket",
      "score": { "value": 69.2, "band": "moderately_suitable", "confidence": 81, "margin": 8, "range": [61, 77] },
      "status": "alternative",
      "dominantSegment": "resident",
      "rationale": "Resident score 82 with healthy competitor saturation (0.72)",
      "differentiator": "Needs the most stock and shelf space to open"
    }
  ],

  "equivalent": [["salon", "minimarket"]],

  "notRecommended": [
    {
      "businessType": "beverages",
      "score": { "value": 57.9, "band": "risky", "confidence": 81, "margin": 8, "range": [50, 66] },
      "status": "not_recommended",
      "reason": "Competition Opportunity is 16/100, its weakest component"
    },
    {
      "businessType": "pharmacy",
      "score": { "value": 52.4, "band": "risky", "confidence": 81, "margin": 8, "range": [44, 60] },
      "status": "not_recommended",
      "reason": "Supporting Facility Fit is 22/100, its weakest component"
    }
  ],

  "warnings": [],

  "segments": { "student": 77, "office": 48, "resident": 82, "commuter": 35, "health": 20, "general": 55 },
  "dataSource": { "provider": "OpenStreetMap", "attribution": "© OpenStreetMap contributors", "licence": "ODbL 1.0", "fetchedAt": "2026-09-09T13:22:41Z", "cacheHit": true, "stale": false, "via": "overpass", "siteConditions": "available", "places": { "provider": "Google Maps", "status": "not_requested", "attribution": null, "fetchedAt": null, "cacheHit": null, "kinds": [] }, "overture": null }
}
```

### `status` values

Each category's status comes from its unrounded score and the location's
confidence, following the
[recommendation rules](methodology.md#recommendation-rules):

| `status` | Score | Confidence | Listed in |
|----------|-------|------------|-----------|
| `primary` | ≥ 70 | ≥ 60 | `recommendations` |
| `alternative` | ≥ 60 and < 70 | ≥ 60 | `recommendations` |
| `needs_validation` | ≥ 60 | ≥ 40 and < 60 | `recommendations` |
| `not_recommended` | < 60 | any | `notRecommended` |

Below a confidence of 40 no ranking is returned; the endpoint responds `422`
`INSUFFICIENT_DATA` (see [Errors](#errors)).

`band` describes the score alone. `status` also accounts for confidence and the
recommendation threshold of 60, so a category scoring 55 has band `risky` and
status `not_recommended`.

### Confidence and `needs_validation`

None of the four Confidence Score inputs in model 0.1.0 depends on the business
category, so every entry carries the same `confidence` and `margin`. They are
repeated per entry so each score renders exactly like `/analysis`.

Because confidence is shared, a location with confidence from 40 to 59 returns
no `primary` or `alternative` entries — every category scoring 60 or more is
`needs_validation`, with the wider interval that low confidence produces:

```json
{
  "businessType": "laundry",
  "score": { "value": 75.15, "band": "suitable", "confidence": 52, "margin": 12, "range": [63, 87] },
  "status": "needs_validation",
  "dominantSegment": "resident",
  "rationale": "Resident score 82, but facility data around this location is incomplete",
  "differentiator": "Lower footfall dependence than food or beverages"
}
```

A client must present `needs_validation` as "verify on site before deciding",
never as a recommendation.

### Lists and grouping

- `recommendations` holds at most three entries: the highest-scoring categories
  with a score of 60 or more, in descending order.
- `notRecommended` lists every category scoring below 60, in descending order.
  Each `reason` names the category's weakest component.
- A category that scores 60 or more but ranks fourth or lower appears in
  neither list.
- `equivalent` groups entries of `recommendations` whose scores are within 3
  points of the next entry in the ranking. Groups chain: if A–B and B–C are
  each within 3 points, A, B and C form one group. Presenting these as a strict
  ranking would imply a precision the model does not have.
- `warnings` carries the location's
  [hard warnings](methodology.md#hard-warnings-the-engine-raises), as in
  `/analysis`. They apply to every category and are returned regardless of
  score.

---

## `GET /api/v1/pois`

Normalised facilities, Google business counts when requested, and site
conditions around a point. Used by the map layer, and by the client-side what-if
simulator, which reruns the scoring engine in the browser without further
requests.

### Query parameters

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `lat` | number | required | |
| `lng` | number | required | |
| `radius` | number | `1500` | Metres, max 1500 |
| `googleMap` | `true` or `false` | `false` | As in [`/analysis`](#request) |

### Response `200`

For `googleMap=true`:

```json
{
  "location": { "lat": -7.301234, "lng": 112.717890 },
  "asOf": "2026-09-11",
  "site": { "roadClass": "tertiary", "pedestrianFeatureCount": 4 },
  "facilities": [
    {
      "id": "node/1234567890",
      "kind": "boarding_house",
      "name": "Kos Putri Melati",
      "lat": -7.3021,
      "lng": 112.7165,
      "lastEditDate": "2025-11-02T08:15:00Z",
      "distanceMeters": 181.0,
      "zone": "a",
      "dataQuality": 0.65,
      "accessFactor": 1.0
    }
  ],
  "facilityCounts": [
    { "kind": "campus", "zone": "a", "count": 1, "scale": "large", "source": "google", "dataQuality": 0.65 },
    { "kind": "cafe", "zone": "b", "count": 7, "scale": "medium", "source": "google", "dataQuality": 0.65 }
  ],
  "dataSource": { "provider": "OpenStreetMap", "attribution": "© OpenStreetMap contributors", "licence": "ODbL 1.0", "fetchedAt": "2026-09-09T13:22:41Z", "cacheHit": true, "stale": false, "via": "overpass", "siteConditions": "available", "places": { "provider": "Google Maps", "status": "used", "attribution": "Google Maps", "fetchedAt": "2026-09-11T02:10:05Z", "cacheHit": false, "kinds": ["campus", "school", "office", "…"] }, "overture": null }
}
```

- `facilities` are sorted by distance. Each carries the engine's own fields —
  the `Facility` type in `@gayatama/scoring` — plus its distance, zone, Data
  Quality and Access Factor from this location. Shops added from Overture Maps
  have IDs starting with `overture/`.
- `facilityCounts` lists the facilities Google counted, one entry per kind, zone
  and scale, sorted by zone. Each is the engine's `FacilityCount` type plus the
  Data Quality it scores with. A zone is included only when it lies entirely
  within `radius`. The list is empty unless `dataSource.places.status` is
  `used`.
- With `location`, `site` and `asOf`, the response is a complete engine input.

---

## `POST /api/v1/reports` _(planned)_

Persist an analysis or a recommendation so it can be shared or compared later.
Returns an ID. The report stores the complete engine input alongside the
response, so its scores can be recomputed later — see the
[data model](architecture.md#data-model-firestore).

## `GET /api/v1/reports/:id` _(planned)_

Retrieve a stored report, including the `modelVersion` under which it was
produced.

---

## `GET /api/v1/health`

```json
{ "status": "ok", "modelVersion": "0.1.0", "uptime": 1042 }
```

---

## Rate limiting

Enforced per client IP by `@nestjs/throttler`. Overpass is a volunteer-funded
shared service and the cache is what keeps GAYATAMA a well-behaved client of it.

| Endpoint | Limit |
|----------|-------|
| `/analysis`, `/recommend` | 30 requests / minute |
| `/pois` | 60 requests / minute |
| `/health` | unlimited |

Exceeding a limit returns `429` with a `Retry-After` header. Behind a proxy
such as Cloud Run, set `TRUST_PROXY_HOPS=1` so limits apply to each visitor
rather than to the proxy's address.

---

## Notes for reviewers

Two aspects of this contract are deliberate and worth flagging:

1. **Every scored response carries its own confidence and evidence.** There is
   no endpoint that returns a bare number. A client physically cannot render a
   score without also having the material to qualify it.
2. **There is no field anywhere for population, age, or income.** The absence is
   the enforcement mechanism described in
   [methodology.md](methodology.md#the-constraint-that-makes-this-honest) —
   fabricated demographics are unrepresentable in the type system, not merely
   discouraged.
