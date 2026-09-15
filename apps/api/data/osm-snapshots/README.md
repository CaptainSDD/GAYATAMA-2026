# OSM snapshots

OpenStreetMap data for the demo areas, prepared offline so the API can answer
for these areas without Overpass. Each `*.json.gz` file covers one circle; the
API uses a snapshot whenever a query's whole circle lies inside it, and Overpass
everywhere else.

The committed coverage currently includes Semarang/UPGRIS and Surabaya/UNESA
Ketintang. A snapshot contains both scoring POIs and site geometry used for
walkability and Access Factor derivation. Because access-barrier rules now query
up to 1.5 km, snapshots created before that rule was introduced remain readable
but may have incomplete barrier geometry.

Data © OpenStreetMap contributors, available under the Open Database License
(ODbL) 1.0. Extracted from [Geofabrik](https://download.geofabrik.de/) downloads.

The areas are listed in `apps/api/scripts/osm-areas.json`. To add an area or
refresh the data—especially after changing tag or access rules—re-run the
extraction and snapshot build described under "OSM snapshots" in
[docs/installation.md](../../../../docs/installation.md#osm-snapshots).
