# Scope & Roadmap

This document records what is in the submission, what was deliberately left out,
and why. Being explicit about the boundary is more useful than a feature list
that quietly implies everything works.

---

## In scope for this submission

| Feature | Status |
|---------|--------|
| Location Potential Score — all five components | Core |
| Business Type Recommendation — all seven categories ranked | Core |
| Competitor Analysis — equivalent count and saturation | Core |
| Target Market Insight — six segments with facility evidence | Core |
| Consolidated report with PDF export | Core |
| Confidence Score and uncertainty intervals | Core |
| What-if simulation — parking and opening hours | Core |
| Map picker with 300 / 800 / 1,500 m zone rings | Core |

---

## Deliberately deferred

Each of these was specified in the internal design and cut on purpose. Shipping
five features that work beats nine that half-work — and a demo that fails in
front of judges costs more than an absent feature honestly labelled.

### Street-network distance routing

**Specified:** distances measured along the road and pedestrian network.
**Shipped:** haversine straight-line distance.

The original specification already names straight-line distance as an
acceptable fallback, so this is a documented simplification rather than a
deviation. Network routing needs a routing engine (OSRM or Valhalla) with
regional graph data — a substantial infrastructure dependency whose benefit is
concentrated in areas with severe severance, where the Access Factor already
captures much of the same effect.

**Impact:** distances are slightly optimistic in areas cut by rivers, rail, or
limited-access roads. Zone assignment is unaffected for the large majority of
facilities.

### Access Factor from mapped severance

**Specified:** 1.00 / 0.65 / 0.40 depending on barriers between the location and
the facility.
**Shipped:** the factor is fully implemented in the engine and applied
throughout, but the detector that assigns it defaults to 1.00.

The parameter is live and tested; only its automatic derivation from OSM
barrier geometry is deferred. Enabling it later is a detector change, not a
scoring change.

### Flood risk from authoritative data

The Risk and Operability component currently uses proxy signals — proximity to
mapped waterways and industrial land use. Indonesia's authoritative source is
[InaRISK (BNPB)](https://inarisk.bnpb.go.id/), which requires a separate
integration.

Reports label the Risk component as proxy-based, and the flood hard-warning
remains conservative. See [data-sources.md](data-sources.md#data-gayatama-does-not-have).

### Zoning / RTRW compatibility

Zoning is not in OpenStreetMap, and Indonesian RTRW data is published
per-regency in inconsistent formats. `landuse=*` is used as a weak proxy and is
labelled as such. The zoning hard-warning fires only on clear conflicts.

### Deferred what-if parameters

Delivery / pickup and rent adjustment are specified in
[methodology.md](methodology.md#what-if-simulation) but not exposed in the MVP
interface. The delivery model's Zone C reweighting is implemented and tested in
the engine; only its control is hidden. Rent belongs to a financial feasibility
module that does not exist yet.

### User accounts, saved projects, team sharing

**Revised.** This was originally cut deliberately — reports were shareable by
ID without authentication, and accounts seemed like a full auth surface for
no demonstrable gain. That decision has since been reversed: login and
sign-up now exist (Firebase Authentication, email/password), with usernames
enforced unique via a Firestore reservation document. Email verification
uses Firebase's own built-in email, not a third-party sender — nothing to
configure, nothing extra to run. Saved projects and team sharing (multiple
people on one account) are still not built.

---

## After the submission

Ordered by expected value, not by ease.

### 1. Calibration against real outcomes

The most valuable thing that could happen to GAYATAMA, and the largest current
weakness. Every weight in [methodology.md](methodology.md) is documented
judgement, not a fitted parameter. With a dataset of businesses, locations, and
survival outcomes, the component weights and `T` values become estimable rather
than asserted, and the Confidence Score gains an empirical basis.

Until then the honest description is: an explicit, auditable model whose
parameters are argued for and open to challenge — which is still a considerable
improvement over intuition, and is why every constant is isolated in a single
file.

### 2. Boarding house (kos) data quality

The largest identified systematic error. *Kos* have no dedicated OSM tag and
are under-mapped, while both Resident and Student scores depend on them. Options
include a contribution workflow that feeds corrections back to OSM — which would
improve the commons for everyone, not just GAYATAMA.

### 3. Street-network routing

Item one from the deferred list, once infrastructure allows.

### 4. Multi-location comparison

Score several candidate sites side by side. A natural extension once reports
persist, and closer to how the decision is actually made — the real question is
rarely "is this spot good?" but "which of these three is best?".

### 5. Area opportunity mapping

Inverting the query: instead of scoring a point the user picks, highlight
underserved areas across a district. This is where the SDG 11.3 case becomes
concrete, since the same computation serves local economic planning.

### 6. Additional business categories

The seven MVP categories cover common micro-enterprise types. Extension is a
data-entry task in `constants.ts` — the engine is category-agnostic by design.

### 7. Indonesian and English interface localisation

The interface targets Indonesian micro-entrepreneurs; the documentation and
competition presentation are in English. Both audiences are real and the
codebase should serve both.
