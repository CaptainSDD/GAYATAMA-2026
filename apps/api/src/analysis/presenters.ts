import {
  COMPONENT_KEYS,
  COMPONENT_WEIGHTS,
  SEGMENTS,
  type BusinessType,
  type ComponentKey,
  type EvaluatedFacility,
  type HardWarning,
  type LatLng,
  type LocationInput,
  type LocationScoreResult,
  type RankedCategory,
  type RecommendationResult,
  type SaturationReading,
  type Segment,
  type SegmentScores,
  type WarningCode,
} from '@gayatama/scoring';
import type { PoiSnapshot } from '../poi/poi.service';

// Maps engine results onto the response shapes in docs/api.md.

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  demandFit: 'Demand Fit',
  accessibility: 'Accessibility',
  competition: 'Competition Opportunity',
  supportingFacility: 'Supporting Facility Fit',
  risk: 'Risk and Operability',
};

const SEGMENT_LABELS: Record<Segment, string> = {
  student: 'Student',
  office: 'Office',
  resident: 'Resident',
  commuter: 'Commuter',
  health: 'Health',
  general: 'General',
};

const SATURATION_WORDS: Record<SaturationReading, string> = {
  not_saturated: 'low',
  healthy: 'healthy',
  becoming_saturated: 'rising',
  saturated: 'high',
  heavily_saturated: 'very high',
};

const DIFFERENTIATORS: Record<BusinessType, string> = {
  beverages: 'Depends on passing trade and student footfall',
  food: 'Serves several customer segments, but faces the densest competition',
  laundry: 'Lower footfall dependence than food or beverages',
  stationery: 'Tied closely to schools and campuses, so quieter during holidays',
  minimarket: 'Needs the most stock and shelf space to open',
  salon: 'Relies on repeat local customers rather than passing trade',
  pharmacy: 'Needs a licensed pharmacist and nearby health facilities',
};

const WARNING_MESSAGES: Record<WarningCode, string> = {
  flood_risk_proxy:
    'A mapped river, canal or stream is within 50 m. This is a proxy, not flood data: check the flood history on site.',
  stale_data: 'Most mapped facilities nearby have not been updated in over 36 months.',
};

const whole = (value: number): string => Math.round(value).toString();

export function presentDataSource(snapshot: PoiSnapshot) {
  return {
    provider: 'OpenStreetMap',
    attribution: '© OpenStreetMap contributors',
    licence: 'ODbL 1.0',
    fetchedAt: snapshot.fetchedAt,
    cacheHit: snapshot.cacheHit,
    stale: snapshot.stale,
  };
}

function presentWarnings(warnings: readonly HardWarning[]) {
  return warnings.map(({ code }) => ({ code, message: WARNING_MESSAGES[code] }));
}

export function presentAnalysis(result: LocationScoreResult, location: LatLng, snapshot: PoiSnapshot) {
  const { competition } = result;
  return {
    modelVersion: result.modelVersion,
    location,
    businessType: result.businessType,
    score: result.score,
    components: Object.fromEntries(
      COMPONENT_KEYS.map((key) => [key, { value: result.components[key], weight: COMPONENT_WEIGHTS[key] }]),
    ),
    segments: Object.fromEntries(
      SEGMENTS.map((segment) => [segment, { score: result.segments[segment], role: result.segmentRoles[segment] }]),
    ),
    competition: {
      rawCount: competition.rawCount,
      equivalentCount: competition.equivalentCount,
      density: competition.density,
      saturationRatio: competition.saturationRatio,
      reading: competition.reading,
      radiusMeters: competition.radiusMeters,
      strongest: competition.competitors.slice(0, 5).map((competitor) => ({
        id: competitor.facility.id,
        name: competitor.facility.name ?? null,
        kind: competitor.facility.kind,
        distanceMeters: Math.round(competitor.distanceMeters),
        contribution: competitor.contribution,
      })),
    },
    strengths: result.strengths.map(({ component, value }) => ({
      factor: component,
      detail: `${COMPONENT_LABELS[component]} scores ${whole(value)}/100`,
    })),
    risks: result.weaknesses.map(({ component, value }) => ({
      factor: component,
      detail: `${COMPONENT_LABELS[component]} scores ${whole(value)}/100`,
    })),
    warnings: presentWarnings(result.warnings),
    evidence: result.evidence,
    dataSource: presentDataSource(snapshot),
  };
}

function rationale(entry: RankedCategory, segments: SegmentScores): string {
  const segment = `${SEGMENT_LABELS[entry.dominantSegment]} score ${whole(segments[entry.dominantSegment])}`;
  if (entry.status === 'needs_validation') return `${segment}, but facility data around this location is incomplete`;
  return `${segment} with ${SATURATION_WORDS[entry.saturationReading]} competitor saturation (${entry.saturationRatio.toFixed(2)})`;
}

function reason(entry: RankedCategory): string {
  const weakest = COMPONENT_KEYS.reduce((lowest, key) =>
    entry.components[key] < entry.components[lowest] ? key : lowest,
  );
  return `${COMPONENT_LABELS[weakest]} is ${whole(entry.components[weakest])}/100, its weakest component`;
}

export function presentRecommendation(result: RecommendationResult, location: LatLng, snapshot: PoiSnapshot) {
  return {
    modelVersion: result.modelVersion,
    location,
    recommendations: result.recommendations.map((entry) => ({
      businessType: entry.businessType,
      score: entry.score,
      status: entry.status,
      dominantSegment: entry.dominantSegment,
      rationale: rationale(entry, result.segments),
      differentiator: DIFFERENTIATORS[entry.businessType],
    })),
    equivalent: result.equivalent,
    notRecommended: result.notRecommended.map((entry) => ({
      businessType: entry.businessType,
      score: entry.score,
      status: entry.status,
      reason: reason(entry),
    })),
    warnings: presentWarnings(result.warnings),
    segments: result.segments,
    dataSource: presentDataSource(snapshot),
  };
}

/** Facilities plus site conditions: everything the browser needs to rerun the engine locally. */
export function presentPois(evaluated: readonly EvaluatedFacility[], input: LocationInput, snapshot: PoiSnapshot) {
  return {
    location: input.location,
    asOf: input.asOf,
    site: input.site ?? {},
    facilities: [...evaluated]
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .map((entry) => ({
        ...entry.facility,
        distanceMeters: entry.distanceMeters,
        zone: entry.zone,
        dataQuality: entry.dataQuality,
        accessFactor: entry.accessFactor,
      })),
    dataSource: presentDataSource(snapshot),
  };
}
