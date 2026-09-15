# Overture place files

Photocopy, printing and stationery shops from [Overture Maps](https://overturemaps.org/)
Places, one file per area in `apps/api/scripts/overture-areas.json`, built by
`apps/api/scripts/build-overture-places.ts` — see
[installation.md](../../../../docs/installation.md#overture-places).

The committed demo coverage currently includes Semarang/UPGRIS and
Surabaya/UNESA Ketintang. These files supplement categories that are commonly
under-mapped in OSM; they do not replace OSM site or access-barrier geometry.

After changing `overture-areas.json` or the category mapping, regenerate them
from the repository root with
`npm run overture:places -w @gayatama/api -- <raw-directory>`.

Data: Overture Maps Foundation, overturemaps.org. A place is included only when
every one of its sources is available under the Community Data License Agreement
– Permissive 2.0 (data from Meta, Microsoft and others) or CC0 1.0 (data from
AllThePlaces). As CDLA Permissive 2.0 requires of shared data, its text is in
[`CDLA-Permissive-2.0.txt`](CDLA-Permissive-2.0.txt).
