"""Extract raw OpenStreetMap elements for GAYATAMA's snapshot areas from a .osm.pbf file.

Writes one JSON file per area in the format read by build-osm-snapshots.ts: every
element carrying a key the POI or site queries look at, whose position or geometry
reaches into the area's bounding box. This is deliberately a superset; the exact
tag and distance filtering happens in build-osm-snapshots.ts, which uses the API's
own tables so the two cannot drift apart.

    python osm_extract.py --pbf java-latest.osm.pbf --areas osm-areas.json \
        --out raw --index nodes.idx

Node locations are cached in a file (--index) rather than in memory, so a large
extract such as Java needs little RAM but a few GB of disk.
"""

import argparse
import gc
import json
import math
import os
import sys
import time

import osmium
import osmium.filter
import osmium.index

# Keys read by buildPoiQuery and buildSiteQuery (apps/api/src/overpass/queries.ts).
QUERY_KEYS = (
    'amenity', 'shop', 'tourism', 'office', 'highway', 'railway',
    'public_transport', 'craft', 'landuse', 'waterway', 'sidewalk',
    'bridge', 'tunnel', 'toll', 'ford',
)
# Only these building values are queried; filtering here skips millions of house footprints.
BUILDING_VALUES = frozenset(('office', 'apartments', 'dormitory'))
# Multipolygon relations are assembled only when they could be a facility.
AREA_KEYS = ('amenity', 'shop', 'tourism', 'office', 'building', 'railway', 'public_transport', 'craft', 'landuse')

METERS_PER_DEGREE = 6_371_008.8 * math.pi / 180


class Area:
    def __init__(self, spec):
        self.id = spec['id']
        self.name = spec['name']
        self.lat = float(spec['lat'])
        self.lng = float(spec['lng'])
        self.radius = float(spec['radiusMeters'])
        # 1% slack so rounding never drops an element at the edge of the box.
        dlat = self.radius / METERS_PER_DEGREE * 1.01
        dlng = self.radius / (METERS_PER_DEGREE * math.cos(math.radians(self.lat))) * 1.01
        self.min_lat, self.max_lat = self.lat - dlat, self.lat + dlat
        self.min_lng, self.max_lng = self.lng - dlng, self.lng + dlng
        self.elements = []

    def touches(self, min_lat, min_lng, max_lat, max_lng):
        return not (
            max_lat < self.min_lat or min_lat > self.max_lat
            or max_lng < self.min_lng or min_lng > self.max_lng
        )


def is_relevant(tags):
    for key, value in tags.items():
        if key in QUERY_KEYS or (key == 'building' and value in BUILDING_VALUES):
            return True
    return False


def timestamp_of(obj):
    ts = obj.timestamp
    if ts is None or ts.year < 2004:  # OSM began in 2004; earlier means "not set"
        return None
    return ts.strftime('%Y-%m-%dT%H:%M:%SZ')


def add(areas, element, coords, obj):
    lats = [c[0] for c in coords]
    lngs = [c[1] for c in coords]
    box = (min(lats), min(lngs), max(lats), max(lngs))
    targets = [area for area in areas if area.touches(*box)]
    if not targets:
        return 0
    if element['type'] != 'node':
        element['center'] = {'lat': (box[0] + box[2]) / 2, 'lon': (box[1] + box[3]) / 2}
    timestamp = timestamp_of(obj)
    if timestamp is not None:
        element['timestamp'] = timestamp
    for area in targets:
        area.elements.append(element)
    return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--pbf', required=True, help='OpenStreetMap extract (.osm.pbf), e.g. from download.geofabrik.de')
    parser.add_argument('--areas', required=True, help='JSON list of areas: id, name, lat, lng, radiusMeters')
    parser.add_argument('--out', required=True, help='directory for the raw area files')
    parser.add_argument('--index', required=True, help='file for the node location cache (deleted afterwards)')
    args = parser.parse_args()

    with open(args.areas, encoding='utf-8') as handle:
        areas = [Area(spec) for spec in json.load(handle)]

    header = osmium.FileProcessor(args.pbf).header
    data_timestamp = header.get('osmosis_replication_timestamp')
    if not data_timestamp:
        sys.exit(f'{args.pbf} has no osmosis_replication_timestamp header, so its data date is unknown')

    storage = osmium.index.create_map(f'sparse_file_array,{args.index}')
    processor = (
        osmium.FileProcessor(args.pbf)
        .with_locations(storage)
        .with_areas(osmium.filter.KeyFilter(*AREA_KEYS))
        .with_filter(osmium.filter.EmptyTagFilter())
    )

    started = time.monotonic()
    seen = kept = 0
    for obj in processor:
        seen += 1
        if seen % 2_000_000 == 0:
            print(f'  {seen:,} tagged objects read, {kept:,} kept, {time.monotonic() - started:.0f} s', flush=True)

        tags = {tag.k: tag.v for tag in obj.tags}
        if not is_relevant(tags):
            continue

        if obj.is_node():
            if not obj.location.valid():
                continue
            lat, lng = obj.location.lat, obj.location.lon
            element = {'type': 'node', 'id': obj.id, 'lat': lat, 'lon': lng, 'tags': tags}
            kept += add(areas, element, [(lat, lng)], obj)
        elif obj.is_way():
            coords = [(node.lat, node.lon) for node in obj.nodes if node.location.valid()]
            if not coords:
                continue
            element = {
                'type': 'way', 'id': obj.id, 'tags': tags,
                'geometry': [{'lat': lat, 'lon': lng} for lat, lng in coords],
            }
            kept += add(areas, element, coords, obj)
        elif obj.is_area():
            # Closed ways already arrived as ways; only relations are new here.
            if obj.from_way():
                continue
            coords = [(node.lat, node.lon) for ring in obj.outer_rings() for node in ring if node.location.valid()]
            if not coords:
                continue
            element = {'type': 'relation', 'id': obj.orig_id(), 'tags': tags}
            kept += add(areas, element, coords, obj)

    # Release the index before deleting it: Windows cannot delete a file that is still open.
    del processor
    del storage
    gc.collect()
    try:
        os.remove(args.index)
    except FileNotFoundError:
        pass
    except OSError as error:
        print(f'Could not delete the node location index {args.index} ({error}); delete it by hand.')

    os.makedirs(args.out, exist_ok=True)
    for area in areas:
        path = os.path.join(args.out, f'{area.id}.json')
        with open(path, 'w', encoding='utf-8') as handle:
            json.dump({
                'id': area.id,
                'name': area.name,
                'center': {'lat': area.lat, 'lng': area.lng},
                'radiusMeters': area.radius,
                'source': os.path.basename(args.pbf),
                'dataTimestamp': data_timestamp,
                'elements': area.elements,
            }, handle, ensure_ascii=False, separators=(',', ':'))
        print(f'{area.id}: {len(area.elements):,} candidate elements -> {path}')
    print(f'Done in {time.monotonic() - started:.0f} s ({seen:,} tagged objects read)')


if __name__ == '__main__':
    main()
