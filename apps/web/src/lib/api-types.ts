import type {
  BusinessType,
  ComponentKey,
  Density,
  Facility,
  FacilityKind,
  FacilityScale,
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
