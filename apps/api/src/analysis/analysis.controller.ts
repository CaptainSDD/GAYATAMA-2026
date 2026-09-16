import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnalysisService } from './analysis.service';
import {
  type AnalysisRequest,
  type OpportunitiesRequest,
  type PoisQuery,
  type RecommendRequest,
  type SimulationRequest,
  analysisRequestSchema,
  opportunitiesRequestSchema,
  poisQuerySchema,
  recommendRequestSchema,
  simulationRequestSchema,
} from './schemas';

const SCORING_LIMIT = { default: { limit: 30, ttl: 60_000 } };

@Controller()
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Post('analysis')
  @HttpCode(HttpStatus.OK)
  @Throttle(SCORING_LIMIT)
  analyze(@Body(new ZodValidationPipe(analysisRequestSchema)) body: AnalysisRequest) {
    return this.analysis.analyze(body);
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @Throttle(SCORING_LIMIT)
  simulate(@Body(new ZodValidationPipe(simulationRequestSchema)) body: SimulationRequest) {
    return this.analysis.simulate(body);
  }

  @Post('opportunities')
  @HttpCode(HttpStatus.OK)
  // A grid starts nine POI lookups. Keep this deliberately below ordinary
  // single-location scoring so a shared public OSM service is treated kindly.
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  opportunities(@Body(new ZodValidationPipe(opportunitiesRequestSchema)) body: OpportunitiesRequest) {
    return this.analysis.opportunities(body);
  }

  @Post('recommend')
  @HttpCode(HttpStatus.OK)
  @Throttle(SCORING_LIMIT)
  recommend(@Body(new ZodValidationPipe(recommendRequestSchema)) body: RecommendRequest) {
    return this.analysis.recommend(body);
  }

  @Get('pois')
  pois(@Query(new ZodValidationPipe(poisQuerySchema)) query: PoisQuery) {
    return this.analysis.facilities(query);
  }
}
