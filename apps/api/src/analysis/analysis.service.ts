import { Injectable } from '@nestjs/common';
import {
  compareBusinessTypes,
  evaluateFacilities,
  normalizeWeights,
  recommendBusinessTypes,
  scoreLocation,
  simulate,
  type BusinessType,
  type LatLng,
  type LocationInput,
  type OperatorOptions,
} from '@gayatama/scoring';
import { insufficientData } from '../common/errors';
import { PlaceCountsService } from '../places/place-counts.service';
import { GOOGLE_COUNTED_KINDS } from '../places/place-types';
import { PoiService } from '../poi/poi.service';
import { withMappedSeverance } from '../overpass/severance';
import { LocationEligibilityService } from '../location/location-eligibility';
import { NarrativeService } from './narrative.service';
import {
  presentAnalysis,
  presentComparison,
  presentLocationComparison,
  presentPois,
  presentRecommendation,
  presentSimulation,
  type ScoredLocation,
  type SourceSnapshot,
} from './presenters';
import type {
  AnalysisRequest,
  CompareLocationsRequest,
  CompareRequest,
  OpportunitiesRequest,
  PoisQuery,
  RecommendRequest,
  SimulationRequest,
} from './schemas';

export interface OpportunityCell {
  id: string;
  lat: number;
  lng: number;
  status: 'scored' | 'insufficient_data' | 'unavailable';
  score: number | null;
  confidence: number | null;
}

const OPPORTUNITY_GRID_SPACING_METERS = 350;
@Injectable()
export class AnalysisService {
  constructor(
    private readonly pois: PoiService,
    private readonly places: PlaceCountsService,
    private readonly narratives: NarrativeService,
    private readonly locations: LocationEligibilityService,
  ) {}

  async analyze(request: AnalysisRequest) {
    const { input, source } = await this.load(request);
    const result = scoreLocation(
      input,
      request.businessType,
      {},
      request.weights === undefined ? undefined : normalizeWeights(request.weights),
    );
    if (result.insufficientData) throw insufficientData(result.evidence.facilityCount, result.confidence.value);
    const response = presentAnalysis(result, input, source);
    const narrative = await this.narratives.forAnalysis(
      result,
      {
        siteAvailable: source.siteAvailable,
        stale: source.stale,
        placesStatus: source.places.status,
      },
      response,
    );
    return { ...response, narrative };
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

  /**
   * Every category compared for one point, for visitors who have not chosen a
   * business type. One data load feeds all seven: this costs the same upstream
   * requests as a single analysis.
   */
  async compare(request: CompareRequest) {
    const { input, source } = await this.load(request);
    const result = compareBusinessTypes(input);
    if (result.insufficientData) {
      const facilitiesFound = evaluateFacilities(input)
        .filter((entry) => !entry.facility.closed)
        .reduce((sum, entry) => sum + entry.count, 0);
      throw insufficientData(facilitiesFound, result.confidence.value);
    }
    return presentComparison(result, input.location, source);
  }

  /**
   * Two candidate sites for one category. Both points are loaded and scored the
   * same way, so the comparison is fair by construction: the only difference
   * between the two results is the place itself.
   */
  async compareLocations(request: CompareLocationsRequest) {
    const [a, b] = await Promise.all([
      this.scoreFor({ ...request.a, googleMap: request.googleMap }, request.businessType, 'a'),
      this.scoreFor({ ...request.b, googleMap: request.googleMap }, request.businessType, 'b'),
    ]);
    return presentLocationComparison(request.businessType, a, b);
  }

  /** One side of a comparison. The side is named in the error, so a failure says which point lacks data. */
  private async scoreFor(
    request: LatLng & { googleMap: boolean },
    businessType: BusinessType,
    side: 'a' | 'b',
  ): Promise<ScoredLocation> {
    const { input, source } = await this.load(request);
    const result = scoreLocation(input, businessType);
    if (result.insufficientData) {
      throw insufficientData(result.evidence.facilityCount, result.confidence.value, side);
    }
    return { label: side === 'a' ? 'A' : 'B', result, input, source };
  }

  async simulate(request: SimulationRequest) {
    const { input } = await this.load(request);
    const result = simulate(input, request.businessType, request.options);
    if (result.baseline.insufficientData) {
      throw insufficientData(result.baseline.evidence.facilityCount, result.baseline.confidence.value);
    }
    return presentSimulation(result, request.options);
  }

  async opportunities(request: OpportunitiesRequest) {
    const cells = opportunityGrid({ lat: request.lat, lng: request.lng });
    const results = await Promise.all(
      cells.map(async (cell): Promise<OpportunityCell> => {
        try {
          const { input } = await this.load({ ...cell, googleMap: false });
          const result = scoreLocation(input, request.businessType);
          return { ...cell, status: result.insufficientData ? 'insufficient_data' : 'scored', score: result.score.value, confidence: result.score.confidence };
        } catch {
          return { ...cell, status: 'unavailable', score: null, confidence: null };
        }
      }),
    );
    return { center: { lat: request.lat, lng: request.lng }, businessType: request.businessType, source: 'OpenStreetMap' as const, spacingMeters: OPPORTUNITY_GRID_SPACING_METERS, cells: results };
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
    await this.locations.assertEligible(location);
    const [snapshot, site, places] = await Promise.all([
      this.pois.facilitiesAround(location),
      this.pois.siteConditions(location),
      request.googleMap ? this.places.countsAround(location) : Promise.resolve({ status: 'not_requested' as const }),
    ]);

    const mappedFacilities = withMappedSeverance(snapshot.facilities, location, site.access);
    const input: LocationInput = {
      location,
      facilities: mappedFacilities,
      site: site.site,
      siteAvailable: site.available,
      asOf: new Date().toISOString().slice(0, 10),
    };
    if (places.status === 'used') {
      input.facilities = mappedFacilities.filter((facility) => !GOOGLE_COUNTED_KINDS.has(facility.kind));
      input.facilityCounts = places.counts;
    }
    return { input, source: { ...snapshot, siteAvailable: site.available, places } };
  }
}

function offsetPoint(origin: LatLng, northMeters: number, eastMeters: number): LatLng {
  const earthRadiusMeters = 6_371_000;
  const latRadians = (origin.lat * Math.PI) / 180;
  return {
    lat: origin.lat + (northMeters / earthRadiusMeters) * (180 / Math.PI),
    lng: origin.lng + (eastMeters / (earthRadiusMeters * Math.cos(latRadians))) * (180 / Math.PI),
  };
}

function opportunityGrid(center: LatLng): Array<Pick<OpportunityCell, 'id' | 'lat' | 'lng'>> {
  const cells: Array<Pick<OpportunityCell, 'id' | 'lat' | 'lng'>> = [];
  for (let row = -1; row <= 1; row += 1) {
    for (let column = -1; column <= 1; column += 1) {
      const point = offsetPoint(center, row * OPPORTUNITY_GRID_SPACING_METERS, column * OPPORTUNITY_GRID_SPACING_METERS);
      cells.push({ id: `${row}:${column}`, ...point });
    }
  }
  return cells;
}
