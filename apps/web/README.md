# @gayatama/web

React + Vite frontend: map picker, score breakdown, business type
recommendations, and the target market and competitor panels.

## Development

```bash
npm run dev:web     # from the repo root → http://localhost:5173
```

The web app reads everything through the API, so start that too — `npm run dev`
runs both. When the API is not at `http://localhost:3000`, set
`VITE_API_BASE_URL` in the root `.env`.

With `VITE_GOOGLE_MAPS_API_KEY` in the root `.env`, the map is a Google map and
requests set `googleMap`, so the API may add Google business counts. Without it,
the map is an OpenStreetMap map and Google data is never requested — see
[../../docs/installation.md](../../docs/installation.md#google-maps-platform-optional).

Every analysis has its own URL (`?lat=…&lng=…&type=…`), so a result can be
shared as a link.

The what-if simulator and report export are not built yet.

## Structure

```
src/
├── App.tsx            Layout; keeps the selected point and business type in the URL
├── components/        Tabs, loading and error states, notices, attribution
├── features/
│   ├── map/           OpenStreetMap or Google map picker, zone rings, business type and location controls
│   ├── location/      Tabs for a selected location
│   ├── score/         Score with its interval, component breakdown, warnings
│   ├── recommend/     All seven business types ranked, with statuses
│   ├── segments/      Customer segments and the facilities behind them
│   └── competition/   Competitor equivalents, saturation, strongest competitors
└── lib/               API client and types, query hooks, formatting, labels
```

## Interface rules

Constraints inherited from the methodology, enforced in the UI layer:

- **A score is never shown without its confidence interval.** `75 ± 8`, never a
  bare `75`. When rounding would carry a score into the next band (69.6 → 70),
  it is shown to one decimal so the number never contradicts its label.
- **Incomplete data is said out loud.** When the API reports stale data, site
  conditions it could not load, or Google counts it could not use, the result
  carries a notice.
- **Segment scores are never presented as population counts.**
- **OpenStreetMap attribution is present on every result and on the
  OpenStreetMap map.** This is an ODbL licence obligation, not a courtesy — see
  [../../docs/data-sources.md](../../docs/data-sources.md).
- **Google data appears only on a Google map, with "Google Maps" attribution.**
  Both are Google Maps Platform requirements.

## Tests

```bash
npm run test -w @gayatama/web
```

Unit tests cover the logic behind the interface: URL state, API errors and
retries, score formatting, and segment evidence.
