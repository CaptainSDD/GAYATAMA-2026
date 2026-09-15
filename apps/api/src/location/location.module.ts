import { Module } from '@nestjs/common';
import { PoiModule } from '../poi/poi.module';
import { LocationController } from './location.controller';

@Module({
  imports: [PoiModule],
  controllers: [LocationController],
})
export class LocationModule {}
