import type {
  BusinessType,
  ComponentKey,
  DiscouragingSurrounding,
  FacilityKind,
  FacilityScale,
  RoadClass,
  Segment,
  Severance,
  Zone,
} from './types.js';

// Every number the model uses lives in this file, so recalibration is a
// single-file change that can be diffed against docs/methodology.md.
// Values marked PROPOSED are not in the original specification; they are
// listed under "Proposed in model 0.1.0" in the methodology.

export const MODEL_VERSION = '0.1.0';

// --- System-wide rules --------------------------------------------------------

export const ANALYSIS_RADIUS_METERS = 1500;

/** Upper bound of each zone in metres, inclusive. */
export const ZONE_LIMITS_METERS: Record<Zone, number> = { a: 300, b: 800, c: 1500 };

export const ZONE_WEIGHTS: Record<Zone, number> = { a: 1.0, b: 0.6, c: 0.25 };

export const ACCESS_FACTOR: Record<Severance, number> = {
  none: 1.0,
  major_road: 0.65,
  rail_river_toll: 0.4,
};

export const DATA_QUALITY = {
  recent: 1.0,
  aging: 0.85,
  undatedComplete: 0.65,
  staleOrDoubtful: 0.4,
  closed: 0,
} as const;

/**
 * PROPOSED: Data Quality of a counted facility. A count carries no per-record
 * date, so it takes the existing "date unknown but record is reasonably complete" band.
 */
export const COUNTED_DATA_QUALITY = DATA_QUALITY.undatedComplete;

/** Age limits in months for the Data Quality bands and the stale-data warning. */
export const DATA_AGE_MONTHS = { recent: 12, aging: 24, staleWarning: 36 } as const;

export const FACILITY_SCALE: Record<FacilityScale, number> = { small: 0.6, medium: 1.0, large: 1.4 };

export const BUSINESS_TYPES: readonly BusinessType[] = [
  'beverages',
  'food',
  'laundry',
  'stationery',
  'minimarket',
  'salon',
  'pharmacy',
];

export const SEGMENTS: readonly Segment[] = ['student', 'office', 'resident', 'commuter', 'health', 'general'];

export const COMPONENT_KEYS: readonly ComponentKey[] = [
  'demandFit',
  'accessibility',
  'competition',
  'supportingFacility',
  'risk',
];

// --- 1. Location Potential Score ----------------------------------------------

export const COMPONENT_WEIGHTS: Record<ComponentKey, number> = {
  demandFit: 0.35,
  accessibility: 0.2,
  competition: 0.2,
  supportingFacility: 0.15,
  risk: 0.1,
};

export const BAND_THRESHOLDS = {
  highlySuitable: 80,
  suitable: 70,
  moderatelySuitable: 60,
  risky: 50,
} as const;

/** PROPOSED: a component at or above this value is a strength; below it, a weakness. */
export const STRENGTH_THRESHOLD = 60;

/** Strengths and weaknesses reported per result. */
export const REPORTED_FACTORS = 3;

// --- 2. Business Type Recommendation -------------------------------------------

/** Baseline points a facility awards to each segment, before weighting. */
export const SEGMENT_POINTS: Partial<Record<FacilityKind, Partial<Record<Segment, number>>>> = {
  campus: { student: 35, office: 10, general: 10 },
  school: { student: 22, resident: 10 },
  office: { office: 30, general: 8 },
  government_office: { office: 30, general: 8 },
  housing: { resident: 28 },
  boarding_house: { student: 18, resident: 25 },
  transit: { commuter: 30 },
  hospital: { health: 38, office: 10 },
  mall: { general: 25, office: 15, commuter: 15 },
};

export const SEGMENT_WEIGHTS: Record<BusinessType, Record<Segment, number>> = {
  beverages: { student: 0.35, office: 0.25, resident: 0.1, commuter: 0.2, health: 0, general: 0.1 },
  food: { student: 0.2, office: 0.3, resident: 0.25, commuter: 0.15, health: 0, general: 0.1 },
  laundry: { student: 0.3, office: 0.05, resident: 0.5, commuter: 0, health: 0, general: 0.15 },
  stationery: { student: 0.55, office: 0.25, resident: 0.05, commuter: 0, health: 0, general: 0.15 },
  minimarket: { student: 0.15, office: 0.15, resident: 0.45, commuter: 0.1, health: 0, general: 0.15 },
  salon: { student: 0.1, office: 0.1, resident: 0.55, commuter: 0, health: 0, general: 0.25 },
  pharmacy: { student: 0.05, office: 0.1, resident: 0.4, commuter: 0.05, health: 0.3, general: 0.1 },
};

export const RECOMMENDATION = {
  primaryScore: 70,
  viableScore: 60,
  minConfidence: 60,
  maxListed: 3,
  equivalenceGap: 3,
} as const;

// --- 3. Competitor Analysis ----------------------------------------------------

export const COMPETITOR_RADIUS_METERS: Record<BusinessType, 800 | 1500> = {
  beverages: 800,
  food: 800,
  stationery: 800,
  minimarket: 800,
  laundry: 1500,
  salon: 1500,
  pharmacy: 1500,
};

/** Competitors beyond the primary radius count as secondary influence, capped at this weight. */
export const SECONDARY_COMPETITOR_WEIGHT_CAP = 0.25;

export const SIMILARITY_LEVEL = { direct: 1.0, close: 0.6, indirect: 0.3, none: 0 } as const;

/** PROPOSED: which facility kinds compete with each category, and how closely. */
export const SIMILARITY: Record<BusinessType, Partial<Record<FacilityKind, number>>> = {
  beverages: {
    cafe: SIMILARITY_LEVEL.direct,
    bubble_tea: SIMILARITY_LEVEL.close,
    food_court: SIMILARITY_LEVEL.indirect,
  },
  food: {
    restaurant: SIMILARITY_LEVEL.direct,
    fast_food: SIMILARITY_LEVEL.direct,
    food_court: SIMILARITY_LEVEL.direct,
    cafe: SIMILARITY_LEVEL.indirect,
  },
  laundry: { laundry: SIMILARITY_LEVEL.direct, dry_cleaning: SIMILARITY_LEVEL.close },
  stationery: {
    copyshop: SIMILARITY_LEVEL.direct,
    printer: SIMILARITY_LEVEL.direct,
    stationery_shop: SIMILARITY_LEVEL.direct,
  },
  minimarket: { convenience: SIMILARITY_LEVEL.direct, supermarket: SIMILARITY_LEVEL.close },
  salon: { hairdresser: SIMILARITY_LEVEL.direct, beauty: SIMILARITY_LEVEL.close },
  pharmacy: { pharmacy: SIMILARITY_LEVEL.direct, chemist: SIMILARITY_LEVEL.close },
};

export const OPERATING_HOURS_FACTOR = {
  strong: 1.0,
  partial: 0.6,
  minimal: 0.3,
  unknown: 0.8,
  closed: 0.1,
} as const;

/** PROPOSED: share of the business's own opening hours a competitor overlaps. */
export const HOURS_OVERLAP = { strong: 0.75, partial: 0.4 } as const;

export const DENSITY_BANDS: Record<800 | 1500, { moderate: number; high: number; veryHigh: number }> = {
  800: { moderate: 2, high: 5, veryHigh: 9 },
  1500: { moderate: 3, high: 7, veryHigh: 12 },
};

/** `T`: Demand Fit required to support one competitor-equivalent. */
export const DEMAND_PER_COMPETITOR: Record<BusinessType, number> = {
  beverages: 18,
  food: 16,
  laundry: 20,
  stationery: 22,
  minimarket: 18,
  salon: 22,
  pharmacy: 25,
};

export const SATURATION_THRESHOLDS = {
  healthy: 0.5,
  becomingSaturated: 1.0,
  saturated: 1.5,
  heavilySaturated: 2.0,
} as const;

/**
 * `decayPerSaturation` is 35 / 95: the curve leaves 0 at the same slope as the
 * straight line it replaces, so lightly contested places score as before, while
 * a crowded one decays towards 0 instead of hitting it at a ratio of 2.7.
 */
export const COMPETITION_SCORE = { base: 95, decayPerSaturation: 35 / 95 } as const;

export const VALIDATION_BONUS = {
  noCompetitors: -10,
  upToTwo: 5,
  upToFive: 0,
  moreThanFive: -5,
} as const;

// --- 4. Target Market Insight --------------------------------------------------

/**
 * PROPOSED: diminishing returns for facilities of one kind in one zone. The
 * first `freeCount` count fully; past that each further facility adds less, on a
 * logarithmic tail of width `scale`. Without this, a source that reports whole
 * city-centre counts floods every score at once.
 */
export const CROWDING = { freeCount: 3, scale: 5 } as const;

export const SEGMENT_CAP = 100;

export const SEGMENT_ROLE_THRESHOLDS = { primary: 70, secondary: 45, supporting: 25 } as const;

// --- 5. Business Simulation ----------------------------------------------------

export const DELIVERY = {
  businessTypes: ['laundry', 'food'] as readonly BusinessType[],
  zoneCWeight: 0.35,
  maxScoreGain: 5,
};

// --- PROPOSED: Accessibility, Supporting Facility Fit, Risk and Operability -----

/** Used wherever an input is unknown, so missing data is never scored as zero. */
export const NEUTRAL_SCORE = 50;

export const ACCESSIBILITY_WEIGHTS = { road: 0.35, transit: 0.25, walkability: 0.2, parking: 0.2 } as const;

export const ROAD_CLASS_SCORE: Record<RoadClass, number> = {
  primary: 100,
  secondary: 90,
  tertiary: 75,
  residential: 55,
  service: 30,
};

export const WALKABILITY = { base: 50, perFeature: 10 } as const;

export const PARKING = { base: 20, perSpace: 5, defaultCapacity: 10, radiusMeters: 300 } as const;

/** Points a supporting facility awards to each category, before weighting. */
export const SUPPORTING_POINTS: Partial<Record<FacilityKind, Record<BusinessType, number>>> = {
  atm: { beverages: 10, food: 10, laundry: 10, stationery: 10, minimarket: 10, salon: 10, pharmacy: 10 },
  bank: { beverages: 8, food: 8, laundry: 8, stationery: 12, minimarket: 8, salon: 8, pharmacy: 8 },
  marketplace: { beverages: 20, food: 25, laundry: 10, stationery: 10, minimarket: 10, salon: 15, pharmacy: 15 },
  convenience: { beverages: 12, food: 12, laundry: 12, stationery: 12, minimarket: 0, salon: 12, pharmacy: 12 },
  supermarket: { beverages: 12, food: 12, laundry: 12, stationery: 12, minimarket: 0, salon: 12, pharmacy: 12 },
  place_of_worship: { beverages: 8, food: 10, laundry: 5, stationery: 5, minimarket: 8, salon: 5, pharmacy: 5 },
  clinic: { beverages: 0, food: 5, laundry: 0, stationery: 5, minimarket: 5, salon: 0, pharmacy: 30 },
  government_office: { beverages: 5, food: 10, laundry: 0, stationery: 25, minimarket: 0, salon: 0, pharmacy: 0 },
};

export const SUPPORTING_CAP = 100;

export const RISK = {
  base: 100,
  waterwayNearMeters: 100,
  waterwayNearPenalty: 20,
  waterwayMidMeters: 300,
  waterwayMidPenalty: 10,
  industrialPenalty: 15,
  /** PROPOSED: neighbours customers avoid. A cemetery counts within 150 m, the rest within 300 m. */
  surroundingPenalty: { cemetery: 10, waste: 20, quarry: 15, military: 10, prison: 10 } as Record<
    DiscouragingSurrounding,
    number
  >,
  /** PROPOSED: the most those neighbours can take off together, so one bad corner cannot zero the component. */
  maxSurroundingPenalty: 30,
} as const;

/** PROPOSED: a mapped waterway this close raises the flood hard warning (proxy). */
export const FLOOD_WARNING_METERS = 50;

/** PROPOSED: stale-data warning when more than this share of dated records is over 36 months old. */
export const STALE_DATA_SHARE = 0.5;

// --- Confidence Score ------------------------------------------------------------

export const CONFIDENCE_WEIGHTS = {
  completeness: 0.4,
  freshness: 0.25,
  crossSourceValidation: 0.2,
  areaCoverage: 0.15,
} as const;

export const CONFIDENCE_READINGS = { high: 85, good: 70, moderate: 55, low: 40 } as const;

/** Below this confidence no definitive recommendation is given. */
export const CONFIDENCE_FLOOR = 40;

/** PROPOSED: all data comes from OpenStreetMap, so there is no second source to validate against yet. */
export const CROSS_SOURCE_VALIDATION_NEUTRAL = NEUTRAL_SCORE;

export const MARGIN = { base: 5, perConfidencePoint: 0.15 } as const;

/**
 * PROPOSED: facility groups a normally mapped area is expected to contain.
 * Data Completeness is the share of these groups present, plus a known road class.
 */
export const EXPECTED_FACILITY_GROUPS: readonly (readonly FacilityKind[])[] = [
  ['campus', 'school'],
  ['office', 'government_office'],
  ['housing', 'boarding_house'],
  ['transit'],
  [
    'cafe',
    'bubble_tea',
    'restaurant',
    'fast_food',
    'food_court',
    'laundry',
    'dry_cleaning',
    'copyshop',
    'printer',
    'stationery_shop',
    'convenience',
    'supermarket',
    'hairdresser',
    'beauty',
    'pharmacy',
    'chemist',
    'atm',
    'bank',
    'marketplace',
  ],
];
