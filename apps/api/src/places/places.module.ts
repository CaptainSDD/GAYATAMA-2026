import { Module } from '@nestjs/common';
import { PlaceCountsService } from './place-counts.service';
import { PlacesAggregateClient } from './places-aggregate.client';

@Module({
  providers: [PlacesAggregateClient, PlaceCountsService],
  exports: [PlaceCountsService],
})
export class PlacesModule {}
