"""Extract Overture Maps places for GAYATAMA's Overture areas.

Writes one JSON file per area in the format read by build-overture-places.ts:
every place whose bounding box lies inside the area's bounding box. Like
osm_extract.py this is deliberately a superset; which places become photocopy,
printing or stationery shops is decided in build-overture-places.ts, with the
API's own rules, so the two cannot drift apart.

    python overture_extract.py --areas overture-areas.json --out raw-overture

Needs duckdb (pip install duckdb). Reads the public Overture release on Amazon
S3; no account is required.
"""

import argparse
import json
import math
import os
import time

import duckdb

DEFAULT_RELEASE = '2026-08-19.0'
PLACES = 's3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*'
METERS_PER_DEGREE = 6_371_008.8 * math.pi / 180


def bounding_box(area):
    lat, lng, radius = float(area['lat']), float(area['lng']), float(area['radiusMeters'])
    # 1% slack so rounding never drops a place at the edge of the box.
    dlat = radius / METERS_PER_DEGREE * 1.01
    dlng = radius / (METERS_PER_DEGREE * math.cos(math.radians(lat))) * 1.01
    return lat - dlat, lng - dlng, lat + dlat, lng + dlng


def extract(connection, release, area):
    south, west, north, east = bounding_box(area)
    rows = connection.execute(f"""
        SELECT id,
               names.primary AS name,
               categories.primary AS category,
               categories.alternate AS alternate_categories,
               basic_category,
               confidence,
               operating_status,
               list_transform(sources, s -> {{'dataset': s.dataset, 'license': s.license, 'update_time': s.update_time}}) AS sources,
               (bbox.ymin + bbox.ymax) / 2 AS lat,
               (bbox.xmin + bbox.xmax) / 2 AS lng
        FROM read_parquet('{PLACES.format(release=release)}', hive_partitioning = 1)
        WHERE bbox.xmin >= {west} AND bbox.xmax <= {east} AND bbox.ymin >= {south} AND bbox.ymax <= {north}
    """).fetchall()
    return [
        {
            'id': place_id,
            'name': name,
            'category': category,
            'alternateCategories': alternate,
            'basicCategory': basic,
            'confidence': confidence,
            'operatingStatus': status,
            'sources': [
                {'dataset': s['dataset'], 'license': s['license'], 'updateTime': s['update_time']}
                for s in (sources or [])
            ],
            'lat': lat,
            'lng': lng,
        }
        for place_id, name, category, alternate, basic, confidence, status, sources, lat, lng in rows
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--areas', required=True, help='overture-areas.json')
    parser.add_argument('--out', required=True, help='directory for the raw area files')
    parser.add_argument('--release', default=DEFAULT_RELEASE, help=f'Overture release (default {DEFAULT_RELEASE})')
    args = parser.parse_args()

    with open(args.areas, encoding='utf-8') as file:
        areas = json.load(file)
    os.makedirs(args.out, exist_ok=True)

    connection = duckdb.connect()
    connection.execute("INSTALL httpfs; LOAD httpfs; SET s3_region = 'us-west-2';")
    for area in areas:
        started = time.time()
        places = extract(connection, args.release, area)
        target = os.path.join(args.out, f"{area['id']}.json")
        with open(target, 'w', encoding='utf-8') as file:
            json.dump(
                {
                    'id': area['id'],
                    'name': area['name'],
                    'center': {'lat': float(area['lat']), 'lng': float(area['lng'])},
                    'radiusMeters': float(area['radiusMeters']),
                    'release': args.release,
                    'places': places,
                },
                file,
                ensure_ascii=False,
            )
        print(f"{area['id']}: {len(places)} places in {time.time() - started:.0f} s -> {target}")


if __name__ == '__main__':
    main()
