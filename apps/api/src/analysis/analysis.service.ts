import { Injectable } from '@nestjs/common';
import {
  evaluateFacilities,
  recommendBusinessTypes,
  scoreLocation,
  type LatLng,
  type LocationInput,
} from '@gayatama/scoring';
import { insufficientData } from '../common/errors';
import { PlaceCountsService } from '../places/place-counts.service';
import { GOOGLE_COUNTED_KINDS } from '../places/place-types';
import { PoiService } from '../poi/poi.service';
import { presentAnalysis, presentPois, presentRecommendation, type SourceSnapshot } from './presenters';
import type { AnalysisRequest, PoisQuery, RecommendRequest } from './schemas';

/** Controllers orchestrate; they do not calculate. All scoring happens in @gayatama/scoring. */
@Injectable()
export class AnalysisService {
  constructor(
    private readonly pois: PoiService,
    private readonly places: PlaceCountsService,
  ) {}

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
      const facilitiesFound = evaluateFacilities(input)
        .filter((entry) => !entry.facility.closed)
        .reduce((sum, entry) => sum + entry.count, 0);
      throw insufficientData(facilitiesFound, result.confidence.value);
    }
    return presentRecommendation(result, input.location, source);
  }

  async facilities(query: PoisQuery) {
    const { input, source } = await this.load(query);
    // A counted zone sits at its outer edge, so it is included only when the whole zone is within the radius.
    const evaluated = evaluateFacilities(input).filter((entry) => entry.distanceMeters <= query.radius);
    return presentPois(evaluated, input, source);
  }

  /**
   * OpenStreetMap facilities and site conditions, plus Google counts when the
   * client shows a Google map. Google counts replace OpenStreetMap facilities of
   * the kinds Google covers; if they are not available, OpenStreetMap is used for
   * every kind.
   */
  private async load(request: LatLng & { googleMap: boolean }): Promise<{ input: LocationInput; source: SourceSnapshot }> {
    const location = { lat: request.lat, lng: request.lng };
    const [snapshot, site, places] = await Promise.all([
      this.pois.facilitiesAround(location),
      this.pois.siteConditions(location),
      request.googleMap ? this.places.countsAround(location) : Promise.resolve({ status: 'not_requested' as const }),
    ]);

    const input: LocationInput = {
      location,
      facilities: snapshot.facilities,
      site: site.site,
      asOf: new Date().toISOString().slice(0, 10),
    };
    if (places.status === 'used') {
      input.facilities = snapshot.facilities.filter((facility) => !GOOGLE_COUNTED_KINDS.has(facility.kind));
      input.facilityCounts = places.counts;
    }
    return { input, source: { ...snapshot, siteAvailable: site.available, places } };
  }
}
