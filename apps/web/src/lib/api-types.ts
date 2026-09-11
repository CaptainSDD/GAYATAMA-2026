import type {
  BusinessType,
  ComponentKey,
  Density,
  Facility,
  FacilityKind,
  LatLng,
  RecommendationStatus,
  SaturationReading,
  ScoreSummary,
  Segment,
  SegmentRole,
  SiteConditions,
  WarningCode,
  Zone,
} from '@gayatama/scoring';

// Response shapes from docs/api.md, as produced by apps/api/src/analysis/presenters.ts.

export interface DataSource {
  provider: string;
  attribution: string;
  licence: string;
  fetchedAt: string;
  cacheHit: boolean;
  /** Served from an expired cache entry because OpenStreetMap data was unavailable. */
  stale: boolean;
  /** `unavailable` when conditions at the site could not be loaded, so those inputs were scored as unknown. */
  siteConditions: 'available' | 'unavailable';
}

export interface Warning {
  code: WarningCode;
  message: string;
}

export interface Factor {
  factor: ComponentKey;
  detail: string;
}

export interface Competitor {
  id: string;
  name: string | null;
  kind: FacilityKind;
  distanceMeters: number;
  contribution: number;
}

export interface AnalysisResponse {
  modelVersion: string;
  location: LatLng;
  businessType: BusinessType;
  score: ScoreSummary;
  components: Record<ComponentKey, { value: number; weight: number }>;
  segments: Record<Segment, { score: number; role: SegmentRole }>;
  competition: {
    rawCount: number;
    equivalentCount: number;
    density: Density;
    saturationRatio: number;
    reading: SaturationReading;
    radiusMeters: number;
    strongest: Competitor[];
  };
  strengths: Factor[];
  risks: Factor[];
  warnings: Warning[];
  evidence: { facilityCount: number; zones: Record<Zone, number> };
  dataSource: DataSource;
}

export interface Recommendation {
  businessType: BusinessType;
  score: ScoreSummary;
  status: Exclude<RecommendationStatus, 'not_recommended'>;
  dominantSegment: Segment;
  rationale: string;
  differentiator: string;
}

export interface NotRecommended {
  businessType: BusinessType;
  score: ScoreSummary;
  status: 'not_recommended';
  reason: string;
}

export interface RecommendResponse {
  modelVersion: string;
  location: LatLng;
  recommendations: Recommendation[];
  equivalent: BusinessType[][];
  notRecommended: NotRecommended[];
  warnings: Warning[];
  segments: Record<Segment, number>;
  dataSource: DataSource;
}

export interface PoiFacility extends Facility {
  distanceMeters: number;
  zone: Zone;
  dataQuality: number;
  accessFactor: number;
}

export interface PoisResponse {
  location: LatLng;
  asOf: string;
  site: SiteConditions;
  facilities: PoiFacility[];
  dataSource: DataSource;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message?: string;
  details?: Record<string, unknown>;
}
