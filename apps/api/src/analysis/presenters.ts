import {
  COMPONENT_KEYS,
  COMPONENT_WEIGHTS,
  SEGMENTS,
  evaluateFacilities,
  similarity,
  type ComponentKey,
  type DiscouragingSurrounding,
  type EvaluatedFacility,
  type Facility,
  type HardWarning,
  type LatLng,
  type LocationInput,
  type LocationScoreResult,
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
  notRecommendedReason,
  recommendationDifferentiator,
  recommendationRationale,
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
