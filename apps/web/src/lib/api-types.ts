import type {
  BusinessType,
  ComponentKey,
  ComponentWeights,
  ConfidenceReading,
  Density,
  Facility,
  FacilityKind,
  FacilityScale,
  LatLng,
  RecommendationStatus,
  RoadClass,
  SaturationReading,
  ScoreSummary,
  Segment,
  SegmentRole,
  SiteConditions,
  WarningCode,
  Zone,
} from '@gayatama/scoring';

export interface SimulationResponse {
  options: { onSiteParkingSpaces?: number; openingHours?: readonly { day: number; from: number; to: number }[] };
  baseline: { score: ScoreSummary; accessibility: AnalysisResponse['accessibility']; competition: { value: number; saturationRatio: number } };
  simulated: { score: ScoreSummary; accessibility: AnalysisResponse['accessibility']; competition: { value: number; saturationRatio: number } };
  scoreChange: number;
}

export interface OpportunitiesResponse {
  center: LatLng;
  businessType: BusinessType;
  source: 'OpenStreetMap';
  spacingMeters: number;
  cells: Array<{ id: string; lat: number; lng: number; status: 'scored' | 'insufficient_data' | 'unavailable'; score: number | null; confidence: number | null }>;
}


export interface PlacesSource {
  provider: 'Google Maps';
  /**
   * `used`, or why every facility came from OpenStreetMap instead: `not_requested`
   * without a Google map, `not_configured` without a server key, `unavailable` when Google failed.
   */
  status: 'used' | 'not_requested' | 'not_configured' | 'unavailable';
  /** "Google Maps" when used; it must then be shown with the result. */
  attribution: string | null;
  fetchedAt: string | null;
  cacheHit: boolean | null;
  /** The facility kinds counted by Google. */
  kinds: FacilityKind[];
}

/** Overture Maps shops added to the photocopy, printing and stationery kinds. */
export interface OvertureSource {
  provider: 'Overture Maps Foundation';
  /** Must be shown with the result. */
  attribution: string;
  licence: string;
  release: string;
  kinds: FacilityKind[];
}

export interface DataSource {
  provider: string;
  attribution: string;
  licence: string;
  fetchedAt: string;
  cacheHit: boolean;
  /** Served from an expired cache entry because OpenStreetMap data was unavailable. */
  stale: boolean;
  /** A managed Geoapify lookup, live Overpass query, or offline OpenStreetMap snapshot. */
  via: 'overpass' | 'geoapify' | 'snapshot';
  /** `unavailable` when conditions at the site could not be loaded, so those inputs were scored as unknown. */
  siteConditions: 'available' | 'unavailable';
  places: PlacesSource;
  /** `null` outside the areas prepared with Overture data. */
  overture: OvertureSource | null;
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
  zone: Zone;
  /** `null` for a counted group, which has no single position. */
  distanceMeters: number | null;
  /** 1 for a mapped competitor; the number of competitors for a counted group. */
  count: number;
  /** `openstreetmap` or `overture` for a listed competitor; for a counted group, the source that counted it, such as `google`. */
  source: string;
  contribution: number;
}

/** A named mapped place shown as an example; Google aggregate counts remain the source used for scoring. */
export interface NamedCompetitor {
  id: string;
  name: string;
  kind: FacilityKind;
  zone: Zone;
  distanceMeters: number;
  source: string;
}

export interface AnalysisResponse {
  /** Present only when the score was computed with non-default weights. */
  weights?: ComponentWeights;
  modelVersion: string;
  location: LatLng;
  businessType: BusinessType;
  score: ScoreSummary;
  components: Record<ComponentKey, { value: number; weight: number; availability: 'available' | 'partial' | 'unavailable' }>;
  /** Subscores behind Kemudahan Akses. Site inputs use neutral 50 when their lookup fails. */
  accessibility: {
    value: number;
    road: number;
    transit: number;
    walkability: number;
    parking: number;
    siteInputsAvailable: boolean;
  };
  segments: Record<Segment, { score: number; role: SegmentRole }>;
  competition: {
    rawCount: number;
    equivalentCount: number;
    density: Density;
    saturationRatio: number;
    reading: SaturationReading;
    radiusMeters: number;
    strongest: Competitor[];
    namedCompetitors: NamedCompetitor[];
  };
  strengths: Factor[];
  risks: Factor[];
  warnings: Warning[];
  evidence: { facilityCount: number; zones: Record<Zone, number> };
  dataSource: DataSource;
  /** Plain-language explanation generated separately from deterministic scoring. */
  narrative: {
    headline: string;
    summary: string;
    positives: string[];
    cautions: string[];
    nextSteps: string[];
    provisional: boolean;
    generatedBy: 'ai' | 'template';
  };
}

export interface Recommendation {
  businessType: BusinessType;
  score: ScoreSummary;
  status: Exclude<RecommendationStatus, 'not_recommended'>;
  dominantSegment: Segment;
  rationale: string;
  differentiator: string;
}

/** A rule-based reading of scores the engine produced, not a score of its own. */
export type IndicatorLevel = 'high' | 'moderate' | 'low';

/** `unknown` when site conditions could not be loaded, so risk is only a neutral placeholder. */
export type RiskLevel = IndicatorLevel | 'unknown';

export interface ComparedCategory {
  /** 1 for the best match at this location. */
  rank: number;
  businessType: BusinessType;
  score: ScoreSummary;
  status: RecommendationStatus;
  recommended: boolean;
  components: Record<ComponentKey, { value: number; weight: number }>;
  targetMarket: { segment: Segment; level: IndicatorLevel };
  supportingFacility: { value: number; level: IndicatorLevel };
  competition: {
    rawCount: number;
    equivalentCount: number;
    density: Density;
    saturationRatio: number;
    reading: SaturationReading;
    radiusMeters: number;
  };
  opportunityLevel: IndicatorLevel;
  /** Estimated from nearby customer groups and the nearest transit stop, not counted footfall. */
  trafficLevel: IndicatorLevel;
  riskLevel: RiskLevel;
  reason: string;
  differentiator: string;
}

/** A recognisable landmark group near a candidate site. */
export interface Landmark {
  id: string;
  label: string;
  count: number;
  /** `null` when only counted zones contributed, which have no single position. */
  nearestMeters: number | null;
}

export interface ComparedLocationSide {
  label: 'A' | 'B';
  location: LatLng;
  score: ScoreSummary;
  status: RecommendationStatus;
  confidence: { value: number; reading: ConfidenceReading };
  components: Record<ComponentKey, { value: number; weight: number }>;
  targetMarket: { segment: Segment; level: IndicatorLevel };
  segments: Record<Segment, { score: number; role: SegmentRole }>;
  supportingFacility: { value: number; level: IndicatorLevel };
  landmarks: Landmark[];
  /** Class of the nearest road; `null` when site conditions could not be loaded. */
  mainRoad: RoadClass | null;
  competition: {
    rawCount: number;
    equivalentCount: number;
    density: Density;
    saturationRatio: number;
    reading: SaturationReading;
    radiusMeters: number;
  };
  accessibility: {
    value: number;
    road: number;
    transit: number;
    walkability: number;
    parking: number;
    level: IndicatorLevel;
    siteInputsAvailable: boolean;
  };
  opportunityLevel: IndicatorLevel;
  trafficLevel: IndicatorLevel;
  riskLevel: RiskLevel;
  strengths: { component: ComponentKey; value: number }[];
  weaknesses: { component: ComponentKey; value: number }[];
  reason: string;
  evidence: { facilityCount: number; zones: Record<Zone, number> };
  warnings: Warning[];
  dataSource: DataSource;
}

/** How much of the gap between the two sites each component accounts for. */
export interface DecidingFactor {
  component: ComponentKey;
  a: number;
  b: number;
  delta: number;
  /** `delta × weight`. These sum to the difference in score, with nothing left over. */
  weightedDelta: number;
  favours: 'a' | 'b' | null;
  /**
   * `false` when the gap reflects missing data rather than the places: operating
   * risk falls back to a neutral value when site conditions cannot be loaded.
   * Such a factor still counts towards the score, but is never given as a reason.
   */
  comparable: boolean;
}

/** Exactly two candidate sites compared for one business type. */
export interface LocationComparisonResponse {
  modelVersion: string;
  businessType: BusinessType;
  locations: { a: ComparedLocationSide; b: ComparedLocationSide };
  verdict: {
    /** `null` when the gap falls inside the model's equivalence threshold. */
    winner: 'a' | 'b' | null;
    tied: boolean;
    difference: number;
    equivalenceGap: number;
    decidingFactors: DecidingFactor[];
    summary: string;
    alternative: string;
  };
}

/** Every category compared for one location, for a visitor who has not chosen a business type. */
export interface ComparisonResponse {
  modelVersion: string;
  location: LatLng;
  confidence: { value: number; reading: ConfidenceReading };
  topChoice: BusinessType | null;
  /** One sentence naming the leading category and why it leads. */
  highlight: string;
  /** Inputs that do not depend on the business type, so they are reported once. */
  shared: {
    accessibility: { value: number; level: IndicatorLevel; siteInputsAvailable: boolean };
    segments: Record<Segment, { score: number; role: SegmentRole }>;
    evidence: { facilityCount: number; zones: Record<Zone, number> };
  };
  /** All categories, best first. */
  categories: ComparedCategory[];
  equivalent: BusinessType[][];
  warnings: Warning[];
  dataSource: DataSource;
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

/** Facilities known only as a number per zone. */
export interface PoiFacilityCount {
  kind: FacilityKind;
  zone: Zone;
  count: number;
  scale: FacilityScale;
  source: string;
  dataQuality: number;
}

export interface PoisResponse {
  location: LatLng;
  asOf: string;
  site: SiteConditions;
  facilities: PoiFacility[];
  facilityCounts: PoiFacilityCount[];
  dataSource: DataSource;
}

export interface LocationDetailsResponse {
  location: LatLng;
  eligibility:
    | { status: 'eligible' }
    | { status: 'unknown' }
    | { status: 'ineligible'; reason: 'water' | 'wetland' | 'aquaculture' };
  address: {
    name: string | null;
    street: string | null;
    /** Kelurahan or the closest neighbourhood-level name available. */
    village: string | null;
    /** Kecamatan or the closest district-level name available. */
    district: string | null;
    city: string | null;
    postcode: string | null;
    state: string | null;
    formatted: string | null;
  } | null;
  source: {
    provider: string;
    attribution: string;
    licence: string;
  } | null;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ProfileResponse {
  profile: {
    username: string;
    email: string | null;
    createdAt: string;
    /** null when this account has never left the documented baseline. */
    weights: ComponentWeights | null;
  } | null;
}
