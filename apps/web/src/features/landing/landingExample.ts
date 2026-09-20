import type { BusinessType, ComponentKey, LatLng } from '@gayatama/scoring';

interface LandingBusinessScore {
  businessType: BusinessType;
  value: number;
}

interface LandingExample {
  label: string;
  point: LatLng;
  featuredBusiness: BusinessType;
  confidence: number;
  components: Record<ComponentKey, number>;
  businessScores: readonly LandingBusinessScore[];
  source: {
    modelVersion: string;
    osmSnapshotAt: string;
    overtureRelease: string;
    warning: string;
  };
}

/**
 * One location story for the whole landing page.
 *
 * Generated offline from the committed Semarang/UPGRIS OSM and Overture
 * snapshots through AnalysisService.compare() and AnalysisService.analyze(),
 * with Google Places and all network access disabled. Keep the exact engine
 * values here so the visible rounded figures, ranges, bands, and contributions
 * continue to be derived rather than copied independently into components.
 */
export const LANDING_EXAMPLE: LandingExample = {
  label: 'Titik contoh di Kota Semarang',
  point: { lat: -6.9882533, lng: 110.4355751 },
  featuredBusiness: 'laundry',
  confidence: 76.27338877338886,
  components: {
    demandFit: 71.78389244110564,
    accessibility: 39.5,
    competition: 85,
    supportingFacility: 68.96238885883028,
    risk: 90,
  },
  businessScores: [
    { businessType: 'stationery', value: 78.45068446485331 },
    { businessType: 'beverages', value: 78.10405112643477 },
    { businessType: 'food', value: 73.5574625738597 },
    { businessType: 'laundry', value: 69.3687206832115 },
    { businessType: 'salon', value: 69.09049438269432 },
    { businessType: 'pharmacy', value: 67.69798483373803 },
    { businessType: 'minimarket', value: 67.57091179317712 },
  ],
  source: {
    modelVersion: '0.1.0',
    osmSnapshotAt: '2026-09-11T20:22:01Z',
    overtureRelease: '2026-08-19.0',
    warning: 'Sebagian besar fasilitas di sekitar titik belum diperbarui lebih dari 36 bulan.',
  },
};
