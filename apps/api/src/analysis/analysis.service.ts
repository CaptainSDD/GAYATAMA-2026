import { Injectable } from '@nestjs/common';
import {
  evaluateFacilities,
  recommendBusinessTypes,
  scoreLocation,
  type LatLng,
  type LocationInput,
} from '@gayatama/scoring';
import { insufficientData } from '../common/errors';
import { PoiService } from '../poi/poi.service';
import { presentAnalysis, presentPois, presentRecommendation, type SourceSnapshot } from './presenters';
import type { AnalysisRequest, PoisQuery, RecommendRequest } from './schemas';

/** Controllers orchestrate; they do not calculate. All scoring happens in @gayatama/scoring. */
@Injectable()
export class AnalysisService {
  constructor(private readonly pois: PoiService) {}

  async analyze(request: AnalysisRequest) {
    const { input, source } = await this.load(request);
    const result = scoreLocation(input, request.businessType);
    if (result.insufficientData) throw insufficientData(result.evidence.facilityCount, result.confidence.value);
    return presentAnalysis(result, input.location, source);
  }

  async recommend(request: RecommendRequest) {
    const { input, source } = await this.load(request);
    const result = recommendBusinessTypes(input);
    if (result.insufficientData) {
      const facilitiesFound = evaluateFacilities(input).filter((entry) => !entry.facility.closed).length;
      throw insufficientData(facilitiesFound, result.confidence.value);
    }
    return presentRecommendation(result, input.location, source);
  }

  async facilities(query: PoisQuery) {
    const { input, source } = await this.load(query);
    const evaluated = evaluateFacilities(input).filter((entry) => entry.distanceMeters <= query.radius);
    return presentPois(evaluated, input, source);
  }

  private async load(point: LatLng): Promise<{ input: LocationInput; source: SourceSnapshot }> {
    const location = { lat: point.lat, lng: point.lng };
    const [snapshot, site] = await Promise.all([
      this.pois.facilitiesAround(location),
      this.pois.siteConditions(location),
    ]);
    return {
      source: { ...snapshot, siteAvailable: site.available },
      input: { location, facilities: snapshot.facilities, site: site.site, asOf: new Date().toISOString().slice(0, 10) },
    };
  }
}
