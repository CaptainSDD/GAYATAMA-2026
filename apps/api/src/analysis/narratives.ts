import type {
  BusinessType,
  ComponentKey,
  LocationScoreResult,
  RankedCategory,
  SaturationReading,
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
