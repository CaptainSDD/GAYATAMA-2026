import { Module } from '@nestjs/common';
import { PoiModule } from '../poi/poi.module';
import { LocationController } from './location.controller';

import { LocationEligibilityService } from './location-eligibility';

@Module({
  imports: [PoiModule],
  controllers: [LocationController],
  providers: [LocationEligibilityService],
  exports: [LocationEligibilityService],
})
export class LocationModule {}
