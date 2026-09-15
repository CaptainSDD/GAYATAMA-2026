# Data Sources, Provenance & Attribution

| Source | Supplies | When |
|--------|----------|------|
| [OpenStreetMap](https://www.openstreetmap.org/) | Facilities, and conditions at the site itself: roads, footways, waterways, land use | Always |
| [Overture Maps](https://overturemaps.org/) Places | Photocopy, printing and stationery shops that OpenStreetMap lacks | Only in the areas prepared offline, listed in `apps/api/scripts/overture-areas.json` |
| Google Maps ([Places Aggregate API](https://developers.google.com/maps/documentation/places-aggregate/overview)) | How many businesses and facilities of each kind lie in each distance zone, for the kinds in [Google Maps business counts](#google-maps-business-counts) | Only when the web app draws a Google map and the API has a Google server key. Otherwise OpenStreetMap supplies those kinds too |

## Primary source: OpenStreetMap

OpenStreetMap data reaches the API by one of two routes:

- **Live**, queried through the [Overpass API](https://overpass-api.de/), falling
  back to other public Overpass instances when the main one is unavailable.
- **From a snapshot**, for the demo areas listed in
  `apps/api/scripts/osm-areas.json`. Snapshots are extracted offline from a
  [Geofabrik](https://download.geofabrik.de/) download, so those areas keep
  working when every Overpass instance is down.

Every response says which route it used (`dataSource.via`); for a snapshot,
`fetchedAt` is the date of its data. Both routes carry the same OpenStreetMap
data, including each element's last-edit timestamp — Geofabrik's public
extracts omit only user names, user IDs and changeset IDs — so a record is dated
identically either way.

### Licence and attribution

OpenStreetMap data is **© OpenStreetMap contributors**, licensed under the
[Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/).

The licence obliges us to attribute, and to keep derived databases open under
the same terms. GAYATAMA complies as follows:

- Attribution appears under every result, together with the date of the data,
  and on the OpenStreetMap map (the Leaflet attribution control).
- The POI cache and the snapshots are filtered, normalised extracts of
  OpenStreetMap — derivative databases in ODbL terms. The snapshots are
  published in this repository under ODbL 1.0, and the code that derives both is
  open source. That is what ODbL section 4.6 asks of a derivative database that
  is used publicly.

Without a Google key, map tiles are served by the OpenStreetMap Foundation's
public tile servers under their
[Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
The POI cache does not reduce tile traffic; a production deployment at scale
would move to a dedicated tile provider.

### Why OpenStreetMap stays the base

Commercial providers cover small businesses far more densely, and in Indonesian
neighbourhoods the gap is large: near Universitas PGRI Semarang, OpenStreetMap
had no café mapped, while Overture Maps listed nine. GAYATAMA therefore adds
Google business counts where their terms allow it, but it is built never to
depend on them:

1. **No key in the repository.** This repository is public for judging. Keys
   live only in `.env` or the deployment's secret store, and without them the
   app runs entirely on OpenStreetMap.
2. **No outage when a quota runs out.** If Google fails or its quota is spent,
   the API uses OpenStreetMap for every kind and the interface says so.
   Overpass rate-limits but does not bill; it can be unavailable altogether,
   which is why the demo areas are served from snapshots.
3. **Only data whose terms permit this use.** ODbL permits exactly what
   GAYATAMA does. Of Google's place data, the Places Aggregate API's counts may
   feed derived metrics such as these scores; place details from the Places API
   may not be used with a non-Google map or stored, so GAYATAMA does not use
   them — see [Terms that shape the design](#terms-that-shape-the-design).
4. **It matches the mission.** A tool meant to give micro-enterprises analysis
   they could not otherwise afford should keep working without a paid
   subscription. Under SDG 8.3, a free tool built only on paid data stops
   working the moment funding does.

What OpenStreetMap lacks in coverage, GAYATAMA models explicitly rather than
hiding — see [Coverage and confidence](#coverage-and-confidence).

---

## Google Maps business counts

When the web app draws a Google map, it sets `googleMap` on its requests, and
the API asks the Places Aggregate API how many operational places of each kind
lie around the location. The API returns counts only: no names, positions,
opening hours or ratings. The code is in `apps/api/src/places/`.

### How counts become facilities

1. The location snaps to the centre of its geohash-8 cell (about 38 × 19 m), so
   the circles sit within about 22 m of the chosen point and nearby clicks share
   one set of counts.
2. Each kind is counted within 1,500 m, 800 m and 300 m. Zone C is the 1,500 m
   count minus the 800 m count, Zone B the 800 m count minus the 300 m count,
   and Zone A the 300 m count. A smaller circle is not requested when a larger
   one is empty, so a new location takes 25 to 75 requests.
3. A zone's count enters the engine as that many facilities at the zone's outer
   edge, undated (Data Quality 0.65) and with unknown opening hours — see
   [methodology.md](methodology.md#counted-facilities). Facilities of one kind
   sharing a zone then count with
   [diminishing returns](methodology.md#crowding-repeated-facilities-count-for-less),
   as mapped ones do.
4. Google counts replace OpenStreetMap facilities of the same kinds; every other
   kind still comes from OpenStreetMap. If any count request fails, no count is
   used: every kind comes from OpenStreetMap, and `dataSource.places.status` is
   `unavailable`.

### Type mapping

Filters accept only the types in Table A of Google's
[place types](https://developers.google.com/maps/documentation/places/web-service/place-types).
A type excluded from one kind is counted by another, so a place carrying both is
counted once.

| Kind | Google types | Excluded types |
|------|--------------|----------------|
| Café or coffee shop | `cafe`, `coffee_shop`, `coffee_stand` | |
| Bubble tea or tea outlet | `tea_house`, `juice_shop` | `cafe`, `coffee_shop`, `coffee_stand` |
| Restaurant | `restaurant` | `cafe`, `coffee_shop`, `fast_food_restaurant`, `food_court` |
| Fast food | `fast_food_restaurant` | `food_court` |
| Food court | `food_court` | |
| Laundry | `laundry` | |
| Convenience store | `convenience_store`, `grocery_store` | `supermarket` |
| Supermarket | `supermarket` | |
| Hairdresser | `hair_salon`, `barber_shop` | |
| Beauty salon | `beauty_salon`, `nail_salon` | `hair_salon`, `barber_shop` |
| Pharmacy | `pharmacy` | |
| Chemist or drugstore | `drugstore` | `pharmacy` |

Google has no bubble tea type; tea houses and juice shops stand in for it.

Everything else comes from OpenStreetMap:

- **What drives demand** — campuses, schools, offices, government offices,
  housing, boarding houses, transit stops, hospitals and malls. OpenStreetMap
  maps these large features well, and the segment points were calibrated against
  that data. Counting them from Google as well pinned all six segments to 100
  everywhere in an Indonesian city, so two locations 3 km apart scored the same:
  see [methodology.md](methodology.md#crowding-repeated-facilities-count-for-less).
- **Supporting facilities** — ATMs, banks, markets, places of worship and
  clinics, which OpenStreetMap records well enough for the purpose.
- **Copy shops, printers, stationery shops and dry cleaners**, which have no
  Table A type at all.
- **Parking**, whose `capacity` tag a count cannot carry.

### Cost and caching

A new location takes 12 to 36 requests. Google's free usage covers 5,000
requests a month — at least 138 new locations — and each further 1,000 costs
USD 10 (pricing checked in September 2026). Counts are cached in memory per
geohash-8 cell for `PLACE_COUNT_CACHE_TTL_SECONDS` (7 days by default, 30 at
most), so repeated clicks cost nothing. They are never written to Firestore. To
cap spending, set a daily quota — see
[installation.md](installation.md#google-maps-platform-optional).

### Terms that shape the design

| Rule | Source | What GAYATAMA does |
|------|--------|--------------------|
| Google Maps Core Services may not be used with or near a non-Google map | [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms), 3.2.3(e) | The API uses Google counts only for requests with `googleMap: true`. The web app sets it only when it draws a Google map; without a browser key it draws an OpenStreetMap map and never asks for them |
| Place counts may be used to create derived metrics that cannot substitute for the counts or be reverse-engineered into them | [Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), 13.1 | Counts feed the segment, competition, supporting-facility and confidence scores |
| Place counts may be cached for at most 30 days, solely to calculate those metrics | Service Specific Terms, 13.2 | The cache lifetime cannot be set above 30 days, and counts are kept in memory only |
| Counts may not be used to make decisions about individuals' housing, employment, credit or insurance | Service Specific Terms, 13.3 | GAYATAMA scores locations for businesses, not people |
| "Google Maps" attribution wherever counts are shown or feed a result | [Places Aggregate API policies](https://developers.google.com/maps/documentation/places-aggregate/policies) | Every result that uses counts says "Business counts: Google Maps"; the map shows Google's own logo |

> **To confirm before production.** The interface also shows some counts
> directly — "3 × Café" among the strongest competitors, and per-kind evidence
> for each customer group. The attribution policy anticipates counts shown as a
> standalone metric, but whether showing a count *from the cache* fits 13.2's
> "solely to calculate" is our reading, not settled. Check it with Google before
> a commercial launch.

The Places API (New and Legacy), which returns names and positions, is not used:
its terms forbid storing business names, using its coordinates for spatial
analysis such as point-in-polygon tests, and using it with a non-Google map.

---

## Overture Maps places

Photocopy, printing and stationery shops are where OpenStreetMap is thinnest,
and Google has no place type for them. For the areas in
`apps/api/scripts/overture-areas.json`, GAYATAMA adds them from
[Overture Maps](https://overturemaps.org/) Places, which merges business
listings from Meta, Microsoft and other providers. Release 2026-08-19.0 gives 72
such shops within 3 km of UNESA Ketintang, and 84 within 3 km of Universitas
PGRI Semarang. Outside these areas, the shops come from OpenStreetMap alone.

### From listing to facility

1. `overture_extract.py` reads each area's places from Overture's public
   release with DuckDB, and `build-overture-places.ts` writes the shops to
   `apps/api/data/overture-places/<area>.json.gz`.
2. Overture's categories are unreliable for these shops in Indonesia: most
   photocopy shops are filed under printing services, and office-equipment
   listings include safe and furniture dealers. A clear name decides first,
   then the category:

   | Kind | Rule |
   |------|------|
   | Copy shop | The name contains *fotocopy*, *fotokopi*, *photo copy* or *copy* — or *FC*, on a printing business |
   | Stationery shop | The name contains *ATK*, *alat tulis* or *stationery* |
   | Printer | The primary category is `printing_services`; or the name contains *percetakan*, *digital print* or *offset*; or `printing_services` is an alternate category and the name contains a printing word. Specialist printers are excluded by name: invitations (*undangan*), stickers, labels, banners (*spanduk*, *baliho*), signage (*reklame*, *neon box*), garments (*sablon*, *konveksi*, *kaos*), calendars and souvenirs |

   A name never overrides a café, restaurant, bar, hotel or school category.
   T-shirt printers and bookshops are not included. The rules, and test cases
   taken from real listings, are in `apps/api/src/overture/overture-place.ts`
   and `apps/api/test/overture-place.spec.ts`.
3. A place with an Overture confidence below 0.2 is left out, because it may
   not exist. One below 0.5 is kept with the "category doubtful" Data Quality of
   0.40. Permanently closed places are left out.
4. A place is dated by the latest update among its sources, which counts like an
   OpenStreetMap edit date: Data Quality 0.65 at best — see
   [Deriving the Data Quality factor](#deriving-the-data-quality-factor).
5. Records within 10 m of each other, or with the same name within 150 m, are
   one shop, and the more confident record is kept. When a request is scored, an
   Overture shop within 25 m of an open OpenStreetMap copy shop, printer or
   stationery shop — or with its name within 150 m — is left out, so the
   OpenStreetMap record is used.

These thresholds are proposed baselines, like those in
[methodology.md](methodology.md#proposed-in-model-010).

> **Known over-count.** `printing_services` covers more than photocopy shops.
> Specialist printers are excluded only when their name says what they print;
> an offset or label printer with a plain business name still counts as a
> competitor, as it would under OpenStreetMap's `craft=printer`. Where such
> businesses cluster, competition for a photocopy shop is overstated.

### Licence and attribution

Overture Places combines sources under different licences. GAYATAMA keeps a
place only when every one of its sources is available under the
[Community Data License Agreement – Permissive 2.0](https://cdla.dev/permissive-2-0/)
(Meta, Microsoft, PinMeTo and others) or CC0 1.0 (AllThePlaces). Places drawing
on Foursquare are left out: its Apache 2.0 licence would also require
distributing its NOTICE file.

- The published files are accompanied by the CDLA text, as that licence requires
  of shared data.
- Every result that uses Overture shops credits "Overture Maps Foundation",
  following [Overture's attribution guidance](https://docs.overturemaps.org/attribution/),
  and `dataSource.overture` names the release.

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
| Severance | `highway=primary`/`trunk`/`motorway`, `toll=yes`, `railway=rail`, `waterway=river`/`canal` — feeds the Access Factor when the mapped geometry intersects the direct line to a facility |
| Barrier passages | `highway=crossing`, `railway=level_crossing`, `highway=ford`, plus mapped highway bridges and tunnels — cancel a matching barrier penalty when close to the intersection |
| Discouraging neighbours | `landuse=cemetery`/`landfill`/`quarry`/`military`, `amenity=grave_yard`/`waste_transfer_station`/`prison` — feeds Risk and Operability |

The Access Factor is a straight-line OSM proxy, not a route calculation. It is
applied only to individually mapped facilities because aggregate zone counts
have no coordinates. Existing offline snapshots must be rebuilt after access
rules change so they contain the same barrier and passage geometries as a live
Overpass query.

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

Google counts fill in the business kinds OpenStreetMap maps most thinly in
Indonesian neighbourhoods. They leave Cross-source Validation at its neutral 50:
a count cannot be matched against OpenStreetMap place by place.

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
| **Verified opening hours** | OSM `opening_hours` is sparse, and Google counts carry no hours. When a competitor's hours are unknown, its Operating-Hours Factor is 0.80 | Partial |

---

## Third-party software

All runtime dependencies are permissively licensed (MIT, Apache-2.0, or BSD).
The full resolved tree is in `package-lock.json`.

| Component | Licence |
|-----------|---------|
| React, Vite, NestJS, Zod, TanStack Query | MIT |
| Leaflet | BSD-2-Clause |
| @vis.gl/react-google-maps | MIT |
| firebase / firebase-admin | Apache-2.0 |
| GAYATAMA itself | Apache-2.0 |

The Maps JavaScript API and the Places Aggregate API are services used under the
Google Maps Platform Terms of Service, not bundled software. The offline data
scripts use pyosmium (BSD-2-Clause) and DuckDB (MIT); neither ships with the app.
