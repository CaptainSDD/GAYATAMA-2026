/** The seven MVP business categories. */
export type BusinessType =
  | 'beverages'
  | 'food'
  | 'laundry'
  | 'stationery'
  | 'minimarket'
  | 'salon'
  | 'pharmacy';

/** The six target market segments. */
export type Segment = 'student' | 'office' | 'resident' | 'commuter' | 'health' | 'general';

/** Distance zones: A 0–300 m, B above 300–800 m, C above 800–1,500 m. */
export type Zone = 'a' | 'b' | 'c';

export type FacilityScale = 'small' | 'medium' | 'large';

/** Physical barrier between the candidate location and a facility. */
export type Severance = 'none' | 'major_road' | 'rail_river_toll';

export type RoadClass = 'primary' | 'secondary' | 'tertiary' | 'residential' | 'service';

/**
 * Internal facility categories. The API's tag normaliser maps OpenStreetMap
 * tags onto these; the engine never sees raw tags.
 */
export type FacilityKind =
  // Facilities that indicate customer segments
  | 'campus'
  | 'school'
  | 'office'
  | 'government_office'
  | 'housing'
  | 'boarding_house'
  | 'transit'
  | 'hospital'
  | 'mall'
  // Businesses that compete with one or more categories
  | 'cafe'
  | 'bubble_tea'
  | 'restaurant'
  | 'fast_food'
  | 'food_court'
  | 'laundry'
  | 'dry_cleaning'
  | 'copyshop'
  | 'printer'
  | 'stationery_shop'
  | 'convenience'
  | 'supermarket'
  | 'hairdresser'
  | 'beauty'
  | 'pharmacy'
  | 'chemist'
  // Facilities that support transactions
  | 'atm'
  | 'bank'
  | 'marketplace'
  | 'place_of_worship'
  | 'clinic'
  // Infrastructure
  | 'parking'
  | 'other';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OpeningInterval {
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  /** Minutes after midnight, 0–1440. Overnight hours are split across two days. */
  from: number;
  to: number;
}

export type WeeklyHours = readonly OpeningInterval[];

export interface Facility extends LatLng {
  id: string;
  kind: FacilityKind;
  name?: string;
  /** Defaults to `medium`. */
  scale?: FacilityScale;
  /** Defaults to `none`. */
  severance?: Severance;
  /** Marked closed by an OSM lifecycle prefix (`disused:`, `was:`, `demolished:`). */
  closed?: boolean;
  doubtfulCategory?: boolean;
  /** ISO date of the last on-the-ground check (`check_date`, `survey:date`). */
  checkDate?: string;
  /** ISO date of the last OSM edit (Overpass `out meta`). */
  lastEditDate?: string;
  /** `undefined` means the hours are unknown. */
  openingHours?: WeeklyHours;
  /** Parking spaces, for `parking` facilities. */
  capacity?: number;
  /** A restaurant or fast-food outlet tagged as serving coffee. */
  servesCoffee?: boolean;
}

/**
 * Facilities known only as a number per zone, from a source that reports
 * counts rather than individual places. PROPOSED in model 0.1.0.
 */
export interface FacilityCount {
  kind: FacilityKind;
  zone: Zone;
  /** How many facilities of this kind lie in this zone band. */
  count: number;
  /** Defaults to `medium`. */
  scale?: FacilityScale;
  /** Where the count came from, such as `google`. */
  source: string;
}

/** Conditions at the candidate site itself, derived by the API. */
export interface SiteConditions {
  /** Class of the nearest road; `undefined` when unknown. */
  roadClass?: RoadClass;
  /** Sidewalks, footways and crossings mapped within 300 m. */
  pedestrianFeatureCount?: number;
  /** Distance to the nearest mapped river, canal or stream. */
  nearestWaterwayMeters?: number;
  /** Industrial land use mapped within 100 m. */
  industrialLanduseNearby?: boolean;
}

export interface LocationInput {
  location: LatLng;
  facilities: readonly Facility[];
  /** Facilities known only as counts. A kind should come from either facilities or counts, not both. */
  facilityCounts?: readonly FacilityCount[];
  site?: SiteConditions;
  /** ISO date the data is evaluated against. The engine never reads the clock. */
  asOf: string;
}

/** Variables an operator can change, used by the what-if simulator. */
export interface OperatorOptions {
  onSiteParkingSpaces?: number;
  /** The business's own opening hours. */
  openingHours?: WeeklyHours;
  delivery?: boolean;
}

export interface EvaluatedFacility {
  facility: Facility;
  distanceMeters: number;
  zone: Zone;
  distanceWeight: number;
  accessFactor: number;
  dataQuality: number;
  scaleFactor: number;
  /** How many facilities the entry stands for: 1 for a mapped facility, the count for a counted one. */
  count: number;
  /** The source of a counted entry; `undefined` for a mapped facility. */
  countedFrom?: string;
}

export type Band = 'highly_suitable' | 'suitable' | 'moderately_suitable' | 'risky' | 'not_recommended';

export type ComponentKey = 'demandFit' | 'accessibility' | 'competition' | 'supportingFacility' | 'risk';

export type Components = Record<ComponentKey, number>;

export type SegmentScores = Record<Segment, number>;

export type SegmentRole = 'primary' | 'secondary' | 'supporting' | 'insignificant';

export type Density = 'low' | 'moderate' | 'high' | 'very_high';

export type SaturationReading =
  | 'not_saturated'
  | 'healthy'
  | 'becoming_saturated'
  | 'saturated'
  | 'heavily_saturated';

export type ConfidenceReading = 'high' | 'good' | 'moderate' | 'low' | 'very_low';

export type RecommendationStatus = 'primary' | 'alternative' | 'needs_validation' | 'not_recommended';

export type WarningCode = 'flood_risk_proxy' | 'stale_data';

export interface ScoreSummary {
  value: number;
  band: Band;
  confidence: number;
  margin: number;
  range: [number, number];
}

export interface CompetitorContribution {
  facility: Facility;
  distanceMeters: number;
  zone: Zone;
  similarity: number;
  operatingHoursFactor: number;
  /** 1 for a mapped competitor; the number of competitors for a counted entry. */
  count: number;
  /** The source of a counted entry; `undefined` for a mapped competitor. */
  countedFrom?: string;
  contribution: number;
}

export interface CompetitionResult {
  radiusMeters: 800 | 1500;
  rawCount: number;
  equivalentCount: number;
  density: Density;
  saturationRatio: number;
  reading: SaturationReading;
  validationBonus: number;
  score: number;
  /** Sorted by contribution, strongest first. */
  competitors: CompetitorContribution[];
}

export interface AccessibilityResult {
  value: number;
  road: number;
  transit: number;
  walkability: number;
  parking: number;
}

export interface ConfidenceResult {
  value: number;
  reading: ConfidenceReading;
  completeness: number;
  freshness: number;
  crossSourceValidation: number;
  areaCoverage: number;
}

export interface ComponentFactor {
  component: ComponentKey;
  value: number;
}

export interface HardWarning {
  code: WarningCode;
}

export interface DeliveryEffect {
  /** The score delivery would produce without the 5-point cap. */
  uncappedScore: number;
  capApplied: boolean;
}

export interface LocationScoreResult {
  modelVersion: string;
  businessType: BusinessType;
  score: ScoreSummary;
  components: Components;
  accessibility: AccessibilityResult;
  segments: SegmentScores;
  segmentRoles: Record<Segment, SegmentRole>;
  dominantSegment: Segment;
  competition: CompetitionResult;
  confidence: ConfidenceResult;
  strengths: ComponentFactor[];
  weaknesses: ComponentFactor[];
  warnings: HardWarning[];
  /** Confidence is below 40: no definitive recommendation may be given. */
  insufficientData: boolean;
  evidence: {
    facilityCount: number;
    zones: Record<Zone, number>;
  };
  /** Present only when delivery was requested for a category it applies to. */
  delivery?: DeliveryEffect;
}

export interface RankedCategory {
  businessType: BusinessType;
  score: ScoreSummary;
  status: RecommendationStatus;
  dominantSegment: Segment;
  components: Components;
  saturationRatio: number;
  saturationReading: SaturationReading;
}

export interface RecommendationResult {
  modelVersion: string;
  insufficientData: boolean;
  confidence: ConfidenceResult;
  segments: SegmentScores;
  /** At most three categories scoring 60 or more, highest first. */
  recommendations: RankedCategory[];
  /** Every category scoring below 60, highest first. */
  notRecommended: RankedCategory[];
  equivalent: BusinessType[][];
  warnings: HardWarning[];
}
