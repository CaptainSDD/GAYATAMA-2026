import type { ComponentKey, Segment } from '@gayatama/scoring';
import { describe, expect, it } from 'vitest';
import type {
  AnalysisResponse,
  DataSource,
  OpportunitiesResponse,
  PoisResponse,
  RecommendResponse,
} from './api-types';
import { reportHtml } from './report-export';
import type { ReportData } from './report-data';

const dataSource: DataSource = {
  provider: 'OpenStreetMap',
  attribution: '© OpenStreetMap contributors',
  licence: 'ODbL 1.0',
  fetchedAt: '2026-09-20T03:00:00.000Z',
  cacheHit: false,
  stale: false,
  via: 'overpass',
  siteConditions: 'available',
  places: { provider: 'Google Maps', status: 'not_requested', attribution: null, fetchedAt: null, cacheHit: null, kinds: [] },
  overture: null,
};

const component = (value: number, weight: number, availability: 'available' | 'partial' | 'unavailable' = 'available') => ({
  value,
  weight,
  availability,
});

const analysis: AnalysisResponse = {
  modelVersion: 'test-1',
  location: { lat: -6.9932, lng: 110.4203 },
  businessType: 'beverages',
  score: { value: 72.4, band: 'suitable', confidence: 81, margin: 6, range: [66, 78] },
  components: {
    demandFit: component(80, 0.35),
    accessibility: component(64, 0.2),
    competition: component(55, 0.2),
    supportingFacility: component(70, 0.15, 'partial'),
    risk: component(0, 0.1, 'unavailable'),
  } as Record<ComponentKey, { value: number; weight: number; availability: 'available' | 'partial' | 'unavailable' }>,
  accessibility: { value: 64, road: 70, transit: 60, walkability: 55, parking: 65, siteInputsAvailable: true },
  segments: {
    student: { score: 88, role: 'primary' },
    office: { score: 54, role: 'secondary' },
    resident: { score: 61, role: 'supporting' },
    commuter: { score: 40, role: 'supporting' },
    health: { score: 20, role: 'insignificant' },
    general: { score: 50, role: 'supporting' },
  } as Record<Segment, { score: number; role: 'primary' | 'secondary' | 'supporting' | 'insignificant' }>,
  competition: {
    rawCount: 24,
    equivalentCount: 11.5,
    density: 'moderate',
    saturationRatio: 0.62,
    reading: 'becoming_saturated',
    radiusMeters: 1500,
    strongest: [
      { id: 'g-a', name: null, kind: 'cafe', zone: 'a', distanceMeters: null, count: 9, source: 'google', contribution: 6.1 },
      { id: 'g-b', name: null, kind: 'cafe', zone: 'b', distanceMeters: null, count: 15, source: 'google', contribution: 5.4 },
    ],
    namedCompetitors: [
      { id: 'osm-1', name: 'Kopi Tepi Jalan', kind: 'cafe', zone: 'a', distanceMeters: 180, source: 'openstreetmap' },
    ],
  },
  strengths: [],
  risks: [],
  warnings: [{ code: 'flood_risk_proxy', message: 'Titik ini dekat saluran air besar.' }],
  evidence: { facilityCount: 412, zones: { a: 90, b: 210, c: 112 } },
  dataSource,
  narrative: {
    headline: 'Lokasi ini cocok untuk minuman',
    summary: 'Permintaan kuat dari kampus di sebelah utara.',
    positives: ['Kampus dalam 300 meter'],
    cautions: ['Pesaing sejenis cukup padat'],
    nextSteps: ['Cek harga sewa', 'Hitung lalu lintas pagi'],
    provisional: false,
    generatedBy: 'template',
  },
};

const recommend: RecommendResponse = {
  modelVersion: 'test-1',
  location: analysis.location,
  recommendations: [
    {
      businessType: 'beverages',
      score: { value: 72.4, band: 'suitable', confidence: 81, margin: 6, range: [66, 78] },
      status: 'primary',
      dominantSegment: 'student',
      rationale: 'Permintaan pelajar tinggi.',
      differentiator: 'Buka sampai malam.',
    },
    {
      businessType: 'food',
      score: { value: 64, band: 'moderately_suitable', confidence: 78, margin: 7, range: [57, 71] },
      status: 'alternative',
      dominantSegment: 'student',
      rationale: 'Masih layak dengan diferensiasi.',
      differentiator: 'Porsi hemat.',
    },
  ],
  equivalent: [['beverages', 'food']],
  notRecommended: [
    {
      businessType: 'pharmacy',
      score: { value: 38, band: 'not_recommended', confidence: 70, margin: 8, range: [30, 46] },
      status: 'not_recommended',
      reason: 'Permintaan kesehatan terlalu tipis',
    },
  ],
  warnings: [],
  segments: { student: 88, office: 54, resident: 61, commuter: 40, health: 20, general: 50 } as Record<Segment, number>,
  dataSource,
};

const opportunities: OpportunitiesResponse = {
  center: analysis.location,
  businessType: 'beverages',
  source: 'OpenStreetMap',
  spacingMeters: 350,
  cells: [
    { id: '1:-1', lat: 0, lng: 0, status: 'scored', score: 60, confidence: 70 },
    { id: '1:0', lat: 0, lng: 0, status: 'scored', score: 81, confidence: 75 },
    { id: '1:1', lat: 0, lng: 0, status: 'insufficient_data', score: null, confidence: null },
    { id: '0:-1', lat: 0, lng: 0, status: 'scored', score: 58, confidence: 66 },
    { id: '0:0', lat: 0, lng: 0, status: 'scored', score: 72, confidence: 81 },
    { id: '0:1', lat: 0, lng: 0, status: 'scored', score: 64, confidence: 70 },
    { id: '-1:-1', lat: 0, lng: 0, status: 'unavailable', score: null, confidence: null },
    { id: '-1:0', lat: 0, lng: 0, status: 'scored', score: 55, confidence: 60 },
    { id: '-1:1', lat: 0, lng: 0, status: 'scored', score: 61, confidence: 64 },
  ],
};

const pois: PoisResponse = {
  location: analysis.location,
  asOf: '2026-09-20T03:00:00.000Z',
  site: {} as PoisResponse['site'],
  facilities: [
    { id: 'f1', kind: 'campus', lat: -6.993, lng: 110.42, distanceMeters: 120, zone: 'a', dataQuality: 1, accessFactor: 1 },
    { id: 'f2', kind: 'campus', lat: -6.994, lng: 110.421, distanceMeters: 260, zone: 'a', dataQuality: 1, accessFactor: 1 },
  ] as PoisResponse['facilities'],
  facilityCounts: [],
  dataSource,
};

const full: ReportData = { analysis, recommend, opportunities, pois };

describe('reportHtml — chapters', () => {
  it('contains all five chapters the interface shows', () => {
    const html = reportHtml(full);
    for (const heading of ['1 · Skor lokasi', '2 · Pilihan usaha', '3 · Pelanggan', '4 · Pesaing', '5 · Peluang']) {
      expect(html).toContain(heading);
    }
  });

  it('leads with the score, its band and its interval', () => {
    const html = reportHtml(full);
    expect(html).toContain('72'); // displayScore
    expect(html).toContain('Cocok'); // BAND_LABELS.suitable
    expect(html).toContain('66–78'); // formatRange
    expect(html).toContain('-6.99320, 110.42030'); // formatCoordinate
  });

  it('reports the reliability reading rather than only the raw confidence', () => {
    // confidenceReading(81) is 'high' → CONFIDENCE_LABELS.high
    expect(reportHtml(full)).toContain('tinggi');
  });
});

describe('reportHtml — charts', () => {
  /** The gauge is the one figure whose geometry is computed rather than laid out. */
  it('draws the score ring with a dash proportional to the value', () => {
    const html = reportHtml(full);
    const radius = (150 - 18) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(html).toContain(`${((72.4 / 100) * circumference).toFixed(2)} ${circumference.toFixed(2)}`);
  });

  it('draws a bar for every indicator, and none for one that could not be scored', () => {
    const html = reportHtml(full);
    for (const label of [
      'Potensi Pelanggan',
      'Kemudahan Akses',
      'Kondisi Persaingan',
      'Fasilitas Pendukung',
      'Keamanan Operasional',
    ]) {
      expect(html).toContain(label);
    }
    // risk is 'unavailable': the reading says so and the track is left empty,
    // with no number beside it that could be mistaken for a real score.
    expect(html).toContain('Belum dinilai');
    const riskRow = html.slice(html.indexOf('Keamanan Operasional'), html.indexOf('Keamanan Operasional') + 400);
    expect(riskRow).toContain('bar-track');
    expect(riskRow).not.toContain('bar-fill');
  });

  it('marks a partial indicator as partial', () => {
    expect(reportHtml(full)).toContain('sebagian');
  });

  it('stacks the facility counts by distance zone', () => {
    const html = reportHtml(full);
    expect(html).toContain('Sangat dekat, 0–300 m');
    expect(html).toContain('210'); // zone b count
  });

  it('lays the nine opportunity points out as a grid and flags the best', () => {
    const html = reportHtml(full);
    expect(html).toContain('heat-grid');
    expect(html).toContain('Titik Anda');
    expect(html).toContain('terbaik');
    // 1:0 scores 81, which beats the centre's 72, so the verdict points north.
    expect(html).toContain('ke utara');
  });

  it('places the saturation reading on its scale', () => {
    const html = reportHtml(full);
    expect(html).toContain('Mulai jenuh');
    expect(html).toContain('meter-step');
  });
});

describe('reportHtml — completeness', () => {
  it('ranks recommended and not-recommended categories together', () => {
    const html = reportHtml(full);
    expect(html).toContain('Minuman'); // BUSINESS_TYPE_LABELS.beverages
    expect(html).toContain('Rekomendasi utama');
    expect(html).toContain('Alternatif layak');
    expect(html).toContain('Tidak direkomendasikan');
    expect(html).toContain('Permintaan kesehatan terlalu tipis');
  });

  it('orders customer groups by their contribution to the chosen category', () => {
    const html = reportHtml(full);
    // For beverages: student 0.35×88 = 30.8, office 0.25×54 = 13.5, general 0.1×50 = 5.
    const student = html.indexOf('Pelajar &amp; mahasiswa');
    const office = html.indexOf('Pekerja kantor');
    const general = html.indexOf('Pengunjung umum');
    expect(student).toBeGreaterThan(-1);
    expect(student).toBeLessThan(office);
    expect(office).toBeLessThan(general);
  });

  /** SEGMENT_WEIGHTS.beverages.health is 0, and the screen leaves it out too. */
  it('leaves out a group that carries no weight for this category', () => {
    expect(reportHtml(full)).not.toContain('Pengunjung fasilitas kesehatan');
  });

  it('names the nearest competitors and their distance', () => {
    const html = reportHtml(full);
    expect(html).toContain('Kopi Tepi Jalan');
    expect(html).toContain('180 m');
  });

  it('carries the warnings and the next steps', () => {
    const html = reportHtml(full);
    expect(html).toContain('Titik ini dekat saluran air besar.');
    expect(html).toContain('Cek harga sewa');
  });

  it('says which chapters could not be loaded instead of dropping them silently', () => {
    const html = reportHtml({ analysis, recommend: null, opportunities: null, pois: null });
    expect(html).toContain('2 · Pilihan usaha');
    expect(html).toContain('5 · Peluang');
    expect(html.match(/tidak bisa dimuat/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('reportHtml — attribution and safety', () => {
  it('always credits OpenStreetMap with its licence', () => {
    expect(reportHtml(full)).toContain('Data © OpenStreetMap contributors, ODbL 1.0');
  });

  it('credits Google and Overture only when their data was actually used', () => {
    expect(reportHtml(full)).not.toContain('Jumlah usaha:');

    const withExtras: ReportData = {
      ...full,
      analysis: {
        ...analysis,
        dataSource: {
          ...dataSource,
          places: { ...dataSource.places, status: 'used', attribution: 'Google Maps' },
          overture: {
            provider: 'Overture Maps Foundation',
            attribution: 'Overture Maps Foundation',
            licence: 'CDLA-Permissive-2.0',
            release: '2026-01',
            kinds: [],
          },
        },
      },
    };
    const html = reportHtml(withExtras);
    expect(html).toContain('Jumlah usaha: Google Maps');
    expect(html).toContain('Fotokopi &amp; ATK: Overture Maps Foundation');
  });

  it('keeps the disclaimer that a score is not a guarantee', () => {
    expect(reportHtml(full)).toContain('bukan menjamin keuntungan');
  });

  it('escapes text that would otherwise close a tag', () => {
    const hostile: ReportData = {
      ...full,
      analysis: {
        ...analysis,
        narrative: { ...analysis.narrative, headline: '</style><script>alert(1)</script>' },
      },
    };
    const html = reportHtml(hostile);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('flags a customised weight set so the number is not mistaken for a baseline score', () => {
    const custom: ReportData = {
      ...full,
      analysis: { ...analysis, weights: { demandFit: 50, accessibility: 20, competition: 10, supportingFacility: 10, risk: 10 } },
    };
    expect(reportHtml(custom)).toContain('bobot ubahan');
    expect(reportHtml(full)).not.toContain('bobot ubahan');
  });
});
