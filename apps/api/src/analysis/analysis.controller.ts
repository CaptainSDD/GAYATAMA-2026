import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnalysisService } from './analysis.service';
import {
  type AnalysisRequest,
  type CompareLocationsRequest,
  type CompareRequest,
  type PoisQuery,
  type RecommendRequest,
  analysisRequestSchema,
  compareLocationsRequestSchema,
  compareRequestSchema,
  poisQuerySchema,
  recommendRequestSchema,
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

  @Post('recommend')
  @HttpCode(HttpStatus.OK)
  @Throttle(SCORING_LIMIT)
  recommend(@Body(new ZodValidationPipe(recommendRequestSchema)) body: RecommendRequest) {
    return this.analysis.recommend(body);
  }

  @Post('compare')
  @HttpCode(HttpStatus.OK)
  @Throttle(SCORING_LIMIT)
  compare(@Body(new ZodValidationPipe(compareRequestSchema)) body: CompareRequest) {
    return this.analysis.compare(body);
  }

  /** Two points, one category. Exactly two: the request shape has no room for a third. */
  @Post('compare-locations')
  @HttpCode(HttpStatus.OK)
  @Throttle(SCORING_LIMIT)
  compareLocations(@Body(new ZodValidationPipe(compareLocationsRequestSchema)) body: CompareLocationsRequest) {
    return this.analysis.compareLocations(body);
  }

  @Get('pois')
  pois(@Query(new ZodValidationPipe(poisQuerySchema)) query: PoisQuery) {
    return this.analysis.facilities(query);
  }
}
