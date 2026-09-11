import { Injectable } from '@nestjs/common';
import {
  evaluateFacilities,
  recommendBusinessTypes,
  scoreLocation,
  type LatLng,
  type LocationInput,
} from '@gayatama/scoring';
import { insufficientData } from '../common/errors';
import { type PoiSnapshot, PoiService } from '../poi/poi.service';
import { presentAnalysis, presentPois, presentRecommendation } from './presenters';
import type { AnalysisRequest, PoisQuery, RecommendRequest } from './schemas';

/** Controllers orchestrate; they do not calculate. All scoring happens in @gayatama/scoring. */
@Injectable()
export class AnalysisService {
  constructor(private readonly pois: PoiService) {}

  async analyze(request: AnalysisRequest) {
    const { input, snapshot } = await this.load(request);
    const result = scoreLocation(input, request.businessType);
    if (result.insufficientData) throw insufficientData(result.evidence.facilityCount, result.confidence.value);
    return presentAnalysis(result, input.location, snapshot);
  }

  async recommend(request: RecommendRequest) {
    const { input, snapshot } = await this.load(request);
    const result = recommendBusinessTypes(input);
    if (result.insufficientData) {
      const facilitiesFound = evaluateFacilities(input).filter((entry) => !entry.facility.closed).length;
      throw insufficientData(facilitiesFound, result.confidence.value);
    }
    return presentRecommendation(result, input.location, snapshot);
  }

  async facilities(query: PoisQuery) {
    const { input, snapshot } = await this.load(query);
    const evaluated = evaluateFacilities(input).filter((entry) => entry.distanceMeters <= query.radius);
    return presentPois(evaluated, input, snapshot);
  }

  private async load(point: LatLng): Promise<{ input: LocationInput; snapshot: PoiSnapshot }> {
    const location = { lat: point.lat, lng: point.lng };
    const [snapshot, site] = await Promise.all([
      this.pois.facilitiesAround(location),
      this.pois.siteConditions(location),
    ]);
    return {
      snapshot,
      input: { location, facilities: snapshot.facilities, site, asOf: new Date().toISOString().slice(0, 10) },
    };
  }
}
