# GAYATAMA Documentation

These documents describe model `0.1.0` as it is implemented today: Firebase
authentication, open-data ingestion, scoring, recommendations, confidence, and
mapped access-barrier penalties. The what-if UI and downloadable reports remain
planned work; the engine already exposes the pure simulation function.

| Document | What it covers |
|----------|----------------|
| [methodology.md](methodology.md) | Every formula, weight, threshold, and worked example. The specification the scoring engine implements |
| [architecture.md](architecture.md) | System design, the three decisions that shaped it, request flow, module layout, failure modes |
| [installation.md](installation.md) | Setup from clone to deployment, including Firebase and Firestore rules |
| [api.md](api.md) | HTTP endpoint reference with full request and response shapes |
| [data-sources.md](data-sources.md) | Where the data comes from, its licence, OSM tag mapping, and what GAYATAMA does not know |
| [roadmap.md](roadmap.md) | What was deliberately cut from this submission, and why |

When descriptions disagree, use [methodology.md](methodology.md) for scoring
rules, [api.md](api.md) for the HTTP contract, and
[installation.md](installation.md) for runtime configuration.

## Suggested reading order

**To evaluate the project:** [methodology.md](methodology.md) →
[architecture.md](architecture.md) → [data-sources.md](data-sources.md).
The methodology is the substance; the architecture explains how it stays
verifiable; the data sources explain what it rests on.

**To run it:** [installation.md](installation.md) → [api.md](api.md).

**To extend it:** [architecture.md](architecture.md) →
[roadmap.md](roadmap.md).
