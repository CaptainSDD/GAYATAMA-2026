# Data Sources, Provenance & Attribution

## Primary source: OpenStreetMap

All facility and business data comes from [OpenStreetMap](https://www.openstreetmap.org/),
queried through the [Overpass API](https://overpass-api.de/).

### Licence and attribution

OpenStreetMap data is **© OpenStreetMap contributors**, licensed under the
[Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/).

The licence obliges us to attribute, and to keep derived databases open under
the same terms. GAYATAMA complies as follows:

- Attribution appears on every map view (the Leaflet attribution control) and in
  the footer of every exported PDF report.
- Reports state the query timestamp, so a reader knows which snapshot of the map
  the conclusions rest on.
- GAYATAMA stores a **cache** of query results, not a modified derived database.
  Scores are computed values *about* OSM data, not edits to it.

Map tiles are served by the OpenStreetMap Foundation's public tile servers under
their [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
Traffic is kept within acceptable limits by the caching described in
[architecture.md](architecture.md); a production deployment at scale would move
to a dedicated tile provider.

### Why open data rather than a commercial POI provider

This was a deliberate trade, and it cost us something real.

Commercial providers (Google Places, Foursquare, and similar) offer denser
coverage, verified opening hours, and an explicit `business_status` field that
tells you when a business has closed. OpenStreetMap offers none of that
reliably.

We chose OSM anyway, for four reasons:

1. **No key to leak.** This repository is public for judging. A commercial API
   key either sits in the repo or the demo does not run.
2. **No quota to exhaust.** A judge opening the demo after the free tier is
   spent would see a broken product. Overpass rate-limits, but it does not bill
   and it does not cut off.
3. **Attribution is possible.** ODbL permits exactly what GAYATAMA does.
   Commercial POI terms generally forbid deriving and displaying analytics of
   this kind.
4. **It matches the mission.** A tool whose purpose is to give micro-enterprises
   access to analysis they could not otherwise afford should not itself depend
   on a paid data subscription. Under SDG 8.3, a free tool built on paid data is
   a tool that stops working the moment funding does.

The cost is coverage variance, and GAYATAMA models that cost explicitly rather
than hiding it — see [Coverage and confidence](#coverage-and-confidence).

---

## Tag mapping

### Facilities → target market segments

| Facility | OSM tags |
|----------|----------|
| University campus | `amenity=university`, `amenity=college` |
| School | `amenity=school` |
| Office | `office=*`, `building=office` |
| Housing cluster | `landuse=residential`, `building=apartments`, `building=residential` |
| Boarding house / dormitory | `building=dormitory`, `tourism=guest_house`, `tourism=hostel` |
| Transit stop | `highway=bus_stop`, `amenity=bus_station`, `railway=station`, `public_transport=station` |
| Hospital | `amenity=hospital` |
| Shopping mall | `shop=mall`, `shop=department_store` |

> **Known weakness.** Indonesian *kos* (boarding houses) have no dedicated OSM
> tag and are inconsistently mapped — often as `tourism=guest_house`, sometimes
> as plain `building=residential`, frequently not at all. Since Resident and
> Student scores both depend on them, this is the single largest source of
> systematic error in the model. It reduces Data Completeness, and therefore the
> Confidence Score, in residential areas.

### Businesses → competitor categories

| Category | OSM tags |
|----------|----------|
| Beverages / coffee | `amenity=cafe`, `cuisine=coffee_shop`, `cuisine=bubble_tea` |
| Food | `amenity=restaurant`, `amenity=fast_food`, `amenity=food_court` |
| Laundry | `shop=laundry`, `shop=dry_cleaning` |
| Photocopy / stationery | `shop=copyshop`, `shop=stationery`, `craft=printer` |
| Minimarket | `shop=convenience`, `shop=supermarket` |
| Salon / barbershop | `shop=hairdresser`, `shop=beauty` |
| Pharmacy | `amenity=pharmacy`, `shop=chemist` |

How closely each one competes — direct, close or indirect substitute — is in
[methodology.md](methodology.md#competitor-similarity-and-scale). A restaurant
or fast-food outlet tagged `drink:coffee=yes` counts as an indirect substitute
for a coffee shop. `shop=beverages` is deliberately not used: in OpenStreetMap it
is a shop selling packaged drinks, not a café.

### Supporting facilities

| Facility | OSM tags |
|----------|----------|
| ATM | `amenity=atm` |
| Bank | `amenity=bank` |
| Traditional market (*pasar*) | `amenity=marketplace` |
| Place of worship | `amenity=place_of_worship` |
| Clinic or doctor | `amenity=clinic`, `amenity=doctors` |
| Government office | `office=government`, `amenity=townhall` |

Supporting facilities feed Supporting Facility Fit — see
[methodology.md](methodology.md#supporting-facility-fit).

### Accessibility

| Signal | OSM tags |
|--------|----------|
| Road class | `highway=primary` / `secondary` / `tertiary` / `residential` |
| Road capacity | `lanes`, `width` |
| Walkability | `sidewalk=*`, `highway=footway`, `highway=crossing` |
| Parking | `amenity=parking` with `capacity` |
| Severance | `highway=motorway`/`trunk`, `railway=rail`, `waterway=river` — feeds the Access Factor |

---

## Deriving the Data Quality factor

The [Data Quality factor](methodology.md#data-quality) needs a per-record
freshness signal. OSM provides two, used in order of preference:

**1. Explicit survey tags — most reliable.**
`check_date`, `survey:date`, or `check_date:opening_hours` record when a human
last verified the feature on the ground. Where present, the age of this date
maps directly onto the Data Quality bands.

**2. Element edit metadata — the fallback.**
Overpass returns each element's last-edit timestamp and version when queried
with `out meta;`. This is weaker evidence — an edit may have been a typo fix
rather than a re-survey — so records relying on it are capped at the
"date unknown but reasonably complete" band (0.65) rather than being promoted to
1.00.

**Permanent closure.** OSM has no `business_status` field. Closed businesses are
marked by lifecycle prefixes — `disused:shop=*`, `was:amenity=*`, `demolished:*`.
These are matched and assigned a Data Quality factor of 0.00, removing them from
competitor counts. Businesses that closed without anyone updating the map remain
counted, and this is an acknowledged source of over-estimated competition.

---

## Coverage and confidence

OSM coverage varies enormously — dense in central Surabaya, Jakarta, Bandung and
Yogyakarta; thin in smaller towns and rural areas.

GAYATAMA does not pretend otherwise. Coverage variance flows into the
[Confidence Score](methodology.md#confidence-score-and-warnings) through two of
its four terms:

- **Data Completeness (40%)** — how many expected facility types returned any
  result at all. A 1,500 m radius with no residential land use mapped is a
  completeness failure, not an empty neighbourhood.
- **Area Coverage (15%)** — the proportion of the analysis zones for which any
  data exists.

The result is that a poorly-mapped area produces a **wide interval and a
visible warning**, not a confidently wrong number. This is the difference
between a system that degrades honestly and one that fails silently.

---

## Data GAYATAMA does not have

Stated so that no one assumes otherwise:

| Missing | Consequence | Status |
|---------|-------------|--------|
| **Population demographics** | Segment scores are relative strength indicators, never headcounts. The engine has no field capable of returning a population figure | By design — see [methodology](methodology.md#the-constraint-that-makes-this-honest) |
| **Flood risk** | The Risk component currently uses proxy signals only (`waterway` proximity). OpenStreetMap has no general elevation data. Indonesia's authoritative source is [InaRISK (BNPB)](https://inarisk.bnpb.go.id/) | [Roadmap](roadmap.md) |
| **Zoning / RTRW** | Not in OSM. `landuse=*` is a weak proxy and is labelled as such in reports | [Roadmap](roadmap.md) |
| **Foot traffic** | No open source exists. This is what commercial providers actually sell | Out of scope |
| **Rent prices** | Not modelled; explicitly excluded from the score | Out of scope — see [methodology](methodology.md#what-if-simulation) |
| **Verified opening hours** | OSM `opening_hours` is sparse. When a competitor's hours are absent, its Operating-Hours Factor is 0.80 | Partial |

---

## Third-party software

All runtime dependencies are permissively licensed (MIT, Apache-2.0, or BSD).
The full resolved tree is in `package-lock.json`.

| Component | Licence |
|-----------|---------|
| React, Vite, NestJS, Zod, TanStack Query | MIT |
| Leaflet | BSD-2-Clause |
| firebase / firebase-admin | Apache-2.0 |
| GAYATAMA itself | Apache-2.0 |
