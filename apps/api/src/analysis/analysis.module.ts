import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlacesModule } from '../places/places.module';
import { PoiModule } from '../poi/poi.module';
import { LocationModule } from '../location/location.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { NarrativeService } from './narrative.service';

@Module({
  imports: [PoiModule, PlacesModule, LocationModule, AuthModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, NarrativeService],
})
export class AnalysisModule {}
