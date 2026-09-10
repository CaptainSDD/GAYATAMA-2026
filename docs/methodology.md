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

---

## System-wide rules

### Distance zones

The analysis area around a candidate point is divided into three zones. A
facility's influence decays with distance rather than cutting off abruptly.

| Zone | Distance | Weight |
|------|----------|--------|
| A | 0–300 m | 1.00 |
| B | 301–800 m | 0.60 |
| C | 801–1,500 m | 0.25 |

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
[data-sources.md](data-sources.md).

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
Competition Score = clamp(95 − 35 × Saturation Ratio + Validation Bonus, 0, 100)
```

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
| **Change opening hours** | Competitors whose hours do not overlap exert only 10–40% of their normal pressure, not 100% |
| **Add delivery / pickup** | For laundry and food, Zone C weight rises from 0.25 to 0.35. The resulting Location Score gain is **capped at 5 points** until transaction data exists to justify more |
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

## Revision notes

Deviations from the original internal specification, recorded here so the
change is visible rather than silent:

- **Location Potential Score worked example.** The source specification stated a
  result of 75.25 for the laundry example. The correct sum is 75.30
  (`26.25 + 13.40 + 15.20 + 10.95 + 9.50`). Both round to 75, so the stated
  verdict was unaffected. The corrected figure is used here and in the tests.
