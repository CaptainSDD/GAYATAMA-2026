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
import { insufficientData, premiumRequired, unknownKecamatan } from '../common/errors';
import { AuthService } from '../auth/auth.service';
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
  /** The kecamatan's Indonesian name, for a visitor who has not picked a point yet. */
  label: string;
  lat: number;
  lng: number;
  status: 'scored' | 'insufficient_data' | 'unavailable';
  score: number | null;
  confidence: number | null;
}

/**
 * One fixed representative point per kecamatan of Kota Semarang — nobody has
 * picked a location yet when this runs, so there is no per-visitor point to
 * anchor anything to. Every visitor sees the exact same sixteen points, which
 * is also what lets repeat requests for the same point be cheap: they go
 * through the same POI cache (`apps/api/src/poi/poi-cache.ts`) that
 * `/analysis` already uses, keyed by geohash rather than by visitor.
 *
 * This is a cost-saving simplification, not a search for the best spot in
 * each kecamatan: the point is a representative coordinate, not a claim that
 * it is the optimal location within that district. Coordinates are each
 * kecamatan's administrative-boundary centroid from OpenStreetMap, via
 * Nominatim, retrieved 2026-09-20.
 */
const KECAMATAN_POINTS: ReadonlyArray<{ id: string; label: string; lat: number; lng: number }> = [
  { id: 'semarang_tengah', label: 'Semarang Tengah', lat: -6.9786542, lng: 110.4217815 },
  { id: 'semarang_utara', label: 'Semarang Utara', lat: -6.9625015, lng: 110.4186032 },
  { id: 'semarang_timur', label: 'Semarang Timur', lat: -6.9740370, lng: 110.4365669 },
  { id: 'semarang_selatan', label: 'Semarang Selatan', lat: -6.9969069, lng: 110.4257045 },
  { id: 'semarang_barat', label: 'Semarang Barat', lat: -6.9834250, lng: 110.3886509 },
  { id: 'candisari', label: 'Candisari', lat: -7.0159361, lng: 110.4288787 },
  { id: 'gajahmungkur', label: 'Gajahmungkur', lat: -7.0099071, lng: 110.4053851 },
  { id: 'gayamsari', label: 'Gayamsari', lat: -6.9779760, lng: 110.4462725 },
  { id: 'genuk', label: 'Genuk', lat: -6.9614445, lng: 110.4784298 },
  { id: 'pedurungan', label: 'Pedurungan', lat: -7.0011889, lng: 110.4760628 },
  { id: 'tembalang', label: 'Tembalang', lat: -7.0601456, lng: 110.4466015 },
  { id: 'banyumanik', label: 'Banyumanik', lat: -7.0606682, lng: 110.4189276 },
  { id: 'gunungpati', label: 'Gunungpati', lat: -7.0655711, lng: 110.3751099 },
  { id: 'mijen', label: 'Mijen', lat: -7.0534213, lng: 110.3162795 },
  { id: 'ngaliyan', label: 'Ngaliyan', lat: -7.0008457, lng: 110.3365240 },
  { id: 'tugu', label: 'Tugu', lat: -6.9635069, lng: 110.3345870 },
];

/**
 * A per-kecamatan "premium" detail request scores a small local grid around
 * that kecamatan's representative point instead of its one fixed coordinate —
 * still a fixed shape, not a real search, but enough candidates to surface a
 * top few rather than just the one representative point. Demo-tier-gated on
 * the client only; nothing here enforces a paid entitlement.
 */
const KECAMATAN_LOCAL_GRID_SPACING_METERS = 800;

function offsetPoint(origin: LatLng, northMeters: number, eastMeters: number): LatLng {
  const earthRadiusMeters = 6_371_000;
  const latRadians = (origin.lat * Math.PI) / 180;
  return {
    lat: origin.lat + (northMeters / earthRadiusMeters) * (180 / Math.PI),
    lng: origin.lng + (eastMeters / (earthRadiusMeters * Math.cos(latRadians))) * (180 / Math.PI),
  };
}

/** A 3×3 lattice (9 points) around one kecamatan's representative point. */
function localGrid(center: LatLng): LatLng[] {
  const points: LatLng[] = [];
  for (let row = -1; row <= 1; row += 1) {
    for (let column = -1; column <= 1; column += 1) {
      points.push(offsetPoint(center, row * KECAMATAN_LOCAL_GRID_SPACING_METERS, column * KECAMATAN_LOCAL_GRID_SPACING_METERS));
    }
  }
  return points;
}

@Injectable()
export class AnalysisService {
  constructor(
    private readonly pois: PoiService,
    private readonly places: PlaceCountsService,
    private readonly narratives: NarrativeService,
    private readonly locations: LocationEligibilityService,
    private readonly auth: AuthService,
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

  /**
   * The city-wide list needs no plan check — every signed-in account can see
   * it. Drilling into one kecamatan's local grid is the premium feature, so
   * `uid` is only consulted when `kecamatanId` is present.
   */
  async opportunities(request: OpportunitiesRequest, uid: string) {
    if (request.kecamatanId !== undefined) {
      const profile = await this.auth.getProfile(uid, null);
      if (profile === null || profile.plan !== 'premium') throw premiumRequired();
    }

    const cells = this.opportunityCells(request.kecamatanId);
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
    return {
      businessType: request.businessType,
      source: 'OpenStreetMap' as const,
      cells: results,
    };
  }

  /**
   * The sixteen city-wide kecamatan points, or — when a visitor has picked one
   * kecamatan to look inside — the 3×3 local grid around that kecamatan's
   * point instead. An id that names no known kecamatan is a client error, not
   * a silent fallback to the city-wide list.
   */
  private opportunityCells(kecamatanId: string | undefined): ReadonlyArray<Pick<OpportunityCell, 'id' | 'label' | 'lat' | 'lng'>> {
    if (kecamatanId === undefined) return KECAMATAN_POINTS;

    const kecamatan = KECAMATAN_POINTS.find((point) => point.id === kecamatanId);
    if (kecamatan === undefined) throw unknownKecamatan(kecamatanId);

    return localGrid(kecamatan).map((point, index) => ({
      id: `${kecamatan.id}_${index}`,
      label: kecamatan.label,
      ...point,
    }));
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

