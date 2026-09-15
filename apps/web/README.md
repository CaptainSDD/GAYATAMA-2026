# @gayatama/web

React 19 + Vite frontend for **LOKABIS**, the product interface in this
GAYATAMA repository. It includes Firebase email/password authentication, a
guided first-run tour, map selection, score breakdowns, business rankings,
target-market evidence, and competitor analysis.

The interface is in **Indonesian**, because the people it is for are Indonesian
micro-entrepreneurs. The documentation in `docs/` stays English.

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

Firebase browser variables (`VITE_FIREBASE_*`) enable sign-up, sign-in, email
verification, and authenticated profile registration. The analysis API can run
without Firebase, but account creation cannot be completed in that mode.

Every analysis has its own URL (`?lat=…&lng=…&type=…`), so a result can be
shared as a link.

The current UI implements analysis, recommendations, shareable URLs, auth,
theme selection, and the guided tour. The what-if simulator and report/PDF
export are not built yet.

## Structure

```
src/
├── App.tsx            Layout; keeps the selected point and business type in the URL
├── components/        Tabs, cards, skeletons, icons, theme toggle, share, notices
├── features/
│   ├── auth/          Sign-in, sign-up, email verification, protected routes
│   ├── tour/          First-run guidance and replay controls
│   ├── map/           OpenStreetMap or Google map picker, zone rings, facility markers, controls
│   ├── location/      Tabs for a selected location
│   ├── score/         Score gauge with its interval, component breakdown, warnings
│   ├── recommend/     All seven business types ranked, with statuses
│   ├── segments/      Customer segments and the facilities behind them
│   └── competition/   Saturation meter, competitor equivalents, strongest competitors
└── lib/               API client and types, query hooks, formatting, labels,
                       theme preference, engine-derived colours
```

Light and dark are both supported. The theme follows the operating system until
someone uses the toggle, which then pins the choice in `localStorage`; a small
inline script in `index.html` applies it before first paint so a reload never
flashes the wrong colour.

## Interface rules

Constraints inherited from the methodology, enforced in the UI layer:

- **A score is never shown without its confidence interval.** `75 ± 8`, never a
  bare `75`. When rounding would carry a score into the next band (69.6 → 70),
  it is shown to one decimal so the number never contradicts its label. The
  score gauge draws the interval as a band on the arc, so the uncertainty is
  part of the picture rather than a footnote.
- **Colour is derived from the engine, never restated.** `lib/band-color.ts`
  maps a `Band`, `SegmentRole`, `SaturationReading` or `ConfidenceReading` onto
  a CSS token. No threshold is written a second time in the interface, so
  recalibrating `packages/scoring/src/constants.ts` recolours the UI on its own.
- **Incomplete data is said out loud.** When the API reports stale data, site
  conditions it could not load, or Google counts it could not use, the result
  carries a notice.
- **Segment scores are never presented as population counts.**
- **OpenStreetMap attribution is present on every result and on the
  OpenStreetMap map.** This is an ODbL licence obligation, not a courtesy — see
  [../../docs/data-sources.md](../../docs/data-sources.md).
- **Google data appears only on a Google map, with "Google Maps" attribution.**
  Both are Google Maps Platform requirements.

## Colour system

The interface chrome follows a 60-30-10 composition, defined as tokens at the
top of `styles.css`:

| Share | Tier | Colour | Where it appears |
|-------|------|--------|------------------|
| 60% | `--primer-*` | Neutral slate | Page background, card surfaces, body text, borders |
| 30% | `--sekunder-*` | Brand teal | Brand mark, step markers, zone rings, chips, spinner, informational callouts |
| 10% | `--tersier-*` | Indigo | Active tab, the primary action, action links, the focus ring — and nothing else |

The score scale (`--tone-*`) deliberately sits **outside** that ratio. Those
colours are data rather than decoration: they come from the engine's bands, so
rebalancing them for visual effect would make the interface disagree with the
score it is reporting. Indigo was chosen for the accent because it collides with
none of them — green, amber, orange and red all carry meaning on the scale.

Keeping the accent rare is the point. Used on more than the handful of elements
listed above, it stops reading as an accent and the eye loses its anchor.

## Tests

```bash
npm run test -w @gayatama/web
```

Unit tests cover URL state, authentication validation, API errors and retries,
score formatting, and segment evidence.
