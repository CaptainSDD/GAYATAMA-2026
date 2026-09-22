import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PoiModule } from '../poi/poi.module';
import { LocationController } from './location.controller';

import { LocationEligibilityService } from './location-eligibility';

@Module({
  imports: [PoiModule, AuthModule],
  controllers: [LocationController],
  providers: [LocationEligibilityService],
  exports: [LocationEligibilityService],
})
export class LocationModule {}
