# Scoring Methodology

This document specifies exactly how GAYATAMA turns a map coordinate into a
score. Every formula, weight, and threshold used by the system is here.

The numbers below are **MVP baselines**: values chosen from domain reasoning and
documented so they can be argued with, not parameters fitted to observed
outcomes. They are intended to be recalibrated once field data is available.
Where a number is a judgement call, this document says so rather than
presenting it as measured.

Every worked example in this document is mirrored by an assertion in the
`@gayatama/scoring` test suite, so the documentation cannot drift from the
implementation without turning the build red.

---

## Basis of the MVP weights

The MVP weights are rule-based baselines, not statistically fitted parameters. They are based on explicit design assumptions:

- Customer demand should dominate the final score because a business location is only useful if enough relevant customers are nearby.
- Distance should decay gradually because nearby facilities usually matter more than distant ones.
- Competition should be judged relative to demand, not as a raw count.
- Missing or stale open data should reduce confidence rather than automatically reduce the business score.
- Operational risks should not dominate the score unless they create hard warnings, because some risks can be checked or mitigated before opening.

These values are intentionally documented as calibratable assumptions. Future versions should recalibrate them using field surveys, entrepreneur interviews, transaction data, or observed business outcomes.

### What the structure rests on

The numbers are GAYATAMA's own judgement. The structure they sit in is not: each
part follows an established idea from retail location analysis, GIS decision
analysis, or research on open map data quality. The table separates the
borrowed idea from the chosen numbers, so each can be challenged on its own
terms. Full citations are in [References](#references).

| Part of the model | Established idea it follows | Source | GAYATAMA's own choice |
|-------------------|-----------------------------|--------|-----------------------|
| Location Score as a weighted sum of components | Weighted linear combination, a standard method in GIS-based multicriteria suitability analysis | Malczewski (1999, 2006) | The five components and the 35 / 20 / 20 / 15 / 10 weights |
| Facilities count less the farther away they are | Distance decay: the likelihood that a customer uses a store falls with distance, which is how trade areas are modelled | Huff (1964) | Three stepped zone weights (1.00 / 0.60 / 0.25) in place of a continuous decay curve |
| Zone edges at 300 m, 800 m and 1,500 m | Walking catchments; the half-mile (about 800 m) circle is a common planning convention, and how well it fits real catchments has been tested | Guerra, Cervero & Tischler (2012) | The exact boundaries, applied to every category |
| Some competition counts in a location's favour (validation bonus) | Retail agglomeration: similar and complementary shops can draw more customers together than apart, and competing sellers tend to locate near each other | Nelson (1958); Hotelling (1929) | The bonus sizes (−10 / +5 / 0 / −5) |
| Data Quality factor from `check_date` and edit metadata | Intrinsic quality assessment: judging volunteered map data by its own properties when no reference dataset is available | Senaratne et al. (2017) | The factor values (1.00 / 0.85 / 0.65 / 0.40 / 0.00) |
| Confidence Score; missing data lowers confidence rather than the score | OpenStreetMap completeness is uneven between places, and gaps in coverage have been found to correlate with deprivation | Haklay (2010); Barrington-Leigh & Millard-Ball (2017) | The four confidence inputs, their weights, and the floor of 40 |
| Scores shown with a range (`75 ± 8`) | Communicating uncertainty about a number explicitly, including as a range | van der Bles et al. (2019) | The margin formula |
| Zoning hard warning | Indonesian spatial plans (RTRW) determine permitted land use | UU No. 26 Tahun 2007 tentang Penataan Ruang | Using `landuse=*` as a stand-in until RTRW data is integrated |

Three limits on these sources, stated so they are not over-read:

- **They support the shape of the model, not its numbers.** No source above
  supplies a weight, threshold, or factor value used here.
- **The coverage studies measure roads, not businesses.** Haklay (2010) and
  Barrington-Leigh & Millard-Ball (2017) assess road and map coverage. No source
  here measures how completely OpenStreetMap records shops and services in
  Indonesia.
- **The saturation formula has no published source.** `Capacity = Demand Fit / T`
  and the `T` values are GAYATAMA's own construction.

### Testing the weights

Because the weights are chosen rather than measured, their influence should be
tested rather than assumed. The standard check for a weighted suitability model
is sensitivity analysis: change one weight at a time, rescale the others so they
still sum to 100%, and observe whether the verdict or the ranking changes
(Chen, Yu & Khan, 2010). A recommendation that flips under a small change in
weights is uncertain whatever its score. GAYATAMA has not yet run this analysis.

## Table of contents

- [System-wide rules](#system-wide-rules)
- [Basis of the MVP weights](#basis-of-the-mvp-weights)
- [1. Location Potential Score](#1-location-potential-score)
- [2. Business Type Recommendation](#2-business-type-recommendation)
- [3. Competitor Analysis](#3-competitor-analysis)
- [4. Target Market Insight](#4-target-market-insight)
- [5. Business Simulation & Report](#5-business-simulation--report)
- [Confidence Score and warnings](#confidence-score-and-warnings)
- [Implementation notes](#implementation-notes)
- [Proposed in model 0.1.0](#proposed-in-model-010)
- [Revision notes](#revision-notes)
- [References](#references)

---

## System-wide rules

### Distance zones

The analysis area around a candidate point is divided into three zones. A
facility's influence decays with distance rather than cutting off abruptly.

| Zone | Distance | Weight |
|------|----------|--------|
| A | Up to 300 m | 1.00 |
| B | More than 300 m, up to 800 m | 0.60 |
| C | More than 800 m, up to 1,500 m | 0.25 |

Where routing data is available, distance is measured along the street or
pedestrian network. Straight-line (haversine) distance is a documented fallback
— see [Roadmap](roadmap.md) for the current status of network routing.

### Effective contribution

Every facility and every competing business contributes a weighted value rather
than a raw count:

```
Contribution = Base Value × Distance Weight × Access Factor × Data Quality
```

### Access Factor

Physical severance matters: a shop 200 m away across an uncrossable arterial is
not 200 m away in any sense a customer experiences.

| Situation | Factor |
|-----------|--------|
| Normal, no barrier | 1.00 |
| Severed by a major road with no nearby crossing | 0.65 |
| Severed by rail, river, or toll road | 0.40 |

For mapped OpenStreetMap facilities, the API draws a straight line from the
candidate location to each facility and checks whether it intersects a mapped
barrier within the 1,500 m analysis radius:

- `highway=primary|trunk` is a major-road barrier;
- `highway=motorway`, `toll=yes`, `railway=rail`, and
  `waterway=river|canal` are strong barriers;
- an intersection within 15 m of either endpoint is treated as frontage rather
  than severance;
- a matching crossing, level crossing, ford, bridge, or tunnel mapped within
  100 m of the intersection cancels that barrier penalty.

If several barriers are crossed, the strongest factor wins. This is a
conservative straight-line proxy, not pedestrian routing: an unmapped crossing
can make the factor too low, while a mapped crossing can still be inconvenient
in practice. The result therefore remains subject to the Confidence Score and
field verification. Facilities supplied only as aggregate zone counts keep an
Access Factor of 1.00 because they have no position from which a barrier can be
tested.

### Data Quality

Freshness and reliability discount a facility's contribution rather than
excluding it. This is what allows GAYATAMA to use open data honestly: stale
records still inform the result, but they inform it less, and they lower the
Confidence Score.

| Condition | Factor |
|-----------|--------|
| Data updated within 12 months | 1.00 |
| Data 13–24 months old | 0.85 |
| Date unknown but record is reasonably complete | 0.65 |
| Data older than 24 months, or category is doubtful | 0.40 |
| Business permanently closed | 0.00 |

How these map onto OpenStreetMap tags is documented in
[data-sources.md](data-sources.md). Facilities known only as a count take the
"date unknown" band — see [Counted facilities](#counted-facilities).

### MVP business categories

Seven categories are supported in the MVP. They were chosen as the categories
where micro-entrepreneurs most commonly operate and where OSM coverage is
usable.

1. Beverages / coffee shop
2. Food stall / quick-service food
3. Laundry
4. Photocopy / printing / stationery
5. Small minimarket / modern convenience store
6. Salon / barbershop
7. Pharmacy

---

## 1. Location Potential Score

**Purpose.** Rate how suitable one location is for one specific business type,
on a 0–100 scale.

The score is **specific to a business type**. The same coordinate produces
different scores for a laundry and for a coffee shop, because they need
different customers. There is no such thing as a good location in the abstract.

### Inputs

- Location coordinates
- Target business category
- Facilities and businesses within a 1,500 m radius
- Road, transport, parking, and site-risk data

Some inputs are available from OpenStreetMap, while flood risk, zoning, and legal access may require imported datasets or manual field validation in the MVP.

### Components

| # | Component | Weight | Measures |
|---|-----------|--------|----------|
| 1 | **Demand Fit** | 35% | Strength of the relevant customer segments — students, office workers, residents, transit users, health-facility visitors |
| 2 | **Accessibility** | 20% | Road class and width, public transport, walkability, parking capacity |
| 3 | **Competition Opportunity** | 20% | Competitor saturation relative to available demand |
| 4 | **Supporting Facility Fit** | 15% | Proximity of facilities that support transactions for this category |
| 5 | **Risk and Operability** | 10% | Flooding, zoning, environmental nuisance, premises size, drainage, operational requirements |

### Formula

```
Location Score = 0.35 × Demand Fit
               + 0.20 × Accessibility
               + 0.20 × Competition Opportunity
               + 0.15 × Supporting Facility Fit
               + 0.10 × Risk and Operability
```

### Interpretation

| Score | Verdict |
|-------|---------|
| 80–100 | Highly suitable |
| 70–79 | Suitable |
| 60–69 | Moderately suitable |
| 50–59 | Risky |
| 0–49 | Not recommended |

### Worked example — laundry

| Component | Value |
|-----------|-------|
| Demand Fit | 75 |
| Accessibility | 67 |
| Competition Opportunity | 76 |
| Supporting Facility Fit | 73 |
| Risk and Operability | 95 |

```
  0.35(75) + 0.20(67) + 0.20(76) + 0.15(73) + 0.10(95)
= 26.25   + 13.40    + 15.20    + 10.95    + 9.50
= 75.30
```

Displayed as **75/100 — "Suitable"**.

### Output

- Score and suitability band
- Breakdown of all five components
- The three strongest supporting factors
- The three most significant risks or weaknesses
- Confidence Score, plus a warning when data is incomplete

---

## 2. Business Type Recommendation

**Purpose.** Answer the inverse question — the user has a location but no fixed
business plan.

### Step 1 — Score six target market segments

Each segment is scored 0–100:

| Segment | Who |
|---------|-----|
| **Student** | School and university students |
| **Office** | Office workers |
| **Resident** | People living in houses, apartments, boarding houses |
| **Commuter** | Transit users and passers-through |
| **Health** | Patients, companions, healthcare staff |
| **General** | General visitors |

### Step 2 — Facilities award points to segments

Baseline points, before weighting:

| Facility | Points awarded |
|----------|----------------|
| University campus | Student +35, Office +10, General +10 |
| School | Student +22, Resident +10 |
| Office building | Office +30, General +8 |
| Housing cluster | Resident +28 |
| Boarding house / dormitory | Student +18, Resident +25 |
| Bus stop / station | Commuter +30 |
| Large hospital | Health +38, Office +10 |
| Shopping mall | General +25, Office +15, Commuter +15 |

Each award is still multiplied by distance weight, access factor, and data
quality as described in [System-wide rules](#system-wide-rules).

### Step 3 — Weight segments per business category

Different businesses need different customers. These weights are the core of
per-category scoring:

| Category | Student | Office | Resident | Commuter | Health | General |
|----------|--------:|-------:|---------:|---------:|-------:|--------:|
| Beverages | 35% | 25% | 10% | 20% | 0% | 10% |
| Food | 20% | 30% | 25% | 15% | 0% | 10% |
| Laundry | 30% | 5% | 50% | 0% | 0% | 15% |
| Photocopy / stationery | 55% | 25% | 5% | 0% | 0% | 15% |
| Minimarket | 15% | 15% | 45% | 10% | 0% | 15% |
| Salon | 10% | 10% | 55% | 0% | 0% | 25% |
| Pharmacy | 5% | 10% | 40% | 5% | 30% | 10% |

Every row sums to 100%.

#### Worked example — laundry Demand Fit

Given segment scores Student = 77, Office = 48, Resident = 82, Commuter = 35,
Health = 20, General = 55:

```
  0.30(77) + 0.05(48) + 0.50(82) + 0.00(35) + 0.00(20) + 0.15(55)
= 23.10   + 2.40     + 41.00    + 0        + 0        + 8.25
= 74.75
```

This is the Demand Fit that feeds component 1 of the Location Potential Score.

### Step 4 — Rank

The full Location Potential Score is computed for all seven categories and
sorted descending.

### Recommendation rules

| Condition | Result |
|-----------|--------|
| Score ≥ 70 and confidence ≥ 60 | Primary recommendation |
| Score 60–69 and confidence ≥ 60 | Viable alternative |
| Score ≥ 60 but confidence < 60 | Requires data validation |
| Score < 60 | Not recommended |

At most three categories are presented. When two scores differ by 3 points or
less they are treated as effectively equivalent, and the system explains the
difference in risk or operational demands instead of implying a false ranking.

### Output

- Ranked business categories with scores
- Why each category fits
- Its dominant target market
- What differentiates it from the other recommendations

---

## 3. Competitor Analysis

**Purpose.** Measure the number, strength, and saturation of comparable
businesses. A raw shop count is not the measure — five shops behind a river are
not five competitors.

### Search radius

| Categories | Primary radius |
|------------|----------------|
| Beverages, food, photocopy/stationery, minimarket | 800 m |
| Laundry, salon, pharmacy | 1,500 m |

Competitors beyond the primary radius may still register as secondary
influence, capped at weight 0.25.

### Similarity level

| Relationship | Factor |
|--------------|--------|
| Direct competitor | 1.00 |
| Close substitute | 0.60 |
| Indirect substitute | 0.30 |
| Not relevant | 0.00 |

For a coffee shop: another coffee shop is 1.00; a boba or tea outlet is 0.60; a
restaurant that also sells coffee is 0.30.

### Competitor Equivalent Count (K)

```
K = Σ ( Distance Weight
      × Access Factor
      × Data Quality
      × Operating-Hours Factor
      × Similarity
      × Competitor Scale )
```

### Operating-Hours Factor

| Condition | Factor |
|---|---:|
| Hours strongly overlap | 1.00 |
| Partial overlap | 0.60 |
| Minimal overlap | 0.30 |
| Unknown hours | 0.80 |
| Closed during target hours | 0.10 |

#### Worked example — coffee shop

| Competitors | Calculation | Contribution |
|-------------|-------------|--------------|
| 2 coffee shops at 0–300 m | 2 × 1.00 | 2.00 |
| 1 boba outlet at 0–300 m | 1 × 0.60 | 0.60 |
| 2 coffee shops at 301–800 m | 2 × 0.60 | 1.20 |
| **K** | | **3.80** |

Five businesses on the map; **3.80 competitor-equivalents** in effect.

### Density bands

For an 800 m primary radius:

| K | Density |
|---|---------|
| < 2 | Low |
| 2 to < 5 | Moderate |
| 5 to < 9 | High |
| ≥ 9 | Very high |

For a 1,500 m primary radius:

| K | Density |
|---|---------|
| < 3 | Low |
| 3 to < 7 | Moderate |
| 7 to < 12 | High |
| ≥ 12 | Very high |

### Saturation, relative to demand

Competitor count alone is meaningless without demand to compare it against.
Ten competitors beside a university is a different situation from ten
competitors on an empty road.

```
Capacity         = max(1, Demand Fit / T)
Saturation Ratio = K / Capacity
```

Baseline `T` values (demand required to support one competitor-equivalent):

| Category | T |
|----------|--:|
| Beverages | 18 |
| Food | 16 |
| Laundry | 20 |
| Photocopy / stationery | 22 |
| Minimarket | 18 |
| Salon | 22 |
| Pharmacy | 25 |

| Saturation Ratio | Reading |
|------------------|---------|
| < 0.50 | Not yet saturated |
| 0.50–0.99 | Healthy competition |
| 1.00–1.49 | Becoming saturated |
| 1.50–1.99 | Saturated |
| ≥ 2.00 | Heavily saturated |

### Competition Opportunity score

```
Competition Score = clamp((95 + Validation Bonus) x exp(-(35/95) x Saturation Ratio), 0, 100)
```

| Saturation Ratio | Score (no bonus) |
|---|---|
| 0.00 | 95.0 |
| 0.55 | 77.5 |
| 1.00 | 65.7 |
| 2.00 | 45.4 |
| 3.50 | 25.9 |
| 6.00 | 10.4 |

The model used a straight line, `95 − 35 × ratio`, until a city-centre test
showed what that costs: the line reaches 0 at a ratio of 2.7, and ratios of 3 to
5 are ordinary in a dense Indonesian centre, so every point there scored the
same 0 and the component stopped telling locations apart. The decay keeps the
opening slope of that line — the first units of saturation cost what they always
did — but a crowded market is now separated from a hopeless one instead of both
being nothing.

The validation bonus encodes a deliberately counter-intuitive rule: **zero
competitors is a penalty, not a prize.** An empty market is more often an
unvalidated market than an untapped one.

| Condition | Bonus |
|-----------|------:|
| No competitors at all | −10 |
| 0 < K ≤ 2 | +5 |
| 2 < K ≤ 5 | 0 |
| K > 5 | −5 |

### Output

- Raw competitor count
- Competitor Equivalent Count
- Density band and Saturation Ratio
- Nearest and strongest competitors
- Verdict: not yet saturated / healthy / becoming saturated / heavily saturated

---

## 4. Target Market Insight

**Purpose.** Describe which customer groups are strongest around the location,
and what that implies for how the business should operate.

### Method

1. Read all facilities within 1,500 m.
2. Each facility awards points to the six segments.
3. Each award is multiplied by distance weight, access factor, facility scale,
   and data quality.
4. Each segment total is capped at 100.

```
Segment Score = min(100, Σ ( Facility Points
                           × Distance Weight
                           × Access Factor
                           × Data Quality
                           × Facility Scale ))
```

### Facility scale

| Scale | Factor |
|-------|-------:|
| Small | 0.60 |
| Medium or unknown | 1.00 |
| Large | 1.40 |

When explicit size data is unavailable, facility scale defaults to Medium / 1.00. Large is used only when OSM tags, mapped area, or known facility type justify it, such as a hospital, university campus, mall, station, or large apartment complex.

### Interpretation

| Score | Role |
|-------|------|
| ≥ 70 | Primary target |
| 45–69 | Secondary target |
| 25–44 | Supporting target |
| < 25 | Not significant |

### Worked example — Student Score

| Facility | Calculation | Contribution |
|----------|-------------|-------------:|
| 1 medium campus at 250 m | 35 × 1.00 | 35.00 |
| 2 medium schools at 500 m | 2 × 22 × 0.60 | 26.40 |
| 1 large boarding house at 700 m | 18 × 0.60 × 1.40 | 15.12 |
| **Student Score** | | **76.52 → 77** |

Students are the primary target market at this location.

### What the output actually says

The insight is not the segment name. A result reads:

> **Primary target: Resident — 82/100**
>
> - **Evidence:** three housing clusters, four boarding houses, one apartment
>   block.
> - **Common needs:** convenience, transparent pricing, routine service,
>   weekend availability.
> - **Implication for a laundry:** weekly packages, pickup and delivery, and a
>   subscription programme are more relevant here than a premium
>   one-off-transaction concept.

### The constraint that makes this honest

**The system must not claim population counts, ages, or income levels when
valid demographic data is unavailable.** Facilities are indicators of segment
*strength*, never of absolute headcount. This is enforced in the engine's
output types — the result carries segment scores and the facility evidence that
produced them, and there is no field in which a fabricated population figure
could be returned.

### Output

- Primary, secondary, and supporting targets
- Score for each segment
- The specific facilities that constitute the evidence
- Common needs of each segment
- Implications for product, pricing, promotion, and opening hours

---

## 5. Business Simulation & Report

**Purpose.** Consolidate every analysis into something a person can act on and
compare across locations.

### Flow

1. User selects a location and a business category.
2. System runs the Location Potential Score.
3. System pulls in Competitor Analysis and Target Market Insight.
4. System merges scores, evidence, opportunities, risks, and recommendations.
5. Result renders in the dashboard and exports to PDF.

### Report contents

- Final 0–100 score and suitability band
- Confidence Score and uncertainty range
- Breakdown: Demand, Accessibility, Competition, Facility, Risk
- Map of the 300 m / 800 m / 1,500 m zones
- Primary target market and its facility evidence
- Competitor count and saturation level
- Three key strengths and three key risks
- Recommendations for product, pricing, opening hours, promotion, differentiation
- A checklist of what to verify in the field

### What-if simulation

The simulator covers variables an operator can actually change. Rent is
excluded on purpose — it does not alter whether customers exist.

| Change | Effect |
|--------|--------|
| **Add parking** | Parking sub-score changes (e.g. 20 → 70); Accessibility and Location Score recompute |
| **Change opening hours** | Competitors whose hours barely overlap exert 30% of their normal pressure, and those closed during the business's hours 10%, not 100% — see [Operating-hours overlap](#operating-hours-overlap) |
| **Add delivery / pickup** | For laundry and food, the Zone C weight for customer segments rises from 0.25 to 0.35. The resulting Location Score gain is **capped at 5 points** until transaction data exists to justify more |
| **Change rent** | Does **not** affect the Location Potential Score. It affects Financial Feasibility, if that module is enabled |

The delivery cap is a deliberate guard against the simulator being used to
manufacture an attractive score. A parameter the user toggles must not be able
to talk them into a location the underlying data does not support.

### Example report summary

> Laundry scores **75/100 — Suitable**. Its main strength is a Resident Score of
> 82, driven by strong boarding-house and housing-cluster presence, with a
> competitor Saturation Ratio of 0.55 that remains healthy. Accessibility scores
> 67/100: road access is adequate but public transport is limited. A Confidence
> Score of 81/100 yields an estimated range of 67–83. The location is worth
> considering, with subscription packages and a pickup service recommended.

---

## Confidence Score and warnings

Every feature carries a Confidence Score alongside its result. This is the
mechanism that lets GAYATAMA use imperfect open data without misleading anyone.

```
Confidence = 0.40 × Data Completeness
           + 0.25 × Data Freshness
           + 0.20 × Cross-source Validation
           + 0.15 × Area Coverage
```

| Confidence | Reading |
|------------|---------|
| ≥ 85 | High |
| 70–84 | Good |
| 55–69 | Moderate |
| 40–54 | Low |
| < 40 | Very low — **no definitive recommendation is given** |

### Uncertainty range

```
Margin = round(5 + 0.15 × (100 − Confidence))
```

A score of 75 with Confidence 81 gives:

```
Margin = round(5 + 0.15 × 19) = round(7.85) = 8
```

Displayed as **75 ± 8**, i.e. a range of 67–83.

Low confidence therefore does two things at once: it widens the visible
interval, and below 40 it suppresses the recommendation entirely. The system
cannot present a confident answer built on data that does not support one.

### Hard warnings

These are surfaced **regardless of how high the score is**. A location can be
commercially excellent and still be one you must not build on.

- Business zoning appears incompatible, when zoning data is available
- No legal access to the site
- High flood risk
- Primary data older than 36 months

---

## Implementation notes

- **All intermediate values are kept as decimals.** Rounding happens only at
  display time, so no error compounds through the pipeline.
- **Every result stores the model version** that produced it, so an old report
  remains reproducible after the weights change.
- **Missing data is never scored as zero.** A missing value takes a neutral
  value and reduces the Confidence Score instead. Scoring absence as zero would
  silently punish poorly-mapped areas — exactly the areas where
  micro-entrepreneurs most need help.
- **A score is decision support, not a profit guarantee.**
- **Field verification remains necessary before investment**, on both a weekday
  and a weekend: competitors, traffic, flooding, rent, electricity, water,
  drainage, and legal status.

---

## Proposed in model 0.1.0

> **Status: proposed, pending team review.** The original specification names
> these components and inputs but does not define how to compute them. The
> engine needs a definition to run, so these are proposed baselines. Like every
> other number in this document they live in `constants.ts` and are covered by
> tests (`test/proposed.test.ts`). None of them comes from a published source.

### Accessibility

```
Accessibility = 0.35 × Road + 0.25 × Transit + 0.20 × Walkability + 0.20 × Parking
```

| Sub-score | How it is measured |
|-----------|--------------------|
| Road | Class of the nearest road: primary 100, secondary 90, tertiary 75, residential 55, service 30. Unknown: 50 |
| Transit | Highest `100 × distance weight × Access Factor` among usable transit stops — normally 100 in Zone A, 60 in Zone B, 25 in Zone C, then reduced by a mapped barrier. No stop within 1,500 m: 0 |
| Walkability | 50 + 10 for each mapped sidewalk, footway or crossing within 300 m, capped at 100. None counted: 50 |
| Parking | 20 + 5 for each parking space within 300 m, capped at 100. A car park without a `capacity` tag counts as 10 spaces, weighted by Data Quality and Access Factor. On-site spaces from the simulator count at full weight |

The parking formula reproduces the simulator example: adding 10 on-site spaces
moves Parking from 20 to 70.

### Supporting Facility Fit

```
Supporting Facility Fit = min(100, Σ ( Points × Distance Weight × Access Factor
                                     × Data Quality × Facility Scale ))
```

| Facility | Beverages | Food | Laundry | Stationery | Minimarket | Salon | Pharmacy |
|----------|----------:|-----:|--------:|-----------:|-----------:|------:|---------:|
| ATM | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| Bank | 8 | 8 | 8 | 12 | 8 | 8 | 8 |
| Traditional market (*pasar*) | 20 | 25 | 10 | 10 | 10 | 15 | 15 |
| Convenience store or supermarket | 12 | 12 | 12 | 12 | 0 | 12 | 12 |
| Place of worship | 8 | 10 | 5 | 5 | 8 | 5 | 5 |
| Clinic or doctor | 0 | 5 | 0 | 5 | 5 | 0 | 30 |
| Government office | 5 | 10 | 0 | 25 | 0 | 0 | 0 |

A convenience store scores zero for a minimarket because it is a competitor
there, not support.

### Risk and Operability

```
Risk and Operability = clamp(100 − penalties, 0, 100)
```

This formula is used only when the site-condition lookup succeeds. If that
lookup fails, the engine uses the neutral value 50 and the API marks the
component `unavailable`. Missing risk data therefore neither rewards the
location with 100 nor punishes it with zero; the interface tells the user to
verify road access, parking, drainage, and flood history in the field.

| Condition | Penalty |
|-----------|--------:|
| Mapped river, canal or stream within 100 m | −20 |
| Mapped waterway more than 100 m and up to 300 m away | −10 |
| Industrial land use within 100 m | −15 |
| Cemetery within 150 m | −10 |
| Landfill or waste transfer station within 300 m | −20 |
| Quarry within 300 m | −15 |
| Military area within 300 m | −10 |
| Prison within 300 m | −10 |

The last five are capped at −30 together, so one awkward corner cannot empty the
component on its own. The map can say that such a neighbour is there; it cannot
say how much custom it costs. The penalty is therefore deliberately modest, and
the warning beside the score carries the real message.

These are proxies from OpenStreetMap, not authoritative risk data, and reports
must label them as such.

### Hard warnings the engine raises

| Warning | Rule |
|---------|------|
| `flood_risk_proxy` | A mapped waterway within 50 m |
| `unsuitable_surroundings` | A cemetery within 150 m, or a landfill, waste transfer station, quarry, military area or prison within 300 m. The warning names which were found |
| `stale_data` | More than half of the dated records within 1,500 m are older than 36 months |

Incompatible zoning and missing legal access have no data source yet. The
engine does not raise them; reports list them as field checks.

### Competitor similarity and scale

| Category | Direct (1.00) | Close substitute (0.60) | Indirect substitute (0.30) |
|----------|---------------|-------------------------|----------------------------|
| Beverages | Café or coffee shop | Bubble tea or tea outlet | Food court; restaurant or fast food tagged as serving coffee |
| Food | Restaurant, fast food, food court | — | Café |
| Laundry | Laundry | Dry cleaning | — |
| Photocopy / stationery | Copy shop, printer, stationery shop | — | — |
| Minimarket | Convenience store | Supermarket | — |
| Salon | Hairdresser | Beauty salon | — |
| Pharmacy | Pharmacy | Chemist or drugstore | — |

Competitor Scale uses the Facility Scale factors: small 0.60, medium or unknown
1.00, large 1.40.

### Operating-hours overlap

The Operating-Hours Factor compares each competitor's weekly hours with the
business's own:

| Share of the business's hours the competitor is also open | Factor |
|------------------------------------------------------------|-------:|
| 75% or more | 1.00 |
| 40% to under 75% | 0.60 |
| More than 0%, under 40% | 0.30 |
| 0% — closed during the business's hours | 0.10 |
| Competitor hours unknown | 0.80 |

Until the operator sets their own hours, every competitor with known hours
counts as fully overlapping.

### Counted facilities

Some sources report how many facilities of a kind lie in each zone instead of
listing them; Google's Places Aggregate API is one (see
[data-sources.md](data-sources.md#google-maps-business-counts)). A count of *n*
enters every formula as *n* facilities of that kind with these factors:

| Factor | Value | Why |
|--------|-------|-----|
| Distance | The zone's outer edge: 300, 800 or 1,500 m | Distance Weight is the same everywhere in a zone. The edge also keeps each zone on the same side of a competitor radius as every facility in it |
| Access Factor | 1.00 | A count has no position to test for barriers |
| Data Quality | 0.65 | The "date unknown but record is reasonably complete" band: a count carries no dates, and it includes only operational places |
| Operating-Hours Factor | 0.80 | Hours unknown |
| Facility Scale | Large for the types that match large OpenStreetMap tags (university, hospital, mall, rail station); otherwise medium | Consistent with OpenStreetMap facilities |

A count passes through
[the crowding rule](#crowding-repeated-facilities-count-for-less) exactly as the
same number of mapped facilities would.

Every contribution is multiplied by *n*. A count of 3 in Zone B therefore
contributes exactly what three undated facilities with unknown hours inside Zone
B would, and the engine's tests assert this for all seven categories
(`test/counts.test.ts`). The raw competitor count, the evidence counts and Data
Freshness count each counted facility once.

### Crowding: repeated facilities count for less

Facilities of one kind sharing one zone count fully up to three. Past that, each
further facility adds less:

```
Effective count = n                             for n <= 3
                = 3 + 5 x ln(1 + (n - 3) / 5)   for n > 3
```

| Facilities of one kind in one zone | Counts as |
|---|---|
| 1 to 3 | 1 to 3 |
| 5 | 4.68 |
| 20 | 10.41 |
| 100 | 18.07 |
| 500 | 26.05 |

Every formula uses the effective count. Everything reported uses the real one:
the facility count, the zone counts, and the raw competitor count.

Without this rule the model breaks exactly where data is richest. Google counts
507 cafes within 1,500 m of Simpang Lima in Semarang. Counted one for one they
come to 130 competitor-equivalents and a saturation ratio of 23 — far past the
point where any location can be told from any other. Under the rule the same
place comes to 20 equivalents and a ratio of 4.1, which still reads as heavily
saturated but leaves the ordering between locations intact.

The rule is source-neutral: three mapped cafes and a count of three are treated
identically, so which source supplied the data cannot move a score by itself.

### Data Quality from OpenStreetMap metadata

| Evidence | Factor |
|----------|-------:|
| Lifecycle prefix (`disused:`, `was:`, `demolished:`) | 0.00 |
| Category doubtful | 0.40 |
| Survey date (`check_date`, `survey:date`) within 12 months | 1.00 |
| Survey date more than 12 and up to 24 months old | 0.85 |
| Survey date more than 24 months old | 0.40 |
| No survey date; last edit within 24 months | 0.65 |
| No survey date; last edit more than 24 months ago | 0.40 |
| No dates; the record has a name | 0.65 |
| No dates and no name | 0.40 |

Ages are measured against an `asOf` date given to the engine, so the same data
always produces the same score.

### Confidence Score inputs

| Input | How it is measured |
|-------|--------------------|
| Data Completeness (40%) | Share of six expected groups present within 1,500 m: education, workplaces, housing, transit, commerce, and a known road class |
| Data Freshness (25%) | Mean Data Quality of the open facilities within 1,500 m, each counted facility included once, × 100 |
| Cross-source Validation (20%) | Fixed at 50. Google counts add coverage, but a count cannot be matched against OpenStreetMap place by place, so nothing is compared yet |
| Area Coverage (15%) | Share of the three zones containing at least one usable facility |

Because Cross-source Validation is fixed at 50, confidence cannot exceed 90 in
model 0.1.0.

### Strengths, weaknesses and delivery

- **Strengths** are the up to three highest components scoring 60 or more;
  **weaknesses** are the up to three lowest scoring below 60.
- **Delivery** raises the Zone C weight from 0.25 to 0.35 for customer segments
  only — delivery extends reach to customers, not to competitors.

---

## Revision notes

Deviations from the original internal specification, recorded here so the
change is visible rather than silent:

- **Competition Opportunity curve.** The straight line `95 − 35 × ratio` from the
  source specification is replaced by an exponential decay with the same opening
  slope, because the line bottomed out at a saturation ratio of 2.7 and erased
  every difference between busy locations. See
  [Competition Opportunity score](#competition-opportunity-score).
- **Location Potential Score worked example.** The source specification stated a
  result of 75.25 for the laundry example. The correct sum is 75.30
  (`26.25 + 13.40 + 15.20 + 10.95 + 9.50`). Both round to 75, so the stated
  verdict was unaffected. The corrected figure is used here and in the tests.

---

## References

- Barrington-Leigh, C., & Millard-Ball, A. (2017). The world's user-generated
  road map is more than 80% complete. *PLOS ONE, 12*(8), e0180698.
  https://doi.org/10.1371/journal.pone.0180698
- Chen, Y., Yu, J., & Khan, S. (2010). Spatial sensitivity analysis of
  multi-criteria weights in GIS-based land suitability evaluation.
  *Environmental Modelling & Software, 25*(12), 1582–1591.
  https://doi.org/10.1016/j.envsoft.2010.06.001
- Guerra, E., Cervero, R., & Tischler, D. (2012). Half-mile circle: Does it best
  represent transit station catchments? *Transportation Research Record:
  Journal of the Transportation Research Board, 2276*(1), 101–109.
  https://doi.org/10.3141/2276-12
- Haklay, M. (2010). How good is volunteered geographical information? A
  comparative study of OpenStreetMap and Ordnance Survey datasets.
  *Environment and Planning B: Planning and Design, 37*(4), 682–703.
  https://doi.org/10.1068/b35097
- Hotelling, H. (1929). Stability in competition. *The Economic Journal,
  39*(153), 41–57. https://doi.org/10.2307/2224214
- Huff, D. L. (1964). Defining and estimating a trading area. *Journal of
  Marketing, 28*(3), 34–38. https://doi.org/10.1177/002224296402800307
- Malczewski, J. (1999). *GIS and multicriteria decision analysis*. John Wiley &
  Sons.
- Malczewski, J. (2006). GIS-based multicriteria decision analysis: A survey of
  the literature. *International Journal of Geographical Information Science,
  20*(7), 703–726. https://doi.org/10.1080/13658810600661508
- Nelson, R. L. (1958). *The selection of retail locations*. F. W. Dodge.
- Republik Indonesia. (2007). *Undang-Undang Nomor 26 Tahun 2007 tentang
  Penataan Ruang*. https://peraturan.go.id/id/uu-no-26-tahun-2007
- Senaratne, H., Mobasheri, A., Ali, A. L., Capineri, C., & Haklay, M. (2017). A
  review of volunteered geographic information quality assessment methods.
  *International Journal of Geographical Information Science, 31*(1), 139–167.
  https://doi.org/10.1080/13658816.2016.1189556
- van der Bles, A. M., van der Linden, S., Freeman, A. L. J., Mitchell, J.,
  Galvao, A. B., Zaval, L., & Spiegelhalter, D. J. (2019). Communicating
  uncertainty about facts, numbers and science. *Royal Society Open Science,
  6*(5), 181870. https://doi.org/10.1098/rsos.181870

Data: © OpenStreetMap contributors, licensed under ODbL 1.0 — see
[data-sources.md](data-sources.md).
