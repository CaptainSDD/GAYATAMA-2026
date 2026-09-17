import type {
  BusinessType,
  ComponentKey,
  Components,
  HardWarning,
  LocationScoreResult,
  RankedCategory,
  SaturationReading,
  Segment,
} from '@gayatama/scoring';

/**
 * User-facing explanation layer. Scoring stays deterministic in
 * @gayatama/scoring; this module turns the result into plain Indonesian.
 * A future LLM integration can replace these builders without changing the
 * score calculation or the response fields consumed by the web app.
 */

const BUSINESS_LABELS: Record<BusinessType, string> = {
  beverages: 'minuman atau kedai kopi',
  food: 'warung makan atau makanan cepat saji',
  laundry: 'laundry',
  stationery: 'fotokopi, percetakan, atau ATK',
  minimarket: 'minimarket',
  salon: 'salon atau barbershop',
  pharmacy: 'apotek',
};

const SEGMENT_LABELS = {
  student: 'pelajar dan mahasiswa',
  office: 'pekerja kantor',
  resident: 'penghuni sekitar',
  commuter: 'pengguna transportasi',
  health: 'pengunjung fasilitas kesehatan',
  general: 'pengunjung umum',
} as const;

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  demandFit: 'potensi pelanggan',
  accessibility: 'kemudahan akses',
  competition: 'kondisi persaingan',
  supportingFacility: 'fasilitas pendukung',
  risk: 'keamanan operasional',
};

const SATURATION_SENTENCES: Record<SaturationReading, string> = {
  not_saturated: 'Permintaan di area ini belum cukup terbukti dibanding sedikitnya pesaing.',
  healthy: 'Jumlah pesaing masih seimbang dengan potensi permintaan.',
  becoming_saturated: 'Persaingan mulai padat dan perlu dibedakan lewat harga atau layanan.',
  saturated: 'Persaingan sudah padat dan dapat menekan peluang usaha baru.',
  heavily_saturated: 'Persaingan sangat padat dibanding potensi permintaan yang terdeteksi.',
};

const BAND_HEADLINES = {
  highly_suitable: 'sangat cocok',
  suitable: 'cocok',
  moderately_suitable: 'cukup cocok',
  risky: 'perlu dipertimbangkan dengan hati-hati',
  not_recommended: 'belum disarankan',
} as const;

const DIFFERENTIATORS: Record<BusinessType, string> = {
  beverages: 'Keberhasilannya banyak dipengaruhi orang yang lewat dan aktivitas pelajar.',
  food: 'Bisa melayani beberapa kelompok pelanggan, tetapi persaingannya cenderung paling ramai.',
  laundry: 'Lebih mengandalkan penghuni sekitar daripada orang yang hanya lewat.',
  stationery: 'Sangat terkait dengan aktivitas sekolah dan kampus sehingga perlu mengantisipasi masa libur.',
  minimarket: 'Membutuhkan modal stok dan ruang penyimpanan yang lebih besar.',
  salon: 'Lebih mengandalkan pelanggan tetap di sekitar lokasi.',
  pharmacy: 'Memerlukan perizinan tenaga kefarmasian dan akses ke kelompok pelanggan yang tepat.',
};

export interface NarrativeContext {
  siteAvailable: boolean;
  stale: boolean;
  placesStatus: string;
}

export interface AnalysisNarrative {
  headline: string;
  summary: string;
  positives: string[];
  cautions: string[];
  nextSteps: string[];
  provisional: boolean;
  generatedBy: 'ai' | 'template';
}

export function buildAnalysisNarrative(
  result: LocationScoreResult,
  context: NarrativeContext,
): AnalysisNarrative {
  const business = BUSINESS_LABELS[result.businessType];
  const provisional =
    !context.siteAvailable || context.stale || context.placesStatus === 'unavailable' || context.placesStatus === 'not_configured';
  const positives: string[] = [];
  const cautions: string[] = [];
  const nextSteps: string[] = [];

  if (result.components.demandFit >= 60) {
    positives.push(`Kelompok pelanggan yang relevan untuk ${business} terlihat kuat di sekitar lokasi.`);
  } else {
    cautions.push(`Sinyal calon pelanggan untuk ${business} masih terbatas.`);
  }

  if (context.siteAvailable && result.components.accessibility >= 60) {
    positives.push('Akses jalan, berjalan kaki, transportasi, dan parkir cukup mendukung.');
  } else if (context.siteAvailable) {
    cautions.push('Kemudahan akses ke lokasi belum cukup mendukung.');
    nextSteps.push('Periksa akses masuk, parkir, dan keramaian jalan pada jam sibuk.');
  }

  if (result.components.competition >= 60) {
    positives.push(SATURATION_SENTENCES[result.competition.reading]);
  } else {
    cautions.push(SATURATION_SENTENCES[result.competition.reading]);
    nextSteps.push('Bandingkan harga, layanan, jam buka, dan ulasan pesaing terdekat.');
  }

  if (result.components.supportingFacility >= 60) {
    positives.push('Fasilitas pendukung di sekitar lokasi terlihat memadai.');
  } else {
    cautions.push('Fasilitas pendukung di sekitar lokasi masih terbatas.');
  }

  if (!context.siteAvailable) {
    cautions.unshift('Data jalan, kemudahan berjalan kaki, dan risiko banjir belum berhasil dimuat.');
    nextSteps.unshift('Periksa langsung akses jalan, kondisi parkir, dan riwayat banjir sebelum memutuskan.');
  } else if (result.components.risk < 60) {
    cautions.push('Ada tanda risiko operasional dari data peta yang perlu diperiksa langsung.');
    nextSteps.push('Tanyakan riwayat banjir dan kondisi lingkungan kepada warga atau pemilik tempat.');
  } else {
    positives.push('Data peta tidak menunjukkan hambatan operasional besar di titik ini.');
  }

  if (context.stale) cautions.push('Sebagian data OpenStreetMap yang dipakai sudah lama tidak diperbarui.');
  if (context.placesStatus === 'unavailable' || context.placesStatus === 'not_configured') {
    cautions.push('Jumlah usaha kecil mungkin belum lengkap karena data Google Maps tidak digunakan.');
  }

  nextSteps.push('Lakukan survei lokasi pada hari kerja dan akhir pekan sebelum menyewa tempat.');

  const headlinePrefix = provisional ? 'Penilaian awal: lokasi ini' : 'Lokasi ini';
  const summaryParts = [positives[0], cautions[0]].filter((value): value is string => value !== undefined);

  return {
    headline: `${headlinePrefix} ${BAND_HEADLINES[result.score.band]} untuk usaha ${business}`,
    summary: summaryParts.join(' '),
    positives: positives.slice(0, 3),
    cautions: cautions.slice(0, 3),
    nextSteps: [...new Set(nextSteps)].slice(0, 3),
    provisional,
    generatedBy: 'template',
  };
}

export function recommendationRationale(entry: RankedCategory): string {
  const segment = SEGMENT_LABELS[entry.dominantSegment];
  if (entry.status === 'needs_validation') {
    return `Kelompok ${segment} terlihat menjanjikan, tetapi kelengkapan datanya masih perlu diperiksa`;
  }
  return `Kelompok ${segment} terlihat kuat. ${SATURATION_SENTENCES[entry.saturationReading]}`;
}

export function recommendationDifferentiator(businessType: BusinessType): string {
  return DIFFERENTIATORS[businessType];
}

export function notRecommendedReason(entry: RankedCategory): string {
  const weakest = (Object.keys(entry.components) as ComponentKey[]).reduce((lowest, key) =>
    entry.components[key] < entry.components[lowest] ? key : lowest,
  );
  return `${COMPONENT_LABELS[weakest]} menjadi hambatan terbesar untuk jenis usaha ini`;
}

// Comparison layer -----------------------------------------------------------
//
// For a visitor who has not chosen a business type yet, five numbers per
// category are harder to read than a plain "high / moderate / low". These are
// rule-based readings of numbers the engine already produced: they summarise a
// score, they never replace one, and no category is scored differently here.

export type IndicatorLevel = 'high' | 'moderate' | 'low';

/** `unknown` when site conditions could not be loaded, where risk is a neutral placeholder. */
export type RiskLevel = IndicatorLevel | 'unknown';

/** Shared thresholds, so every indicator in the comparison reads on one scale. */
const INDICATOR_THRESHOLDS = { high: 70, moderate: 50 } as const;

/** Weights for the two readings the engine does not score directly. */
const OPPORTUNITY_WEIGHTS = { score: 0.5, competition: 0.5 } as const;
const TRAFFIC_WEIGHTS = { demandFit: 0.6, transit: 0.4 } as const;

export function indicatorLevel(value: number): IndicatorLevel {
  if (value >= INDICATOR_THRESHOLDS.high) return 'high';
  return value >= INDICATOR_THRESHOLDS.moderate ? 'moderate' : 'low';
}

/**
 * Room for a new business: half how suitable the location is overall, half how
 * much space is left once competitors are weighed against demand.
 */
export function opportunityLevel(scoreValue: number, competition: number): IndicatorLevel {
  return indicatorLevel(OPPORTUNITY_WEIGHTS.score * scoreValue + OPPORTUNITY_WEIGHTS.competition * competition);
}

/**
 * Passing trade, estimated from the customer groups nearby and the nearest
 * usable transit stop. This is a map-data proxy, not a counted footfall.
 */
export function trafficLevel(demandFitValue: number, transit: number): IndicatorLevel {
  return indicatorLevel(TRAFFIC_WEIGHTS.demandFit * demandFitValue + TRAFFIC_WEIGHTS.transit * transit);
}

/**
 * Operating risk. The engine's risk component runs the other way — a high value
 * means fewer obstacles — so it is inverted here, and a hard warning is never
 * reported as low risk.
 */
export function riskLevel(risk: number, warnings: readonly HardWarning[], siteAvailable: boolean): RiskLevel {
  if (!siteAvailable) return 'unknown';
  const level = indicatorLevel(risk);
  const inverted: IndicatorLevel = level === 'high' ? 'low' : level === 'low' ? 'high' : 'moderate';
  return warnings.length > 0 && inverted === 'low' ? 'moderate' : inverted;
}

const SATURATION_CLAUSES: Record<SaturationReading, string> = {
  not_saturated: 'pesaingnya sangat sedikit walaupun permintaannya belum terbukti',
  healthy: 'jumlah pesaingnya masih seimbang dengan potensi permintaan',
  becoming_saturated: 'persaingannya mulai padat',
  saturated: 'persaingannya sudah padat',
  heavily_saturated: 'persaingannya sangat padat',
};

/** One sentence for the top of the comparison: which category leads here, and why. */
export function comparisonHighlight(
  entry: RankedCategory,
  accessibility: number,
  siteAvailable: boolean,
): string {
  const business = BUSINESS_LABELS[entry.businessType];
  const reasons: string[] = [];

  if (entry.components.demandFit >= 60) {
    reasons.push(`kelompok ${SEGMENT_LABELS[entry.dominantSegment]} terlihat kuat`);
  }
  if (entry.components.competition >= 60) reasons.push(SATURATION_CLAUSES[entry.saturationReading]);
  if (entry.components.supportingFacility >= 60) reasons.push('fasilitas pendukung di sekitarnya memadai');
  if (siteAvailable && accessibility >= 60) reasons.push('akses ke lokasinya cukup mendukung');

  if (entry.status === 'not_recommended') {
    // Naming the single weakest component is more useful than listing what
    // happens to be fine: that component is what would have to change here.
    return `Belum ada jenis usaha yang cukup kuat di lokasi ini. Skor tertinggi dipegang usaha ${business}, tetapi ${COMPONENT_LABELS[weakestComponent(entry)]}nya menjadi hambatan terbesar. Periksa langsung kondisi lapangan sebelum memutuskan.`;
  }
  if (reasons.length === 0) {
    return `Usaha ${business} memimpin di lokasi ini, tetapi tidak ada satu pun indikator yang menonjol. Perlakukan urutan ini sebagai petunjuk awal dan periksa kondisi lapangan.`;
  }

  const hedge = entry.status === 'needs_validation' ? ', walaupun kelengkapan datanya masih perlu diperiksa' : '';
  return `Usaha ${business} ${BAND_HEADLINES[entry.score.band]} untuk lokasi ini karena ${listClauses(reasons)}${hedge}.`;
}

function weakestComponent(entry: RankedCategory): ComponentKey {
  return (Object.keys(entry.components) as ComponentKey[]).reduce((lowest, key) =>
    entry.components[key] < entry.components[lowest] ? key : lowest,
  );
}

/** The one line a comparison card carries: why this category suits the place, or why it does not. */
export function comparisonReason(entry: RankedCategory): string {
  if (entry.status === 'not_recommended') return notRecommendedReason(entry);
  return recommendationRationale(entry);
}

// Two-location comparison ----------------------------------------------------
//
// Comparing two candidate sites for one category. Both are scored by the same
// engine with the same weights, so the difference between them is attributable
// component by component; these builders only put that difference into words.

export type LocationLabel = 'A' | 'B';

export interface ComparedLocation {
  label: LocationLabel;
  score: number;
  dominantSegment: Segment;
  components: Components;
}

const ADVANTAGE_CLAUSES: Record<ComponentKey, string> = {
  demandFit: 'kelompok calon pelanggannya lebih kuat',
  accessibility: 'aksesnya lebih mudah dijangkau',
  competition: 'ruang persaingannya lebih longgar',
  supportingFacility: 'fasilitas pendukungnya lebih lengkap',
  risk: 'hambatan operasionalnya lebih sedikit',
};

/** Naming the customer group is more useful than saying "demand is stronger". */
function advantageClause(component: ComponentKey, side: ComparedLocation): string {
  if (component === 'demandFit') return `kelompok ${SEGMENT_LABELS[side.dominantSegment]} lebih kuat`;
  return ADVANTAGE_CLAUSES[component];
}

function listClauses(clauses: readonly string[]): string {
  if (clauses.length <= 1) return clauses[0] ?? '';
  // Indonesian takes no comma before "dan" in a two-item list.
  if (clauses.length === 2) return `${clauses[0]} dan ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(', ')}, dan ${clauses[clauses.length - 1]}`;
}

/**
 * The verdict: which of the two to choose, and what decided it. A gap inside the
 * model's equivalence threshold is reported as a tie rather than a winner —
 * claiming a favourite there would imply a precision the score does not have.
 */
export function locationVerdict(
  businessType: BusinessType,
  winner: ComparedLocation,
  loser: ComparedLocation,
  deciding: readonly ComponentKey[],
  tied: boolean,
): string {
  const business = BUSINESS_LABELS[businessType];
  const gap = Math.abs(winner.score - loser.score).toFixed(1);
  if (tied) {
    return `Lokasi A dan Lokasi B praktis setara untuk usaha ${business}: selisih skornya hanya ${gap} poin, masih di dalam ambang setara yang dipakai model. Putuskan lewat hal yang tidak diukur di sini, seperti biaya sewa, ukuran tempat, dan perizinan.`;
  }
  const clauses = deciding.map((component) => advantageClause(component, winner));
  return `Lokasi ${winner.label} lebih disarankan untuk usaha ${business} karena ${listClauses(clauses)}. Selisihnya ${gap} poin dari Lokasi ${loser.label}.`;
}

const ALTERNATIVE_STRATEGIES: Record<ComponentKey, string> = {
  competition: 'pesaingnya lebih sedikit, jadi masih terbuka untuk konsep yang menonjol lewat harga atau layanan',
  demandFit: 'kelompok pelanggan di sekitarnya berbeda, jadi cocok untuk konsep yang menyasar mereka',
  accessibility: 'aksesnya lebih baik untuk pembeli yang mampir cepat, seperti konsep bawa pulang',
  supportingFacility: 'fasilitas pendukung di sekitarnya lebih lengkap',
  risk: 'hambatan operasionalnya lebih sedikit',
};

function strategyClause(component: ComponentKey, side: ComparedLocation): string {
  if (component === 'demandFit') {
    return `kelompok ${SEGMENT_LABELS[side.dominantSegment]} di sana lebih kuat, jadi cocok untuk konsep yang menyasar mereka`;
  }
  return ALTERNATIVE_STRATEGIES[component];
}

/**
 * What the runner-up still has going for it. Built only from the components where
 * it actually beats the other side: if it beats it in none, that is said plainly
 * instead of inventing a consolation. A tie is a different question — there the
 * two are worth separating by what each is better at, not by which one lost.
 */
export function locationAlternative(options: {
  winner: ComparedLocation;
  loser: ComparedLocation;
  winnerAdvantages: readonly ComponentKey[];
  loserAdvantages: readonly ComponentKey[];
  tied: boolean;
}): string {
  const { winner, loser, winnerAdvantages, loserAdvantages, tied } = options;

  if (tied) {
    if (winnerAdvantages.length === 0 && loserAdvantages.length === 0) {
      return `Kedua titik menghasilkan nilai yang sama pada seluruh faktor yang dinilai. Bedakan lewat hal yang tidak diukur di sini: biaya sewa, ukuran tempat, dan perizinan.`;
    }
    const parts = [
      winnerAdvantages.length > 0
        ? `Lokasi ${winner.label} lebih unggul pada ${listClauses(winnerAdvantages.map((c) => COMPONENT_LABELS[c]))}`
        : null,
      loserAdvantages.length > 0
        ? `Lokasi ${loser.label} lebih unggul pada ${listClauses(loserAdvantages.map((c) => COMPONENT_LABELS[c]))}`
        : null,
    ].filter((part): part is string => part !== null);
    return `Skornya setara, tetapi isinya berbeda. ${parts.join(', sedangkan ')}. Pilih yang paling cocok dengan konsep dan modal Anda.`;
  }

  if (loserAdvantages.length === 0) {
    return `Lokasi ${loser.label} tidak lebih unggul pada satu pun faktor yang dinilai. Kalau tetap dipilih, keunggulannya harus datang dari hal yang tidak diukur di sini, seperti biaya sewa, ukuran tempat, atau masa kontrak.`;
  }
  const clauses = loserAdvantages.map((component) => strategyClause(component, loser));
  return `Lokasi ${loser.label} masih bisa dipakai dengan strategi berbeda: ${listClauses(clauses)}. Biaya sewa tidak ikut dinilai di sini, jadi bandingkan angka itu juga sebelum memutuskan.`;
}
