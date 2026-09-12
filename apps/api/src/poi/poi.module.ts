import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Firestore } from 'firebase-admin/firestore';
import type { Env } from '../config/env';
import { FIRESTORE } from '../firebase/firebase.module';
import { DEFAULT_SNAPSHOT_DIR, OSM_SNAPSHOTS, OsmSnapshots } from '../osm-snapshots/osm-snapshots';
import { DEFAULT_OVERTURE_DIR, OVERTURE_PLACES, OverturePlaces } from '../overture/overture-places';
import { OverpassClient } from '../overpass/overpass.client';
import { FirestorePoiCache, InMemoryPoiCache, LayeredPoiCache, POI_CACHE } from './poi-cache';
import { PoiService } from './poi.service';

@Module({
  providers: [
    OverpassClient,
    PoiService,
    {
      provide: POI_CACHE,
      inject: [FIRESTORE],
      useFactory: (firestore: Firestore | null) =>
        new LayeredPoiCache(
          new InMemoryPoiCache(),
          firestore === null ? null : new FirestorePoiCache(firestore),
          new Logger('PoiCache'),
        ),
    },
    {
      provide: OSM_SNAPSHOTS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        OsmSnapshots.load(
          config.get('OSM_SNAPSHOT_DIR', { infer: true }) ?? DEFAULT_SNAPSHOT_DIR,
          new Logger('OsmSnapshots'),
        ),
    },
    {
      provide: OVERTURE_PLACES,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        OverturePlaces.load(
          config.get('OVERTURE_PLACES_DIR', { infer: true }) ?? DEFAULT_OVERTURE_DIR,
          new Logger('OverturePlaces'),
        ),
    },
  ],
  exports: [PoiService],
})
export class PoiModule {}
