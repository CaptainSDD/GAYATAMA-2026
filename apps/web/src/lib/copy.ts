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

// Every user-facing label in one place. The interface is Indonesian because the
// people it is for are Indonesian micro-entrepreneurs; the documentation in
// docs/ stays English for the competition submission.

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  beverages: 'Minuman / Kedai Kopi',
  food: 'Warung Makan / Makanan Cepat Saji',
  laundry: 'Laundry',
  stationery: 'Fotokopi / Percetakan / ATK',
  minimarket: 'Minimarket',
  salon: 'Salon / Barbershop',
  pharmacy: 'Apotek',
};

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  demandFit: 'Potensi Pelanggan',
  accessibility: 'Kemudahan Akses',
  competition: 'Kondisi Persaingan',
  supportingFacility: 'Fasilitas Pendukung',
  risk: 'Keamanan Operasional',
};

export const COMPONENT_DESCRIPTIONS: Record<ComponentKey, string> = {
  demandFit: 'Kekuatan kelompok calon pelanggan yang relevan untuk usaha ini.',
  accessibility: 'Kemudahan mencapai lokasi melalui jalan, transportasi umum, berjalan kaki, dan parkir.',
  competition: 'Seberapa sehat ruang untuk usaha baru setelah jumlah pesaing dibandingkan dengan permintaan.',
  supportingFacility: 'Keberadaan fasilitas yang dapat membantu aktivitas dan transaksi usaha.',
  risk: 'Kondisi lingkungan yang mendukung operasional; nilai tinggi berarti hambatannya lebih sedikit.',
};

export const SEGMENT_LABELS: Record<Segment, string> = {
  student: 'Pelajar & mahasiswa',
  office: 'Pekerja kantor',
  resident: 'Penghuni sekitar',
  commuter: 'Pengguna transportasi',
  health: 'Pengunjung fasilitas kesehatan',
  general: 'Pengunjung umum',
};

export const SEGMENT_ROLE_LABELS: Record<SegmentRole, string> = {
  primary: 'Target utama',
  secondary: 'Target sekunder',
  supporting: 'Target pendukung',
  insignificant: 'Tidak signifikan',
};

export const BAND_LABELS: Record<Band, string> = {
  highly_suitable: 'Sangat cocok',
  suitable: 'Cocok',
  moderately_suitable: 'Cukup cocok',
  risky: 'Berisiko',
  not_recommended: 'Tidak direkomendasikan',
};

export const STATUS_LABELS: Record<RecommendationStatus, string> = {
  primary: 'Rekomendasi utama',
  alternative: 'Alternatif layak',
  needs_validation: 'Perlu dicek langsung',
  not_recommended: 'Tidak direkomendasikan',
};

export const CONFIDENCE_LABELS: Record<ConfidenceReading, string> = {
  high: 'tinggi',
  good: 'baik',
  moderate: 'sedang',
  low: 'rendah',
  very_low: 'sangat rendah',
};

export const DENSITY_LABELS: Record<Density, string> = {
  low: 'Rendah',
  moderate: 'Sedang',
  high: 'Tinggi',
  very_high: 'Sangat tinggi',
};

export const SATURATION_LABELS: Record<SaturationReading, string> = {
  not_saturated: 'Belum padat',
  healthy: 'Persaingan sehat',
  becoming_saturated: 'Mulai jenuh',
  saturated: 'Jenuh',
  heavily_saturated: 'Sangat jenuh',
};

export const FACILITY_KIND_LABELS: Record<FacilityKind, string> = {
  campus: 'Kampus',
  school: 'Sekolah',
  office: 'Kantor',
  government_office: 'Kantor pemerintahan',
  housing: 'Permukiman',
  boarding_house: 'Kos / asrama',
  transit: 'Halte / stasiun',
  hospital: 'Rumah sakit',
  mall: 'Mal',
  cafe: 'Kafe',
  bubble_tea: 'Kedai boba',
  restaurant: 'Restoran',
  fast_food: 'Makanan cepat saji',
  food_court: 'Pujasera',
  laundry: 'Laundry',
  dry_cleaning: 'Dry cleaning',
  copyshop: 'Fotokopi',
  printer: 'Percetakan',
  stationery_shop: 'Toko ATK',
  convenience: 'Minimarket',
  supermarket: 'Supermarket',
  hairdresser: 'Salon / pangkas rambut',
  beauty: 'Salon kecantikan',
  pharmacy: 'Apotek',
  chemist: 'Toko obat',
  atm: 'ATM',
  bank: 'Bank',
  marketplace: 'Pasar',
  place_of_worship: 'Tempat ibadah',
  clinic: 'Klinik',
  parking: 'Parkir',
  other: 'Lainnya',
};

const GENERIC_ERROR = 'Terjadi kesalahan. Silakan coba lagi.';

/** A short headline for the error box, so the reader sees the kind of problem first. */
export function errorTitle(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Ada yang tidak beres';
  switch (error.code) {
    case 'INSUFFICIENT_DATA':
      return 'Data peta di sini terlalu sedikit';
    case 'LOCATION_NOT_ELIGIBLE':
      return 'Titik ini bukan lokasi usaha';
    case 'VALIDATION_FAILED':
      return 'Lokasi ini di luar cakupan';
    case 'RATE_LIMITED':
      return 'Terlalu banyak permintaan';
    case 'UPSTREAM_TIMEOUT':
      return 'Data OpenStreetMap sedang tidak tersedia';
    case 'NETWORK_ERROR':
      return 'Server tidak bisa dihubungi';
    case 'USERNAME_TAKEN':
      return 'Username sudah dipakai';
    case 'UNAUTHORIZED':
      return 'Sesi tidak valid';
    default:
      return 'Ada yang tidak beres';
  }
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_ERROR;
  switch (error.code) {
    case 'INSUFFICIENT_DATA': {
      const confidence = error.details?.confidence;
      const suffix = typeof confidence === 'number' ? ` (keyakinan ${confidence}/100)` : '';
      return `Data peta di sekitar titik ini terlalu sedikit untuk memberi jawaban yang bisa dipercaya${suffix}. LOKABIS memilih tidak menebak daripada memberi skor yang terdengar meyakinkan tapi salah.`;
    }
    case 'LOCATION_NOT_ELIGIBLE':
      return 'Titik ini berada di air, lahan basah, atau tambak. Pilih titik di daratan atau bangunan usaha.';
    case 'VALIDATION_FAILED':
      return 'Titik ini tidak bisa dianalisis. LOKABIS hanya mencakup lokasi di Indonesia.';
    case 'RATE_LIMITED':
      return 'Terlalu banyak permintaan dalam satu menit terakhir. Tunggu sebentar, lalu coba lagi.';
    case 'UPSTREAM_TIMEOUT':
      return 'Data OpenStreetMap untuk area ini sedang tidak bisa diambil. Coba lagi sebentar lagi.';
    case 'NETWORK_ERROR':
      return import.meta.env.DEV
        ? `Tidak bisa menghubungi API di ${API_BASE_URL}. Apakah servernya jalan? Nyalakan dengan npm run dev:api.`
        : 'Tidak bisa menghubungi server LOKABIS. Periksa koneksi Anda, lalu coba lagi.';
    case 'USERNAME_TAKEN':
      return 'Username ini sudah dipakai orang lain. Coba username yang lain.';
    case 'UNAUTHORIZED':
      return 'Sesi login sudah tidak valid. Silakan login ulang.';
    default:
      return error.message || GENERIC_ERROR;
  }
}

/** Errors a retry cannot fix: the request itself is invalid, or the area lacks data. */
export function isRetryable(error: unknown): boolean {
  return !(
    error instanceof ApiError &&
    (error.code === 'VALIDATION_FAILED' || error.code === 'INSUFFICIENT_DATA' || error.code === 'LOCATION_NOT_ELIGIBLE')
  );
}

/** Translate stable Firebase Auth error codes rather than exposing raw provider messages. */
export function firebaseAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Coba login, atau pakai email lain.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah. Gunakan minimal 8 karakter, campur huruf dan angka.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau kata sandi salah.';
    case 'auth/user-disabled':
      return 'Akun ini telah dinonaktifkan.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Tunggu sebentar, lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Tidak bisa menghubungi server. Periksa koneksi Anda.';
    case 'auth/not-configured':
      return 'Login belum bisa dipakai — konfigurasi Firebase belum lengkap di server ini.';
    default:
      return GENERIC_ERROR;
  }
}
