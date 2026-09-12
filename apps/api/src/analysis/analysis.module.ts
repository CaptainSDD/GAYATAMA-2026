import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { PoiModule } from '../poi/poi.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [PoiModule, PlacesModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
