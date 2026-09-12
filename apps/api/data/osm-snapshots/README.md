# OSM snapshots

OpenStreetMap data for the demo areas, prepared offline so the API can answer
for these areas without Overpass. Each `*.json.gz` file covers one circle; the
API uses a snapshot whenever a query's whole circle lies inside it, and Overpass
everywhere else.

Data © OpenStreetMap contributors, available under the Open Database License
(ODbL) 1.0. Extracted from [Geofabrik](https://download.geofabrik.de/) downloads.

The areas are listed in `apps/api/scripts/osm-areas.json`. To add an area or
refresh the data, follow "OSM snapshots" in
[docs/installation.md](../../../../docs/installation.md#osm-snapshots).
