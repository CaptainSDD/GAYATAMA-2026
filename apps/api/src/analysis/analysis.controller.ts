import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type AuthenticatedRequest, VerifyTokenGuard } from '../auth/verify-token.guard';
import { AnalysisService } from './analysis.service';
import {
  type AnalysisRequest,
  type CompareLocationsRequest,
  type CompareRequest,
  type OpportunitiesRequest,
  type PoisQuery,
  type RecommendRequest,
  type SimulationRequest,
  analysisRequestSchema,
  compareLocationsRequestSchema,
  compareRequestSchema,
  opportunitiesRequestSchema,
  poisQuerySchema,
  recommendRequestSchema,
  simulationRequestSchema,
} from './schemas';

const SCORING_LIMIT = { default: { limit: 30, ttl: 60_000 } };

/**
 * Every route here requires sign-in: scoring is no longer usable
 * anonymously, matching the web app, which already turns away signed-out
 * visitors before they reach any of these (`AuthGate`). This controller is
 * where that is actually enforced, rather than merely assumed.
 */
@Controller()
@UseGuards(VerifyTokenGuard)
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

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @Throttle(SCORING_LIMIT)
  simulate(@Body(new ZodValidationPipe(simulationRequestSchema)) body: SimulationRequest) {
    return this.analysis.simulate(body);
  }

  /** The kecamatan drill-down (`kecamatanId` set) is premium-gated inside the service, where the caller's plan is read. */
  @Post('opportunities')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  opportunities(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(opportunitiesRequestSchema)) body: OpportunitiesRequest,
  ) {
    return this.analysis.opportunities(body, request.uid);
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
