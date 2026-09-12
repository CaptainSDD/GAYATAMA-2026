import type {
  Band,
  BusinessType,
  ComponentKey,
  ConfidenceReading,
  Density,
  FacilityKind,
  RecommendationStatus,
  SaturationReading,
  Segment,
  SegmentRole,
} from '@gayatama/scoring';
import { API_BASE_URL, ApiError } from './api';

// Every user-facing label in one place, so an Indonesian translation is a single-file change.

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  beverages: 'Beverages / coffee shop',
  food: 'Food stall / quick-service food',
  laundry: 'Laundry',
  stationery: 'Photocopy / printing / stationery',
  minimarket: 'Minimarket',
  salon: 'Salon / barbershop',
  pharmacy: 'Pharmacy',
};

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  demandFit: 'Demand Fit',
  accessibility: 'Accessibility',
  competition: 'Competition Opportunity',
  supportingFacility: 'Supporting Facility Fit',
  risk: 'Risk and Operability',
};

export const COMPONENT_DESCRIPTIONS: Record<ComponentKey, string> = {
  demandFit: 'Strength of the customer segments this business needs',
  accessibility: 'Road, public transport, walkability and parking',
  competition: 'Competitor saturation relative to demand',
  supportingFacility: 'Nearby facilities that support transactions',
  risk: 'Flood and land-use proxies from the map',
};

export const SEGMENT_LABELS: Record<Segment, string> = {
  student: 'Student',
  office: 'Office worker',
  resident: 'Resident',
  commuter: 'Commuter',
  health: 'Health visitor',
  general: 'General visitor',
};

export const SEGMENT_ROLE_LABELS: Record<SegmentRole, string> = {
  primary: 'Primary target',
  secondary: 'Secondary target',
  supporting: 'Supporting target',
  insignificant: 'Not significant',
};

export const BAND_LABELS: Record<Band, string> = {
  highly_suitable: 'Highly suitable',
  suitable: 'Suitable',
  moderately_suitable: 'Moderately suitable',
  risky: 'Risky',
  not_recommended: 'Not recommended',
};

export const STATUS_LABELS: Record<RecommendationStatus, string> = {
  primary: 'Primary recommendation',
  alternative: 'Viable alternative',
  needs_validation: 'Verify on site first',
  not_recommended: 'Not recommended',
};

export const CONFIDENCE_LABELS: Record<ConfidenceReading, string> = {
  high: 'high',
  good: 'good',
  moderate: 'moderate',
  low: 'low',
  very_low: 'very low',
};

export const DENSITY_LABELS: Record<Density, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very high',
};

export const SATURATION_LABELS: Record<SaturationReading, string> = {
  not_saturated: 'Not yet saturated',
  healthy: 'Healthy competition',
  becoming_saturated: 'Becoming saturated',
  saturated: 'Saturated',
  heavily_saturated: 'Heavily saturated',
};

export const FACILITY_KIND_LABELS: Record<FacilityKind, string> = {
  campus: 'Campus',
  school: 'School',
  office: 'Office',
  government_office: 'Government office',
  housing: 'Housing',
  boarding_house: 'Boarding house',
  transit: 'Transit stop',
  hospital: 'Hospital',
  mall: 'Mall',
  cafe: 'Café',
  bubble_tea: 'Bubble tea',
  restaurant: 'Restaurant',
  fast_food: 'Fast food',
  food_court: 'Food court',
  laundry: 'Laundry',
  dry_cleaning: 'Dry cleaning',
  copyshop: 'Copy shop',
  printer: 'Printer',
  stationery_shop: 'Stationery shop',
  convenience: 'Convenience store',
  supermarket: 'Supermarket',
  hairdresser: 'Hairdresser',
  beauty: 'Beauty salon',
  pharmacy: 'Pharmacy',
  chemist: 'Chemist',
  atm: 'ATM',
  bank: 'Bank',
  marketplace: 'Market',
  place_of_worship: 'Place of worship',
  clinic: 'Clinic',
  parking: 'Parking',
  other: 'Other',
};

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_ERROR;
  switch (error.code) {
    case 'INSUFFICIENT_DATA': {
      const confidence = error.details?.confidence;
      const suffix = typeof confidence === 'number' ? ` (confidence ${confidence}/100)` : '';
      return `There is too little map data around this point for a reliable answer${suffix}. GAYATAMA declines to guess rather than give a confident wrong score.`;
    }
    case 'VALIDATION_FAILED':
      return 'This location can’t be analysed. GAYATAMA covers locations in Indonesia.';
    case 'RATE_LIMITED':
      return 'Too many requests in the last minute. Wait a moment, then try again.';
    case 'UPSTREAM_TIMEOUT':
      return 'OpenStreetMap data is temporarily unavailable for this area. Try again shortly.';
    case 'NETWORK_ERROR':
      return import.meta.env.DEV
        ? `Can’t reach the API at ${API_BASE_URL}. Is it running? Start it with npm run dev:api.`
        : 'Can’t reach the GAYATAMA server. Check your connection and try again.';
    default:
      return error.message || GENERIC_ERROR;
  }
}

/** Errors a retry cannot fix: the request itself is invalid, or the area lacks data. */
export function isRetryable(error: unknown): boolean {
  return !(error instanceof ApiError && (error.code === 'VALIDATION_FAILED' || error.code === 'INSUFFICIENT_DATA'));
}
