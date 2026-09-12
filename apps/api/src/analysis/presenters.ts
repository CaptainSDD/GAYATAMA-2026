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

/** The POI snapshot a response was built from, plus whether site conditions could be loaded. */
export interface SourceSnapshot extends PoiSnapshot {
  siteAvailable: boolean;
}

// The prose below is user-facing copy, so it is Indonesian to match the
// interface. Field names, codes and enums stay English, as docs/api.md says.

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  demandFit: 'Kecocokan Permintaan',
  accessibility: 'Aksesibilitas',
  competition: 'Peluang Persaingan',
  supportingFacility: 'Fasilitas Pendukung',
  risk: 'Risiko & Operasional',
};

const SEGMENT_LABELS: Record<Segment, string> = {
  student: 'Pelajar & mahasiswa',
  office: 'Pekerja kantor',
  resident: 'Penghuni sekitar',
  commuter: 'Pengguna transportasi',
  health: 'Pengunjung fasilitas kesehatan',
  general: 'Pengunjung umum',
};

const SATURATION_WORDS: Record<SaturationReading, string> = {
  not_saturated: 'rendah',
  healthy: 'sehat',
  becoming_saturated: 'mulai naik',
  saturated: 'tinggi',
  heavily_saturated: 'sangat tinggi',
};

const DIFFERENTIATORS: Record<BusinessType, string> = {
  beverages: 'Bergantung pada orang yang lewat dan lalu-lalang pelajar',
  food: 'Melayani beberapa kelompok pelanggan, tapi persaingannya paling padat',
  laundry: 'Tidak terlalu bergantung pada orang lewat dibanding makanan atau minuman',
  stationery: 'Terikat erat pada sekolah dan kampus, jadi sepi saat libur',
  minimarket: 'Butuh modal stok dan ruang rak paling besar untuk buka',
  salon: 'Mengandalkan pelanggan tetap di sekitar, bukan orang yang kebetulan lewat',
  pharmacy: 'Butuh apoteker berizin dan fasilitas kesehatan di dekatnya',
};

const WARNING_MESSAGES: Record<WarningCode, string> = {
  flood_risk_proxy:
    'Ada sungai, kanal, atau saluran air terpetakan dalam radius 50 m. Ini perkiraan dari peta, bukan data banjir resmi: periksa riwayat banjir langsung di lokasi.',
  stale_data: 'Sebagian besar fasilitas terpetakan di sekitar sini belum diperbarui lebih dari 36 bulan.',
};

const whole = (value: number): string => Math.round(value).toString();

export function presentDataSource(source: SourceSnapshot) {
  return {
    provider: 'OpenStreetMap',
    attribution: '© OpenStreetMap contributors',
    licence: 'ODbL 1.0',
    fetchedAt: source.fetchedAt,
    cacheHit: source.cacheHit,
    stale: source.stale,
    siteConditions: source.siteAvailable ? 'available' : 'unavailable',
  };
}

function presentWarnings(warnings: readonly HardWarning[]) {
  return warnings.map(({ code }) => ({ code, message: WARNING_MESSAGES[code] }));
}

export function presentAnalysis(result: LocationScoreResult, location: LatLng, source: SourceSnapshot) {
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
      detail: `${COMPONENT_LABELS[component]} bernilai ${whole(value)}/100`,
    })),
    risks: result.weaknesses.map(({ component, value }) => ({
      factor: component,
      detail: `${COMPONENT_LABELS[component]} bernilai ${whole(value)}/100`,
    })),
    warnings: presentWarnings(result.warnings),
    evidence: result.evidence,
    dataSource: presentDataSource(source),
  };
}

function rationale(entry: RankedCategory, segments: SegmentScores): string {
  const segment = `${SEGMENT_LABELS[entry.dominantSegment]} bernilai ${whole(segments[entry.dominantSegment])}`;
  if (entry.status === 'needs_validation') {
    return `${segment}, tapi data fasilitas di sekitar lokasi ini belum lengkap`;
  }
  return `${segment}, dengan kejenuhan kompetitor ${SATURATION_WORDS[entry.saturationReading]} (${entry.saturationRatio.toFixed(2)})`;
}

function reason(entry: RankedCategory): string {
  const weakest = COMPONENT_KEYS.reduce((lowest, key) =>
    entry.components[key] < entry.components[lowest] ? key : lowest,
  );
  return `${COMPONENT_LABELS[weakest]} hanya ${whole(entry.components[weakest])}/100, komponen terlemahnya`;
}

export function presentRecommendation(result: RecommendationResult, location: LatLng, source: SourceSnapshot) {
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
    dataSource: presentDataSource(source),
  };
}

/** Facilities plus site conditions: everything the browser needs to rerun the engine locally. */
export function presentPois(evaluated: readonly EvaluatedFacility[], input: LocationInput, source: SourceSnapshot) {
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
    dataSource: presentDataSource(source),
  };
}
