# @gayatama/scoring

The scoring engine. Pure TypeScript, **zero runtime dependencies**, no I/O.

Facility data in, scores out. Every function is deterministic.

## The rule that keeps this package useful

**Never add a runtime dependency.** No HTTP client, no Firebase, no date
library. If a function needs data, it takes it as an argument.

Three properties depend on that rule holding:

- The browser can run the engine, so the what-if simulator recomputes locally
  with no network round trip.
- The frontend and backend import the same functions, so they cannot disagree
  about what a location scores.
- Every branch is unit-testable without mocks, fixtures, or a network.

## Usage

```ts
import { scoreLocation, recommendBusinessTypes } from '@gayatama/scoring';

const result = scoreLocation({
  facilities,          // normalised POIs with distance, quality, access
  businessType: 'laundry',
});

result.score;          // 75.3  — unrounded
result.confidence;     // 81
result.margin;         // 8     — display as 75 ± 8
result.components;     // the five weighted components
```

## Development

```bash
npm run build       # compile to dist/
npm test            # run the suite
npm run test:watch
npm run typecheck
```

## Testing contract

Every worked example in [../../docs/methodology.md](../../docs/methodology.md)
exists here as an assertion. If the documented methodology and the
implementation diverge, the build fails. That is the mechanism that keeps the
documentation trustworthy rather than aspirational.

All constants live in `src/constants.ts`, isolated so that recalibration is a
single-file change reviewable against the methodology document.
