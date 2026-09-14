import { Logger, Module } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.module';
import {
  FirestorePlaceCountsCache,
  InMemoryPlaceCountsCache,
  LayeredPlaceCountsCache,
  PLACE_COUNTS_CACHE,
} from './place-counts-cache';
import { PlaceCountsService } from './place-counts.service';
import { PlacesAggregateClient } from './places-aggregate.client';

@Module({
  providers: [
    PlacesAggregateClient,
    PlaceCountsService,
    {
      provide: PLACE_COUNTS_CACHE,
      inject: [FIRESTORE],
      useFactory: (firestore: Firestore | null) =>
        new LayeredPlaceCountsCache(
          new InMemoryPlaceCountsCache(),
          firestore === null ? null : new FirestorePlaceCountsCache(firestore),
          new Logger('PlaceCountsCache'),
        ),
    },
  ],
  exports: [PlaceCountsService],
})
export class PlacesModule {}
