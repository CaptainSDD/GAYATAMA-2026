# @gayatama/scoring

The scoring engine. Pure TypeScript, **zero runtime dependencies**, no I/O.

Facility data in, scores out. Every function is deterministic: the engine never
reads the clock, so the date the data is evaluated against is an input.

Each normalised facility may carry a mapped `severance` value. The engine turns
that into an Access Factor: `none = 1.00`, `major_road = 0.65`, and
`rail_river_toll = 0.40`. This factor reduces that facility's contribution to
demand, competition, segments, and supporting-facility fit before the five
components are combined. The aggregate accessibility component is worth 20% of
the final score.

## The rule that keeps this package useful

**Never add a runtime dependency.** No HTTP client, no Firebase, no date
library. If a function needs data, it takes it as an argument.

Three properties depend on that rule holding:

- The browser can run the engine, so the what-if simulator could recompute
  locally with no network round trip. It asks the API today; moving it is a
  change of caller, not of model.
- The frontend and backend import the same functions, so they cannot disagree
  about what a location scores.
- Every branch is unit-testable without mocks, fixtures, or a network.

The build enforces part of this: the source compiles without Node.js or browser
type definitions, so code that reaches for `fetch`, `process` or the DOM fails
to build.

## Usage

```ts
import { recommendBusinessTypes, scoreLocation, simulate } from '@gayatama/scoring';

const input = {
  location: { lat: -7.3012, lng: 112.7179 },
  facilities,                      // normalised POIs from the API
  site: { roadClass: 'tertiary' }, // conditions at the site itself
  asOf: '2026-09-11',              // date the data is evaluated against
};

const result = scoreLocation(input, 'laundry');
result.score;        // { value, band, confidence, margin, range } — display as 75 ± 8
result.components;   // the five weighted components
result.competition;  // competitor-equivalents, saturation, strongest competitors
result.accessibility;// aggregate Access Factor and accessibility evidence
result.warnings;     // hard warnings, raised regardless of score

recommendBusinessTypes(input);                            // all seven categories, ranked
simulate(input, 'laundry', { onSiteParkingSpaces: 10 });  // what-if
```

When confidence is below 40, `result.insufficientData` is `true` and no
definitive recommendation may be shown.

## Development

```bash
npm run build       # ES modules to dist/esm, CommonJS to dist/cjs
npm test            # run the suite
npm run test:watch
npm run typecheck   # source and tests
```

Both apps import the compiled `dist/`, so the package must be built before
either app runs. The root `npm run dev` builds it first.

## Testing contract

- `test/methodology.test.ts` asserts every worked example in
  [docs/methodology.md](../../docs/methodology.md).
- `test/api-examples.test.ts` recomputes the example responses in
  [docs/api.md](../../docs/api.md).
- `test/proposed.test.ts` covers the formulas the original specification did not
  define — see "Proposed in model 0.1.0" in the methodology.

The API owns the geospatial derivation of `severance` from OSM barrier and
passage geometry; its `test/severance.spec.ts` verifies that boundary.

If the documentation and the implementation diverge, the suite fails.

All constants live in `src/constants.ts`, isolated so that recalibration is a
single-file change reviewable against the methodology document.
