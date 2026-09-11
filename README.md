<div align="center">

# GAYATAMA

**Location intelligence for micro-entrepreneurs — built on open data, honest about uncertainty.**

[![SDG 8](https://img.shields.io/badge/SDG-8.3_Decent_Work_&_Economic_Growth-A21942)](https://sdgs.un.org/goals/goal8)
[![SDG 9](https://img.shields.io/badge/SDG-9.3_Industry_&_Innovation-FD6925)](https://sdgs.un.org/goals/goal9)
[![SDG 11](https://img.shields.io/badge/SDG-11.3_Sustainable_Cities-FD9D24)](https://sdgs.un.org/goals/goal11)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)

Submitted to the **International Web Technology Competition — GAYATAMA 5**,
Universitas Negeri Surabaya.

[Live Demo](#) · [Documentation](docs/) · [Methodology](docs/methodology.md)

</div>

---

## The problem

Choosing where to open a small business is one of the highest-stakes decisions a
micro-entrepreneur makes, and it is usually made on intuition. A rent contract
gets signed before anyone counts the competitors on the same street, or checks
whether the people who walk past every morning are actually the customers this
business needs.

Location intelligence that could answer those questions already exists — but it
is priced and packaged for retail chains with analytics teams, not for one
person opening a single laundry. The result is a gap: the businesses with the
least margin for error have the least access to evidence.

GAYATAMA closes that gap using data that is free for anyone to use.

## What it does

Pick a point on the map, choose a business type, and GAYATAMA returns a
**0–100 suitability score** with the reasoning fully unpacked: which nearby
facilities create demand, how saturated the competition already is, who the
likely customers are, and how confident the system is in its own answer.

### What makes it different

Three deliberate choices separate GAYATAMA from a generic "heatmap of busy
places":

**1. The score is per business type, not per location.**
A single point gets seven different scores. A spot that is excellent for a
laundry can be poor for a coffee shop — different businesses need different
customers, and a location is only ever good *for something*. Scoring a location
in the abstract hides exactly the information that matters.

**2. It reports confidence, not false precision.**
Every result carries a Confidence Score and an uncertainty range. A location
scores `75 ± 8`, not `75`. Where the underlying data is thin, stale, or
internally inconsistent, the interval widens and the interface says so — and
below a confidence floor, GAYATAMA declines to give a definitive recommendation
at all. A number that looks certain when it is not is worse than no number.

**3. It never invents demographics.**
GAYATAMA does not claim population counts, age distributions, or income levels
that it cannot source. Nearby facilities are treated as *indicators of segment
strength*, never as head counts. A campus 250 m away raises the Student signal;
it does not license a claim about how many students there are. This constraint
is enforced in the scoring engine, not left to interface copy.

## Features

| # | Feature | What it answers |
|---|---------|-----------------|
| 1 | **Location Potential Score** | *Is this specific spot suitable for the business I have in mind?* A 0–100 score across five weighted components, with the top supporting factors and top risks named. |
| 2 | **Business Type Recommendation** | *I have a location but no fixed plan — what should I open here?* All seven MVP categories scored and ranked, with the reasoning for each. |
| 3 | **Competitor Analysis** | *How crowded is this market really?* Not a raw shop count — a distance-, access- and similarity-weighted **Competitor Equivalent Count**, compared against estimated demand to produce a saturation ratio. |
| 4 | **Target Market Insight** | *Which customer segments are most likely to be present around this location?* Six customer segments scored 0–100, each backed by the specific facilities that produced the score, plus what that implies for product, pricing, and opening hours. |
| 5 | **Simulation & Report** | *What would change if I fixed the parking?* A consolidated, exportable report plus a what-if simulator for the operational variables an owner can actually control. |

Full formulas, weights, and worked examples: **[docs/methodology.md](docs/methodology.md)**.

## SDG alignment

GAYATAMA targets one goal directly and two in support.

**SDG 8.3 (primary)** — *"Promote development-oriented policies that support
productive activities, decent job creation, entrepreneurship, creativity and
innovation, and encourage the formalization and growth of micro-, small- and
medium-sized enterprises."*

This is the project's thesis, not a retrofitted label. GAYATAMA takes an
analytical capability currently reserved for well-capitalised firms and makes it
free at the point of use for the micro-enterprises the target explicitly names.
Better location decisions can improve a small business owner's odds of survival, and 
surviving businesses are what create durable local employment.

**SDG 9.3** — improving small-scale enterprises' access to information services
that were previously available only to larger competitors.

**SDG 11.3** — the same evidence that helps an individual choose a location
aggregates into a picture of which neighbourhoods are underserved, supporting
more balanced and participatory local economic planning.

## Tech stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19, TypeScript, Vite | Fast iteration, strict typing across the whole codebase |
| Mapping | Leaflet + React Leaflet, OpenStreetMap tiles | No API key is required for the MVP. Rate limiting, caching, and graceful fallback are used to reduce dependency on public OpenStreetMap infrastructure |
| Server state | TanStack Query | Request deduplication and caching for slow geospatial queries |
| Backend | NestJS 11, TypeScript | Modular architecture with dependency injection; keeps the geospatial, scoring, and caching concerns genuinely separated |
| Database | Cloud Firestore | POI cache and saved reports; serverless, so there is no instance to keep alive during judging |
| POI data | OpenStreetMap via Overpass API | Open, global, and attributable — see [Data sources](#data-sources-and-attribution) |
| Scoring | `@gayatama/scoring` — a shared, dependency-free TypeScript package | See below |
| Validation | Zod | One schema definition validating both API boundaries and engine inputs |
| Testing | Vitest (engine, web), Jest (API) | The scoring engine is pure, so it is exhaustively unit-testable |

### Why the scoring engine is its own package

`packages/scoring` contains no framework code, no I/O, and no dependencies — it
is a set of pure functions from facility data to scores. Three consequences
worth stating explicitly:

- **The what-if simulator runs in the browser.** Moving a slider recomputes the
  score locally at interactive speed, with no server round trip.
- **The frontend and backend minimize scoring drift.** Both import the same scoring functions, while the backend
  remains the authoritative source for saved reports and final recommendations.
- **The methodology is testable as a unit.** Every worked example in
  [docs/methodology.md](docs/methodology.md) exists as an assertion in the test
  suite, so the documentation cannot silently drift from the implementation.

## Architecture

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  apps/web  (React + Vite)    │         │  apps/api  (NestJS)          │
│                              │  HTTP   │                              │
│  • Leaflet map picker        │ ──────► │  • Request validation        │
│  • Score breakdown panel     │ ◄────── │  • POI cache lookup          │
│  • Business ranking          │         │  • Overpass fetch on miss    │
│  • What-if simulator         │         │  • Scoring orchestration     │
│  • Report / PDF export       │         │  • Rate limiting             │
│                              │         │  • Report / PDF endpoint     │
└──────────────┬───────────────┘         └───┬────────────────┬─────────┘
               │                             │                │
               │ imports for local preview   │ reads/writes   │ fetches on miss
               │ optional only               ▼                ▼
               │                  ┌──────────────────┐ ┌──────────────────────┐
               │                  │ Firestore POI    │ │ Overpass API         │
               │                  │ Cache            │ │ OpenStreetMap source │
               │                  └──────────────────┘ └──────────────────────┘
               │                             │
               │                             │ raw / cached POI data
               │                             ▼
               │                  ┌──────────────────────────────┐
               │                  │ Data Normalization Layer     │
               │                  │                              │
               │                  │ • Tag normalization          │
               │                  │ • Duplicate cleanup          │
               │                  │ • Distance calculation       │
               │                  │ • Distance zone assignment   │
               │                  │ • Data freshness check       │
               │                  │ • Data quality scoring       │
               │                  └──────────────┬───────────────┘
               │                                 │ normalized POI data
               ▼                                 ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│ packages/scoring             │◄─────│ Scoring Input Builder        │
│ Pure TypeScript, no I/O      │      │                              │
│                              │      │ • Segment signals            │
│ • Distance zone weighting    │      │ • Business category inputs   │
│ • 6 target market segments   │      │ • Competitor equivalents     │
│ • 7 business categories      │      │ • Confidence inputs          │
│ • Competitor equivalence     │      └──────────────────────────────┘
│ • Confidence & uncertainty   │
└──────────────────────────────┘
```
### Data Normalization Layer

GAYATAMA does not score raw OpenStreetMap tags directly. The normalization layer converts messy OSM tags into stable internal categories, removes duplicates, calculates distance zones, and assigns data quality signals before the scoring engine runs.

Raw OSM tags are normalized into internal facility kinds:

| OSM tag examples | Internal kind | Used for |
|---|---|---|
| `amenity=university`, `amenity=college` | `campus` | Student, office and general demand |
| `amenity=school` | `school` | Student and resident demand |
| `office=*`, `building=office` | `office` | Office and general demand |
| `landuse=residential`, `building=apartments` | `housing` | Resident demand |
| `building=dormitory`, `tourism=guest_house`, `tourism=hostel` | `boarding_house` | Student and resident demand |
| `highway=bus_stop`, `railway=station`, `public_transport=station` | `transit` | Commuter demand and accessibility |
| `amenity=cafe`, `amenity=restaurant`, `shop=laundry`, … | `cafe`, `restaurant`, `laundry`, … | Competition |
| `shop=convenience`, `shop=supermarket` | `convenience`, `supermarket` | Competition for minimarkets; support for other categories |
| `amenity=atm`, `amenity=marketplace`, `amenity=clinic`, … | `atm`, `marketplace`, `clinic`, … | Supporting Facility Fit |
| Unmapped tags | `other` | Stored, not scored |

The full mapping is in [docs/data-sources.md](docs/data-sources.md#tag-mapping).

### Repository layout

```
.
├── apps/
│   ├── web/          React frontend
│   └── api/          NestJS backend
├── packages/
│   └── scoring/      Shared scoring engine (pure TypeScript)
├── docs/
│   ├── methodology.md    Formulas, weights, worked examples
│   ├── architecture.md   Design decisions and data flow
│   ├── installation.md   Full setup guide
│   ├── api.md            HTTP endpoint reference
│   ├── data-sources.md   Provenance, licensing, attribution
│   └── roadmap.md        Scope boundaries and future work
└── package.json      npm workspaces root
```

## Getting started

**Requirements:** Node.js 20 or newer (24 recommended — see `.nvmrc`) and npm 10+.

```bash
git clone https://github.com/CaptainSDD/GAYATAMA-2026.git
cd GAYATAMA-2026

npm install

cp .env.example .env      # then fill in the values — see below
```

Run everything in development:

```bash
npm run dev               # web + api together
npm run dev:web           # frontend only  → http://localhost:5173
npm run dev:api           # backend only   → http://localhost:3000
```

Other tasks:

```bash
npm run build             # build every workspace
npm test                  # run every test suite
npm run typecheck         # type-check without emitting
```

### Configuration

`.env.example` documents every variable. The two that need real values before
the app is fully functional:

| Variable | Needed for | Notes |
|----------|-----------|-------|
| `FIREBASE_PROJECT_ID` + credentials | POI caching, saved reports | See [installation.md](docs/installation.md#firebase-setup) |
| `OVERPASS_URL` | POI lookups | Defaults to the public instance; rate-limited |

> **Security note.** A Firebase service account key grants full database access.
> It must never be committed — `.gitignore` blocks the usual filenames, but keep
> the file outside this repository entirely and pass it via
> `GOOGLE_APPLICATION_CREDENTIALS`. In deployment, use
> `FIREBASE_SERVICE_ACCOUNT_JSON` as a platform secret.

Full setup, including Firestore rules and deployment:
**[docs/installation.md](docs/installation.md)**.

## Data sources and attribution

Facility and business data comes from **[OpenStreetMap](https://www.openstreetmap.org/)**,
queried through the [Overpass API](https://overpass-api.de/).

OpenStreetMap data is © OpenStreetMap contributors and licensed under the
**[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/)**.
Attribution is displayed on every map view and in every exported report, as the
licence requires.

Choosing open data over a commercial POI provider was a deliberate design
decision with consequences we accept — coverage varies by region, and
GAYATAMA's Data Quality factor exists precisely to model that variation rather
than paper over it. Where available, OSM's `check_date` and related freshness tags feed the freshness weighting. 
The reasoning is documented in
**[docs/data-sources.md](docs/data-sources.md)**.

## Limitations

Stated plainly, because a decision-support tool that oversells itself is worse
than none:

- **A score is not a guarantee of profit.** It is one input into a decision that
  also involves rent, capital, supply chains, licensing, and the operator's own
  skill — none of which GAYATAMA models.
- **Coverage depends on OpenStreetMap density.** Results are strongest in mapped
  urban areas. Where data is sparse, the Confidence Score falls and the
  uncertainty range widens; it does not silently degrade into a confident wrong
  answer.
- **Baseline weights are calibrated judgement, not fitted parameters.** The
  numbers in [docs/methodology.md](docs/methodology.md) are documented MVP
  baselines intended for recalibration against field data.
- **Field verification is required before investment.** Every report ends with a
  checklist of what to confirm on site, on both a weekday and a weekend.

## Roadmap

What is deliberately out of scope for this submission, and why:
**[docs/roadmap.md](docs/roadmap.md)**.

## Team

<!-- TODO before submission: replace with real names, study programmes, and faculty advisor. -->

| Role | Name | Institution |
|------|------|-------------|
| _TBD_ | _TBD_ | _TBD_ |

**Faculty advisor:** _TBD_

## License

Licensed under the [Apache License 2.0](LICENSE).

OpenStreetMap data is separately licensed under ODbL 1.0 — see
[Data sources and attribution](#data-sources-and-attribution).
