import {
  COMPONENT_KEYS,
  COMPONENT_WEIGHTS,
  RECOMMENDATION,
  SEGMENTS,
  evaluateFacilities,
  recommendationStatus,
  similarity,
  type BusinessType,
  type ComparisonResult,
  type ComponentKey,
  type DiscouragingSurrounding,
  type EvaluatedFacility,
  type Facility,
  type FacilityKind,
  type HardWarning,
  type LatLng,
  type LocationInput,
  type LocationScoreResult,
  type RankedCategory,
  type RecommendationResult,
  type WarningCode,
} from '@gayatama/scoring';
import { OVERTURE_ID_PREFIX, OVERTURE_KINDS, OVERTURE_SOURCE } from '../overture/overture-place';
import type { PlaceCountsLookup } from '../places/place-counts.service';
import { GOOGLE_COUNTED_KINDS } from '../places/place-types';
import type { PoiSnapshot } from '../poi/poi.service';
import {
  buildAnalysisNarrative,
  type AnalysisNarrative,
  comparisonHighlight,
  comparisonReason,
  indicatorLevel,
  locationAlternative,
  locationVerdict,
  notRecommendedReason,
  opportunityLevel,
  recommendationDifferentiator,
  recommendationRationale,
  riskLevel,
  trafficLevel,
  type ComparedLocation,
  type LocationLabel,
} from './narratives';

// Maps engine results onto the response shapes in docs/api.md.

/** Google counts for a response: used, or the reason OpenStreetMap was used for every kind. */
export type PlacesSource = PlaceCountsLookup | { status: 'not_requested' };

/** The POI snapshot a response was built from, whether site conditions could be loaded, and Google counts. */
export interface SourceSnapshot extends PoiSnapshot {
  siteAvailable: boolean;
  places: PlacesSource;
}

// The prose below is user-facing copy, so it is Indonesian to match the
// interface. Field names, codes and enums stay English, as docs/api.md says.
const OPENSTREETMAP_SOURCE = 'openstreetmap';

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  demandFit: 'Potensi Pelanggan',
  accessibility: 'Kemudahan Akses',
  competition: 'Kondisi Persaingan',
  supportingFacility: 'Fasilitas Pendukung',
  risk: 'Keamanan Operasional',
};

const WARNING_MESSAGES: Record<WarningCode, string> = {
  flood_risk_proxy:
    'Ada sungai, kanal, atau saluran air terpetakan dalam radius 50 m. Ini perkiraan dari peta, bukan data banjir resmi: periksa riwayat banjir langsung di lokasi.',
  unsuitable_surroundings: 'Ada tetangga yang bisa membuat pelanggan enggan datang, terpetakan dekat titik ini.',
  stale_data: 'Sebagian besar fasilitas terpetakan di sekitar sini belum diperbarui lebih dari 36 bulan.',
};

const SURROUNDING_LABELS: Record<DiscouragingSurrounding, string> = {
  cemetery: 'kuburan',
  waste: 'TPA atau TPS sampah',
  quarry: 'tambang galian',
  military: 'kawasan militer',
  prison: 'lembaga pemasyarakatan',
};

/** The warning names what was found: a penalty on its own explains nothing. */
function listSurroundings(surroundings: readonly DiscouragingSurrounding[]): string {
  const labels = surroundings.map((kind) => SURROUNDING_LABELS[kind]);
  const last = labels[labels.length - 1] ?? '';
  return labels.length <= 1 ? last : `${labels.slice(0, -1).join(', ')} dan ${last}`;
}

const ZONE_ORDER = ['a', 'b', 'c'];

const whole = (value: number): string => Math.round(value).toString();

function facilitySource(facility: Facility): string {
  return facility.id.startsWith(OVERTURE_ID_PREFIX) ? OVERTURE_SOURCE : OPENSTREETMAP_SOURCE;
}

/** CDLA Permissive 2.0 asks for its text to accompany shared data; Overture asks to be credited. */
function presentOverture(overture: PoiSnapshot['overture']) {
  if (overture === null) return null;
  return {
    provider: 'Overture Maps Foundation',
    attribution: 'Overture Maps Foundation',
    licence: 'CDLA-Permissive-2.0',
    release: overture.release,
    kinds: [...OVERTURE_KINDS],
  };
}

/** Google Maps Platform policies require "Google Maps" attribution wherever its counts feed a result. */
function presentPlaces(places: PlacesSource) {
  if (places.status !== 'used') {
    return { provider: 'Google Maps', status: places.status, attribution: null, fetchedAt: null, cacheHit: null, kinds: [] };
  }
  return {
    provider: 'Google Maps',
    status: places.status,
    attribution: 'Google Maps',
    fetchedAt: places.fetchedAt,
    cacheHit: places.cacheHit,
    kinds: [...GOOGLE_COUNTED_KINDS],
  };
}

export function presentDataSource(source: SourceSnapshot) {
  const geoapify = source.via === 'geoapify';
  return {
    provider: geoapify ? 'Geoapify / OpenStreetMap' : 'OpenStreetMap',
    attribution: geoapify ? '© OpenStreetMap contributors · Powered by Geoapify' : '© OpenStreetMap contributors',
    licence: 'ODbL 1.0',
    fetchedAt: source.fetchedAt,
    cacheHit: source.cacheHit,
    stale: source.stale,
    via: source.via,
    siteConditions: source.siteAvailable ? 'available' : 'unavailable',
    places: presentPlaces(source.places),
    overture: presentOverture(source.overture),
  };
}

function presentWarnings(warnings: readonly HardWarning[]) {
  return warnings.map(({ code, surroundings }) => ({
    code,
    message:
      surroundings === undefined || surroundings.length === 0
        ? WARNING_MESSAGES[code]
        : `${WARNING_MESSAGES[code]} Yang terpetakan di dekat sini: ${listSurroundings(surroundings)}.`,
  }));
}

export function presentAnalysis(
  result: LocationScoreResult,
  input: LocationInput,
  source: SourceSnapshot,
  narrative: AnalysisNarrative = buildAnalysisNarrative(result, {
    siteAvailable: source.siteAvailable,
    stale: source.stale,
    placesStatus: source.places.status,
  }),
) {
  const { competition } = result;
  const namedCompetitors = evaluateFacilities({
    ...input,
    // Google counts replace these facilities for scoring, but the mapped
    // records are still useful for answering "who are the competitors?".
    facilities: source.facilities,
    facilityCounts: [],
  })
    .filter(
      (entry) =>
        entry.distanceMeters <= competition.radiusMeters &&
        similarity(result.businessType, entry.facility) > 0 &&
        entry.facility.name?.trim(),
    )
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 5)
    .map((entry) => ({
      id: entry.facility.id,
      name: entry.facility.name as string,
      kind: entry.facility.kind,
      zone: entry.zone,
      distanceMeters: Math.round(entry.distanceMeters),
      source: facilitySource(entry.facility),
    }));
  return {
    modelVersion: result.modelVersion,
    location: input.location,
    businessType: result.businessType,
    score: result.score,
    components: Object.fromEntries(
      COMPONENT_KEYS.map((key) => [
        key,
        {
          value: result.components[key],
          weight: COMPONENT_WEIGHTS[key],
          availability:
            !source.siteAvailable && key === 'risk'
              ? 'unavailable'
              : !source.siteAvailable && key === 'accessibility'
                ? 'partial'
                : 'available',
        },
      ]),
    ),
    accessibility: {
      value: result.accessibility.value,
      road: result.accessibility.road,
      transit: result.accessibility.transit,
      walkability: result.accessibility.walkability,
      parking: result.accessibility.parking,
      siteInputsAvailable: source.siteAvailable,
    },
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
      // A counted group has no single position, so its distance is null and its zone says where it lies.
      strongest: competition.competitors.slice(0, 5).map((competitor) => ({
        id: competitor.facility.id,
        name: competitor.facility.name ?? null,
        kind: competitor.facility.kind,
        zone: competitor.zone,
        distanceMeters: competitor.countedFrom === undefined ? Math.round(competitor.distanceMeters) : null,
        count: competitor.count,
        source: competitor.countedFrom ?? facilitySource(competitor.facility),
        contribution: competitor.contribution,
      })),
      namedCompetitors,
    },
    strengths: result.strengths
      .filter(({ component }) => source.siteAvailable || component !== 'risk')
      .map(({ component, value }) => ({
        factor: component,
        detail: `${COMPONENT_LABELS[component]} bernilai ${whole(value)}/100`,
      })),
    risks: result.weaknesses
      .filter(({ component }) => source.siteAvailable || component !== 'risk')
      .map(({ component, value }) => ({
        factor: component,
        detail: `${COMPONENT_LABELS[component]} bernilai ${whole(value)}/100`,
      })),
    warnings: presentWarnings(result.warnings),
    evidence: result.evidence,
    dataSource: presentDataSource(source),
    narrative,
  };
}

export type PresentedAnalysis = ReturnType<typeof presentAnalysis>;

export function presentRecommendation(result: RecommendationResult, location: LatLng, source: SourceSnapshot) {
  return {
    modelVersion: result.modelVersion,
    location,
    recommendations: result.recommendations.map((entry) => ({
      businessType: entry.businessType,
      score: entry.score,
      status: entry.status,
      dominantSegment: entry.dominantSegment,
      rationale: recommendationRationale(entry),
      differentiator: recommendationDifferentiator(entry.businessType),
    })),
    equivalent: result.equivalent,
    notRecommended: result.notRecommended.map((entry) => ({
      businessType: entry.businessType,
      score: entry.score,
      status: entry.status,
      reason: notRecommendedReason(entry),
    })),
    warnings: presentWarnings(result.warnings),
    segments: result.segments,
    dataSource: presentDataSource(source),
  };
}

/** The ranking shape the narrative builders take, from a full per-category result. */
function asRankedCategory(entry: LocationScoreResult): RankedCategory {
  return {
    businessType: entry.businessType,
    score: entry.score,
    status: recommendationStatus(entry.score.value, entry.confidence.value) ?? 'not_recommended',
    dominantSegment: entry.dominantSegment,
    components: entry.components,
    saturationRatio: entry.competition.saturationRatio,
    saturationReading: entry.competition.reading,
  };
}

/**
 * Every category side by side, for a visitor who has not chosen a business type
 * yet. Scores come from the same engine as `/analysis`; the levels are rule-based
 * readings of those scores, so a card can be scanned without reading five numbers.
 */
export function presentComparison(result: ComparisonResult, location: LatLng, source: SourceSnapshot) {
  const leader = result.categories[0];
  const categories = result.categories.map((entry, index) => {
    const ranked = asRankedCategory(entry);
    return {
      rank: index + 1,
      businessType: entry.businessType,
      score: entry.score,
      status: ranked.status,
      recommended: ranked.status !== 'not_recommended',
      components: Object.fromEntries(
        COMPONENT_KEYS.map((key) => [key, { value: entry.components[key], weight: COMPONENT_WEIGHTS[key] }]),
      ),
      targetMarket: {
        segment: entry.dominantSegment,
        level: indicatorLevel(entry.components.demandFit),
      },
      supportingFacility: {
        value: entry.components.supportingFacility,
        level: indicatorLevel(entry.components.supportingFacility),
      },
      competition: {
        rawCount: entry.competition.rawCount,
        equivalentCount: entry.competition.equivalentCount,
        density: entry.competition.density,
        saturationRatio: entry.competition.saturationRatio,
        reading: entry.competition.reading,
        radiusMeters: entry.competition.radiusMeters,
      },
      // The engine scores no category on traffic or opportunity; both are read
      // from components it did score. See narratives.ts for the weights.
      opportunityLevel: opportunityLevel(entry.score.value, entry.components.competition),
      trafficLevel: trafficLevel(entry.components.demandFit, entry.accessibility.transit),
      riskLevel: riskLevel(entry.components.risk, entry.warnings, source.siteAvailable),
      reason: comparisonReason(ranked),
      differentiator: recommendationDifferentiator(entry.businessType),
    };
  });

  return {
    modelVersion: result.modelVersion,
    location,
    confidence: { value: result.confidence.value, reading: result.confidence.reading },
    topChoice: leader?.businessType ?? null,
    highlight:
      leader === undefined
        ? 'Belum ada jenis usaha yang bisa dibandingkan di lokasi ini.'
        : comparisonHighlight(asRankedCategory(leader), leader.accessibility.value, source.siteAvailable),
    // Accessibility and operating risk do not depend on the business type, so
    // they are reported once instead of repeated on all seven cards.
    shared: {
      accessibility: {
        value: leader?.accessibility.value ?? 0,
        level: indicatorLevel(leader?.accessibility.value ?? 0),
        siteInputsAvailable: source.siteAvailable,
      },
      segments: Object.fromEntries(
        SEGMENTS.map((segment) => [
          segment,
          { score: result.segments[segment], role: result.segmentRoles[segment] },
        ]),
      ),
      evidence: leader?.evidence ?? { facilityCount: 0, zones: { a: 0, b: 0, c: 0 } },
    },
    categories,
    equivalent: result.equivalent,
    warnings: presentWarnings(result.warnings),
    dataSource: presentDataSource(source),
  };
}

/**
 * Landmarks a reader recognises, grouped the way they would describe an area.
 * Counted separately from the score: the engine already weighs these, but "what
 * is actually around here" is the question a site visit answers.
 */
const LANDMARK_GROUPS: readonly { id: string; label: string; kinds: readonly FacilityKind[] }[] = [
  { id: 'education', label: 'Sekolah & kampus', kinds: ['campus', 'school'] },
  { id: 'office', label: 'Kantor', kinds: ['office', 'government_office'] },
  { id: 'residential', label: 'Permukiman & kos', kinds: ['housing', 'boarding_house'] },
  { id: 'retail', label: 'Mal & pasar', kinds: ['mall', 'marketplace'] },
  { id: 'transit', label: 'Halte & stasiun', kinds: ['transit'] },
  { id: 'health', label: 'Rumah sakit & klinik', kinds: ['hospital', 'clinic'] },
];

function presentLandmarks(input: LocationInput) {
  const evaluated = evaluateFacilities(input);
  return LANDMARK_GROUPS.map((group) => {
    let count = 0;
    let nearestMeters: number | null = null;
    for (const entry of evaluated) {
      if (entry.facility.closed || !group.kinds.includes(entry.facility.kind)) continue;
      count += entry.count;
      // A counted zone has no single position, so only mapped places can be "nearest".
      if (entry.countedFrom === undefined && (nearestMeters === null || entry.distanceMeters < nearestMeters)) {
        nearestMeters = entry.distanceMeters;
      }
    }
    return {
      id: group.id,
      label: group.label,
      count,
      nearestMeters: nearestMeters === null ? null : Math.round(nearestMeters),
    };
  });
}

/** One side of a two-location comparison, already scored. */
export interface ScoredLocation {
  label: LocationLabel;
  result: LocationScoreResult;
  input: LocationInput;
  source: SourceSnapshot;
}

function presentComparedSide({ label, result, input, source }: ScoredLocation) {
  return {
    label,
    location: input.location,
    score: result.score,
    status: recommendationStatus(result.score.value, result.confidence.value) ?? 'not_recommended',
    confidence: { value: result.confidence.value, reading: result.confidence.reading },
    components: Object.fromEntries(
      COMPONENT_KEYS.map((key) => [key, { value: result.components[key], weight: COMPONENT_WEIGHTS[key] }]),
    ),
    targetMarket: {
      segment: result.dominantSegment,
      level: indicatorLevel(result.components.demandFit),
    },
    segments: Object.fromEntries(
      SEGMENTS.map((segment) => [segment, { score: result.segments[segment], role: result.segmentRoles[segment] }]),
    ),
    supportingFacility: {
      value: result.components.supportingFacility,
      level: indicatorLevel(result.components.supportingFacility),
    },
    landmarks: presentLandmarks(input),
    /** Class of the nearest road; `null` when site conditions could not be loaded. */
    mainRoad: input.site?.roadClass ?? null,
    competition: {
      rawCount: result.competition.rawCount,
      equivalentCount: result.competition.equivalentCount,
      density: result.competition.density,
      saturationRatio: result.competition.saturationRatio,
      reading: result.competition.reading,
      radiusMeters: result.competition.radiusMeters,
    },
    accessibility: {
      value: result.accessibility.value,
      road: result.accessibility.road,
      transit: result.accessibility.transit,
      walkability: result.accessibility.walkability,
      parking: result.accessibility.parking,
      level: indicatorLevel(result.accessibility.value),
      siteInputsAvailable: source.siteAvailable,
    },
    opportunityLevel: opportunityLevel(result.score.value, result.components.competition),
    trafficLevel: trafficLevel(result.components.demandFit, result.accessibility.transit),
    riskLevel: riskLevel(result.components.risk, result.warnings, source.siteAvailable),
    strengths: result.strengths.map(({ component, value }) => ({ component, value })),
    weaknesses: result.weaknesses.map(({ component, value }) => ({ component, value })),
    reason: comparisonReason(asRankedCategory(result)),
    evidence: result.evidence,
    warnings: presentWarnings(result.warnings),
    dataSource: presentDataSource(source),
  };
}

/**
 * Two candidate sites for one category, side by side. Both run through the same
 * engine with the same weights, so the gap between them decomposes exactly:
 * every component's weighted difference sums to the difference in score.
 */
export function presentLocationComparison(businessType: BusinessType, a: ScoredLocation, b: ScoredLocation) {
  const sides = { a: presentComparedSide(a), b: presentComparedSide(b) };
  const difference = a.result.score.value - b.result.score.value;

  // Operating risk is a neutral placeholder when site conditions failed to load,
  // so a gap there measures the missing data, not the two places. It still counts
  // towards the score — the engine used it — but it must not be named as a reason.
  const riskComparable = a.source.siteAvailable && b.source.siteAvailable;

  // Weighted, not raw: a 10-point gap on demand fit moves the score more than
  // the same gap on operating risk, because the weights differ.
  const decidingFactors = COMPONENT_KEYS.map((component) => {
    const delta = a.result.components[component] - b.result.components[component];
    return {
      component,
      a: a.result.components[component],
      b: b.result.components[component],
      delta,
      weightedDelta: delta * COMPONENT_WEIGHTS[component],
      favours: delta > 0 ? ('a' as const) : delta < 0 ? ('b' as const) : null,
      comparable: component !== 'risk' || riskComparable,
    };
  }).sort((x, y) => Math.abs(y.weightedDelta) - Math.abs(x.weightedDelta));

  const tied = Math.abs(difference) <= RECOMMENDATION.equivalenceGap;
  const winnerKey = difference >= 0 ? 'a' : 'b';
  const loserKey = winnerKey === 'a' ? 'b' : 'a';
  const asCompared = (side: ScoredLocation): ComparedLocation => ({
    label: side.label,
    score: side.result.score.value,
    dominantSegment: side.result.dominantSegment,
    components: side.result.components,
  });
  const winner = asCompared(winnerKey === 'a' ? a : b);
  const loser = asCompared(loserKey === 'a' ? a : b);

  const advantagesOf = (side: 'a' | 'b', limit: number) =>
    decidingFactors
      .filter((factor) => factor.comparable && factor.favours === side)
      .slice(0, limit)
      .map((factor) => factor.component);
  const deciding = advantagesOf(winnerKey, 3);
  const loserAdvantages = advantagesOf(loserKey, 2);

  return {
    modelVersion: a.result.modelVersion,
    businessType,
    locations: sides,
    verdict: {
      /** `null` when the gap is inside the model's equivalence threshold. */
      winner: tied ? null : winnerKey,
      tied,
      difference: Math.abs(difference),
      equivalenceGap: RECOMMENDATION.equivalenceGap,
      decidingFactors,
      summary: locationVerdict(businessType, winner, loser, deciding, tied),
      alternative: locationAlternative({
        winner,
        loser,
        winnerAdvantages: deciding,
        loserAdvantages,
        tied,
      }),
    },
  };
}

/** Facilities, counted facilities and site conditions: everything the browser needs to rerun the engine locally. */
export function presentPois(evaluated: readonly EvaluatedFacility[], input: LocationInput, source: SourceSnapshot) {
  return {
    location: input.location,
    asOf: input.asOf,
    site: input.site ?? {},
    facilities: evaluated
      .filter((entry) => entry.countedFrom === undefined)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .map((entry) => ({
        ...entry.facility,
        distanceMeters: entry.distanceMeters,
        zone: entry.zone,
        dataQuality: entry.dataQuality,
        accessFactor: entry.accessFactor,
      })),
    facilityCounts: evaluated
      .flatMap((entry) =>
        entry.countedFrom === undefined
          ? []
          : [
              {
                kind: entry.facility.kind,
                zone: entry.zone,
                count: entry.count,
                scale: entry.facility.scale ?? 'medium',
                source: entry.countedFrom,
                dataQuality: entry.dataQuality,
              },
            ],
      )
      .sort((a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone)),
    dataSource: presentDataSource(source),
  };
}
