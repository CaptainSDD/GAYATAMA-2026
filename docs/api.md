# API Reference

Base URL (development): `http://localhost:3000`
All endpoints are prefixed `/api/v1`.

> **Status.** This document specifies the intended contract. Endpoints are
> implemented against it; where an endpoint is not yet built it is marked
> _planned_.

---

## Conventions

- All requests and responses are JSON.
- All scores are numbers in `[0, 100]`, unrounded — clients round for display.
- Coordinates are WGS84 decimal degrees.
- Every response carries `modelVersion`, identifying the constant set used, so a
  stored result stays reproducible after recalibration.
- Request bodies are validated with Zod; a failure returns `400` with the
  offending field paths.

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
| `VALIDATION_FAILED` | 400 | Malformed request body |
| `INSUFFICIENT_DATA` | 422 | Confidence below 40 — no definitive recommendation given |
| `UPSTREAM_TIMEOUT` | 504 | Overpass did not respond and no cache was available |
| `RATE_LIMITED` | 429 | Client exceeded the throttle |

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
  "businessType": "laundry"
}
```

### Response `200`

```json
{
  "modelVersion": "0.1.0",
  "location": { "lat": -7.301234, "lng": 112.717890 },
  "businessType": "laundry",

  "score": {
    "value": 75.3,
    "band": "suitable",
    "confidence": 81,
    "margin": 8,
    "range": [67, 83]
  },

  "components": {
    "demandFit":         { "value": 74.75, "weight": 0.35 },
    "accessibility":     { "value": 67.0,  "weight": 0.20 },
    "competition":       { "value": 75.75, "weight": 0.20 },
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
    "density": "moderate",
    "saturationRatio": 0.55,
    "reading": "healthy",
    "radiusMeters": 1500
  },

  "strengths": [
    { "factor": "resident_density", "detail": "3 housing clusters and 4 boarding houses within 800 m" }
  ],
  "risks": [
    { "factor": "public_transport", "detail": "Nearest transit stop is 1.1 km away" }
  ],
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
    "cacheHit": true
  }
}
```

`score.value` is unrounded; `score.range` is already rounded because it is a
display artefact. `dataSource.fetchedAt` is required for ODbL-compliant
attribution in exported reports — see [data-sources.md](data-sources.md).

---

## `POST /api/v1/recommend`

Score all seven categories for one location and rank them. Answers "what should
I open here?".

### Request

```json
{ "lat": -7.301234, "lng": 112.717890 }
```

### Response `200`

```json
{
  "modelVersion": "0.1.0",
  "location": { "lat": -7.301234, "lng": 112.717890 },
  "confidence": 81,

  "recommendations": [
    {
      "businessType": "laundry",
      "score": 75.3,
      "band": "suitable",
      "status": "primary",
      "dominantSegment": "resident",
      "rationale": "Resident score 82 with healthy competitor saturation (0.55)",
      "differentiator": "Lower footfall dependence than food or beverages"
    }
  ],

  "equivalent": [["minimarket", "salon"]],

  "notRecommended": [
    { "businessType": "pharmacy", "score": 48.2, "reason": "Health segment score 20; no hospital or clinic within 1500 m" }
  ],

  "segments": { "student": 77, "office": 48, "resident": 82, "commuter": 35, "health": 20, "general": 55 },
  "dataSource": { "provider": "OpenStreetMap", "attribution": "© OpenStreetMap contributors", "licence": "ODbL 1.0", "fetchedAt": "2026-09-09T13:22:41Z", "cacheHit": true }
}
```

`recommendations` holds at most three entries. `equivalent` groups categories
whose scores differ by 3 points or less — presenting these as a strict ranking
would imply a precision the model does not have.

---

## `GET /api/v1/pois`

Raw normalised facilities around a point. Used by the map layer, and by the
client-side what-if simulator, which needs the facility set in memory to
recompute locally without further requests.

### Query parameters

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `lat` | number | required | |
| `lng` | number | required | |
| `radius` | number | `1500` | Metres, max 1500 |

### Response `200`

```json
{
  "facilities": [
    {
      "id": "node/1234567890",
      "type": "campus",
      "name": "Universitas Negeri Surabaya",
      "lat": -7.3021, "lng": 112.7165,
      "distanceMeters": 250,
      "zone": "a",
      "scale": "medium",
      "dataQuality": 1.0,
      "accessFactor": 1.0,
      "lastVerified": "2026-03-14"
    }
  ],
  "dataSource": { "provider": "OpenStreetMap", "attribution": "© OpenStreetMap contributors", "licence": "ODbL 1.0", "fetchedAt": "2026-09-09T13:22:41Z", "cacheHit": true }
}
```

---

## `POST /api/v1/reports` _(planned)_

Persist an analysis so it can be shared or compared later. Returns an ID.

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

Enforced per IP by `@nestjs/throttler`. Overpass is a volunteer-funded shared
service and the cache is what keeps GAYATAMA a well-behaved client of it.

| Endpoint | Limit |
|----------|-------|
| `/analysis`, `/recommend` | 30 requests / minute |
| `/pois` | 60 requests / minute |
| `/health` | unlimited |

Exceeding a limit returns `429` with a `Retry-After` header.

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
