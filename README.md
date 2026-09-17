<div align="center">

# GAYATAMA / LOKABIS

**Location intelligence for micro-entrepreneurs — open data first, honest about uncertainty.**

[![SDG 8](https://img.shields.io/badge/SDG-8.3_Decent_Work_&_Economic_Growth-A21942)](https://sdgs.un.org/goals/goal8)
[![SDG 9](https://img.shields.io/badge/SDG-9.3_Industry_&_Innovation-FD6925)](https://sdgs.un.org/goals/goal9)
[![SDG 11](https://img.shields.io/badge/SDG-11.3_Sustainable_Cities-FD9D24)](https://sdgs.un.org/goals/goal11)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)

Submitted to the **International Web Technology Competition — GAYATAMA 5**,
Universitas Negeri Surabaya.

[Local Setup](docs/installation.md) · [Documentation](docs/) · [Methodology](docs/methodology.md)

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

LOKABIS closes that gap using data that is free for anyone to use.

## What it does

Pick a point on the map, choose a business type, and LOKABIS returns a
**0–100 suitability score** with the reasoning fully unpacked: which nearby
facilities create demand, how saturated the competition already is, who the
likely customers are, and how confident the system is in its own answer.
The LOKABIS web interface adds Firebase sign-in/sign-up, email verification,
shareable analysis URLs, light/dark themes, and a replayable guided tour.

### What makes it different

Three deliberate choices separate LOKABIS from a generic "heatmap of busy
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
below a confidence floor, LOKABIS declines to give a definitive recommendation
at all. A number that looks certain when it is not is worse than no number.

**3. It never invents demographics.**
LOKABIS does not claim population counts, age distributions, or income levels
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
| 5 | **Side-by-side Comparison** | *Which of these is the better bet?* Two comparisons: all seven business types ranked against each other at one point, and two candidate locations scored for the same business type, each with the deciding differences named. |
| 6 | **What-if Simulator** | *What would change if I fixed the parking?* Rescores the location with on-site parking or the operator's own opening hours applied, and reports the baseline, the new score, and exactly which components moved. |
| 7 | **Area Opportunity Map** | *Am I on the best corner of this neighbourhood?* Nine points 350 m apart, each scored for the chosen category, with the strongest named by direction and distance — and one control to move the whole analysis there. |
| 8 | **Consolidated Report** | *Can I take this away and show someone?* Any completed analysis opens as a print-ready report the browser saves as PDF, carrying the score, its interval, the evidence, and the data attribution. |
| 9 | **Authentication & Guided Tour** | *Can I enter securely and understand the workflow?* Firebase email/password accounts, email-verification guidance, protected app routes, and a replayable product tour. |

The simulator moves only what an owner actually controls, and the opportunity
grid is OpenStreetMap-only — a Google aggregate count covers an area, so it
cannot be split honestly across nine separate points. Both say plainly when a
point could not be scored rather than filling the gap with a number.

Full formulas, weights, and worked examples: **[docs/methodology.md](docs/methodology.md)**.

## SDG alignment

LOKABIS targets one goal directly and two in support.

**SDG 8.3 (primary)** — *"Promote development-oriented policies that support
productive activities, decent job creation, entrepreneurship, creativity and
innovation, and encourage the formalization and growth of micro-, small- and
medium-sized enterprises."*

This is the project's thesis, not a retrofitted label. LOKABIS takes an
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
| Mapping | Leaflet + React Leaflet with OpenStreetMap tiles; Google Maps through `@vis.gl/react-google-maps` when a browser key is set | Runs with no API key. With keys the map is a Google map, because Google's terms allow Google data to be shown only on one |
| Server state | TanStack Query | Request deduplication and caching for slow geospatial queries |
| Backend | NestJS 11, TypeScript | Modular architecture with dependency injection; keeps the geospatial, scoring, and caching concerns genuinely separated |
| Database | Cloud Firestore (optional) | Persistent POI cache and authenticated user profiles; without Firebase the API uses an in-memory POI cache |
| POI data | OpenStreetMap: live through the Overpass API, with fallback instances; offline snapshots for the demo areas. Overture Maps shops for photocopy, printing and stationery in the demo areas. Optionally, Google Maps business counts from the Places Aggregate API | OpenStreetMap is open, global and attributable, and the demo does not depend on a shared public service. Google counts fill its small-business gaps, and any Google failure falls back to it — see [Data sources](#data-sources-and-attribution) |
| Scoring | `@gayatama/scoring` — a shared, dependency-free TypeScript package | See below |
| Validation | Zod | One schema definition validating both API boundaries and engine inputs |
| Testing | Vitest (engine, web), Jest (API) | The scoring engine is pure, so it is exhaustively unit-testable |

### Why the scoring engine is its own package

`packages/scoring` contains no framework code, no I/O, and no dependencies — it
is a set of pure functions from facility data to scores. Three consequences
worth stating explicitly:

- **The what-if simulator could move into the browser.** It currently asks the
  API, but the same pure `simulate()` the API calls is exported to the web app,
  so recomputing locally with no round trip is a change of caller, not of model.
- **The frontend and backend minimize scoring drift.** Both import shared scoring
  types and rules, while the backend is authoritative for current analysis and
  recommendations.
- **The methodology is testable as a unit.** Every worked example in
  [docs/methodology.md](docs/methodology.md) exists as an assertion in the test
  suite, so the documentation cannot silently drift from the implementation.

## Architecture

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  apps/web  (React + Vite)    │         │  apps/api  (NestJS)          │
│                              │  HTTP   │                              │
│  • Map: OpenStreetMap/Google │ ──────► │  • Request validation        │
│  • Score breakdown panel     │ ◄────── │  • POI cache lookup          │
│  • Business ranking          │         │  • Overpass, Google counts   │
│  • Target/competition views  │         │  • Barrier/access mapping    │
│  • Comparison views          │         │  • Scoring orchestration     │
│  • What-if simulator         │         │  • Simulate / opportunities  │
│  • Area opportunity grid     │         │  • Auth and rate limiting    │
│  • Report export, auth, tour │         │                              │
└──────────────┬───────────────┘         └───┬────────────────┬─────────┘
               │                             │                │
               │ imports for local preview   │ reads/writes   │ fetches on miss
               │ optional only               ▼                ▼
               │                  ┌──────────────────┐ ┌──────────────────────┐
               │                  │ Firestore cache  │ │ Overpass API         │
               │                  │ and profiles     │ │ OpenStreetMap source │
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
               │                  │ • Access-barrier mapping     │
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

LOKABIS does not score raw OpenStreetMap tags directly. The normalization layer converts messy OSM tags into stable internal categories, removes duplicates, calculates distance zones, and assigns data quality signals before the scoring engine runs.

For accessibility, the API also tests the straight line from the selected point
to each facility against mapped major roads, motorway/toll roads, railways, and
rivers/canals. Nearby crossings, fords, bridges, and tunnels cancel a matching
penalty. The resulting Access Factor is `1.00`, `0.65`, or `0.40`; full rules
and caveats are in [docs/methodology.md](docs/methodology.md#access-factor).

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

If the API exits with `EADDRINUSE :::3000`, port 3000 is already owned by
another process—usually an older development server. On PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
Get-Process -Id <OwningProcess>
```

Stop that process, or set `PORT=3001` and
`VITE_API_BASE_URL=http://localhost:3001` together before starting the apps.

Other tasks:

```bash
npm run build             # build every workspace
npm test                  # run every test suite
npm run typecheck         # type-check without emitting
```

### Configuration

`.env.example` documents every variable. The ones worth setting:

| Variable | Needed for | Notes |
|----------|-----------|-------|
| `FIREBASE_PROJECT_ID` + Admin credentials | Persistent POI caching and authenticated profile registration | See [installation.md](docs/installation.md#firebase-setup) |
| `VITE_FIREBASE_*` | Browser sign-up, sign-in, and email verification | Must describe the same Firebase project as the Admin credentials |
| `OVERPASS_URL` | POI lookups outside the demo areas | Defaults to the main public instance; `OVERPASS_FALLBACK_URLS` lists the instances tried when it fails |
| `GOOGLE_PLACES_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY` | Optional: the Google map and Google business counts | A server key and a browser key, each restricted — see [installation.md](docs/installation.md#google-maps-platform-optional) |

> **Security note.** A Firebase service account key grants full database access.
> It must never be committed — `.gitignore` blocks the usual filenames, but keep
> the file outside this repository entirely and pass it via
> `GOOGLE_APPLICATION_CREDENTIALS`. In deployment, use
> `FIREBASE_SERVICE_ACCOUNT_JSON` as a platform secret. Google API keys belong in
> `.env` or a platform secret too, never in the repository.

Full setup, including Firestore rules and deployment:
**[docs/installation.md](docs/installation.md)**.

## Data sources and attribution

Facility and business data comes from **[OpenStreetMap](https://www.openstreetmap.org/)**:
live through the [Overpass API](https://overpass-api.de/) and, for the demo
areas, from offline snapshots of a [Geofabrik](https://download.geofabrik.de/)
extract, so the demo keeps working when public Overpass instances are down.

When the web app draws a Google map, the number of businesses and facilities of
each kind in each distance zone comes from the **Google Maps Places Aggregate
API**, for the kinds Google covers. Every other kind, and every Google failure,
falls back to OpenStreetMap, and results that use Google counts say
"Google Maps".

In the demo areas, photocopy, printing and stationery shops — which OpenStreetMap
maps thinly and Google has no place type for — also come from
**[Overture Maps](https://overturemaps.org/)** Places, under the Community Data
License Agreement – Permissive 2.0, credited as "Overture Maps Foundation".

OpenStreetMap data is © OpenStreetMap contributors and licensed under the
**[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/)**.
Attribution, with the date of the data, is displayed under every result and on
the OpenStreetMap map, as the licence requires.

OpenStreetMap stays the base by design: the app runs fully without any key or
paid quota. Its coverage varies by region, and LOKABIS's Data Quality factor
exists precisely to model that variation rather than paper over it. Where
available, OSM's `check_date` and related freshness tags feed the freshness
weighting. The reasoning, and the Google terms that shape the design, are
documented in **[docs/data-sources.md](docs/data-sources.md)**.

## Limitations

Stated plainly, because a decision-support tool that oversells itself is worse
than none:

- **A score is not a guarantee of profit.** It is one input into a decision that
  also involves rent, capital, supply chains, licensing, and the operator's own
  skill — none of which LOKABIS models.
- **Coverage depends on map data density.** Without Google counts, results rest
  on OpenStreetMap, which misses many small Indonesian businesses, and are
  strongest in well-mapped urban areas. Where data is sparse, the Confidence Score falls and the
  uncertainty range widens; it does not silently degrade into a confident wrong
  answer.
- **Baseline weights are calibrated judgement, not fitted parameters.** The
  numbers in [docs/methodology.md](docs/methodology.md) are documented MVP
  baselines intended for recalibration against field data.
- **Access Factor is a geometry proxy, not pedestrian routing.** It checks
  straight-line barrier crossings and known passages; incomplete OSM geometry
  or an indirect real-world route can change the practical result. Rebuild old
  offline snapshots after access-query changes to capture full barrier coverage.
- **Field verification is required before investment.** Confirm access, traffic,
  parking, rent, and competition on site on both a weekday and a weekend.

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
