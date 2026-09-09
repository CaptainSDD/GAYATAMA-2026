# @gayatama/web

React + Vite frontend. Map picker, score breakdown, business ranking, target
market panel, what-if simulator, and report export.

## Development

```bash
npm run dev:web     # from the repo root → http://localhost:5173
```

Runs without Firebase configured — scoring works, caching and saved reports do
not. Expect slower POI requests and occasional Overpass rate limits in that
mode.

## Why the simulator feels instant

`@gayatama/scoring` is a pure package with no dependencies, so the browser runs
it directly. The POI set from the original request stays in memory, and moving a
what-if slider recomputes the score locally — no network round trip per tick.

## Structure

```
src/
├── features/
│   ├── map/          Leaflet picker, zone rings, facility markers
│   ├── score/        Score gauge, component breakdown, confidence interval
│   ├── recommend/    Ranked category list
│   ├── segments/     Target market panel with facility evidence
│   ├── competition/  Competitor list and saturation display
│   ├── simulate/     What-if controls (local recompute)
│   └── report/       Consolidated report and PDF export
├── lib/              API client, query hooks, Firebase web SDK
└── components/       Shared UI primitives
```

## Interface rules

Two constraints inherited from the methodology, enforced in the UI layer:

- **A score is never shown without its confidence interval.** `75 ± 8`, never
  a bare `75`.
- **OpenStreetMap attribution is present on every map view and every exported
  report.** This is an ODbL licence obligation, not a courtesy — see
  [../../docs/data-sources.md](../../docs/data-sources.md).
