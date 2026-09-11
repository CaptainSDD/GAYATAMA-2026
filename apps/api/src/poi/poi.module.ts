import { Logger, Module } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.module';
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
  ],
  exports: [PoiService],
})
export class PoiModule {}
