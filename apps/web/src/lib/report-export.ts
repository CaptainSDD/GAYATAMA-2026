import {
  ACCESSIBILITY_WEIGHTS,
  COMPONENT_KEYS,
  SEGMENTS,
  SEGMENT_WEIGHTS,
  confidenceReading,
  type Segment,
} from '@gayatama/scoring';
import type { AnalysisResponse, Competitor, DataSource, RecommendResponse } from './api-types';
import { bandTone, confidenceTone, roleTone, saturationTone, scoreTone } from './band-color';
import {
  BAND_LABELS,
  BUSINESS_TYPE_LABELS,
  CONFIDENCE_LABELS,
  COMPONENT_DESCRIPTIONS,
  COMPONENT_LABELS,
  DENSITY_LABELS,
  FACILITY_KIND_LABELS,
  SATURATION_LABELS,
  SEGMENT_LABELS,
  SEGMENT_ROLE_LABELS,
  STATUS_LABELS,
} from './copy';
import { segmentEvidence } from './evidence';
import {
  BRAND,
  INK,
  MUTED,
  RULE,
  TONE_INK,
  TONE_TEXT,
  TONE_WASH,
  barChart,
  donutChart,
  escapeHtml,
  scaleMeter,
  stackedBar,
  type BarDatum,
} from './report-charts';
import { displayScore, formatCoordinate, formatDateTime, formatDistance, formatPercent, formatRange, formatWhole } from './format';
import type { ReportData } from './report-data';

/**
 * The printed report: every chapter the interface shows, with the figures drawn
 * rather than only listed.
 *
 * Written into a blank window that the reader saves as PDF. Nothing from the app
 * reaches that window, so the whole document — styles, charts, colours — is
 * self-contained. See report-charts.ts for the figures and report-data.ts for
 * how the chapters that live behind their own endpoints are collected.
 */

const number = (value: number, digits = 0) =>
  value.toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Matches ScorePanel's componentReading, so the report and the screen say the same word. */
function componentReading(value: number, availability: 'available' | 'partial' | 'unavailable') {
  if (availability === 'unavailable') return { label: 'Belum dinilai', tone: 'neutral' as const };
  const suffix = availability === 'partial' ? ' · sebagian' : '';
  if (value >= 80) return { label: `Sangat kuat${suffix}`, tone: 'excellent' as const };
  if (value >= 65) return { label: `Kuat${suffix}`, tone: 'good' as const };
  if (value >= 50) return { label: `Cukup${suffix}`, tone: 'fair' as const };
  if (value >= 35) return { label: `Lemah${suffix}`, tone: 'poor' as const };
  return { label: `Sangat lemah${suffix}`, tone: 'bad' as const };
}

/** Matches SegmentsView's segmentSignal. */
function segmentSignal(score: number): string {
  if (score >= 80) return 'Sangat kuat';
  if (score >= 60) return 'Kuat';
  if (score >= 40) return 'Sedang';
  return 'Terbatas';
}

const SATURATION_STEPS = ['Belum padat', 'Sehat', 'Mulai jenuh', 'Jenuh', 'Sangat jenuh'];
const SATURATION_ORDER = ['not_saturated', 'healthy', 'becoming_saturated', 'saturated', 'heavily_saturated'];

function chapter(title: string, lead: string, body: string): string {
  return `<section class="chapter">
    <h2>${escapeHtml(title)}</h2>
    <p class="lead">${escapeHtml(lead)}</p>
    ${body}
  </section>`;
}

function missing(what: string): string {
  return `<p class="notice">${escapeHtml(what)} tidak bisa dimuat saat laporan ini dibuat, jadi bagian ini kosong. Buka kembali tab-nya di aplikasi lalu export ulang.</p>`;
}

/* ── Cover ─────────────────────────────────────────────────────────────── */

function cover(analysis: AnalysisResponse, generatedAt: string): string {
  const { score } = analysis;
  const tone = bandTone(score.band);
  const reading = confidenceReading(score.confidence);

  return `<header class="cover">
    <div class="cover-brand">
      <span class="cover-mark">LOKABIS</span>
      <span class="cover-kind">Laporan analisis lokasi usaha mikro</span>
    </div>
    <h1>${escapeHtml(BUSINESS_TYPE_LABELS[analysis.businessType])}</h1>
    <p class="cover-meta">${escapeHtml(formatCoordinate(analysis.location))} · dibuat ${escapeHtml(generatedAt)}</p>
  </header>

  <section class="hero">
    <div class="hero-figure">
      ${donutChart({
        value: score.value,
        range: score.range,
        tone,
        centre: displayScore(score.value),
        caption: 'dari 100',
      })}
      <span class="chip" style="background:${TONE_WASH[tone]};color:${TONE_TEXT[tone]}">${escapeHtml(
        BAND_LABELS[score.band],
      )}</span>
    </div>
    <div class="hero-body">
      <h2>${escapeHtml(analysis.narrative.headline)}</h2>
      <p>${escapeHtml(analysis.narrative.summary)}</p>
      <dl class="facts">
        <div><dt>Rentang kemungkinan</dt><dd>${escapeHtml(formatRange(score))}</dd></div>
        <div><dt>Keandalan data</dt><dd style="color:${TONE_TEXT[confidenceTone(reading)]}">${escapeHtml(
          CONFIDENCE_LABELS[reading],
        )} (${escapeHtml(formatWhole(score.confidence))}/100)</dd></div>
        <div><dt>Fasilitas terpetakan</dt><dd>${escapeHtml(number(analysis.evidence.facilityCount))}</dd></div>
        <div><dt>Bobot</dt><dd>${analysis.weights === undefined ? 'Bawaan LOKABIS' : 'Diubah pengguna'}</dd></div>
      </dl>
    </div>
  </section>
  ${
    analysis.weights === undefined
      ? ''
      : '<p class="notice">Skor ini dihitung dengan bobot ubahan, bukan bobot bawaan LOKABIS. Angkanya tidak setara dengan skor bawaan dan tidak bisa dibandingkan dengan laporan lain.</p>'
  }`;
}

/* ── 1. Skor ───────────────────────────────────────────────────────────── */

function scoreChapter(analysis: AnalysisResponse): string {
  const bars: BarDatum[] = COMPONENT_KEYS.map((key) => {
    const { value, availability } = analysis.components[key];
    const reading = componentReading(value, availability);
    return {
      label: COMPONENT_LABELS[key],
      value,
      tone: reading.tone,
      // No number for an indicator that was never scored: its 0 is a placeholder,
      // and printing it beside a reading would read as a genuine result.
      valueLabel: availability === 'unavailable' ? reading.label : `${formatWhole(value)} · ${reading.label}`,
      note: COMPONENT_DESCRIPTIONS[key],
      empty: availability === 'unavailable',
    };
  });

  const contributions = COMPONENT_KEYS.map((key) => {
    const { value, weight, availability } = analysis.components[key];
    return { key, value, weight, availability, contribution: value * weight };
  });
  const total = contributions.reduce((sum, entry) => sum + entry.contribution, 0);

  const calcRows = contributions
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(COMPONENT_LABELS[entry.key])}</td><td>${
          entry.availability === 'unavailable' ? 'netral ' : ''
        }${escapeHtml(number(entry.value, 1))}</td><td>${escapeHtml(formatPercent(entry.weight))}</td><td>${escapeHtml(
          number(entry.contribution, 1),
        )}</td></tr>`,
    )
    .join('');

  const access = analysis.accessibility;
  const neutralNote = access.siteInputsAvailable ? '' : ' (netral, data kondisi lokasi gagal dimuat)';
  const accessRows = (
    [
      ['Jalan', access.road, ACCESSIBILITY_WEIGHTS.road, !access.siteInputsAvailable],
      ['Transportasi', access.transit, ACCESSIBILITY_WEIGHTS.transit, false],
      ['Jalan kaki', access.walkability, ACCESSIBILITY_WEIGHTS.walkability, !access.siteInputsAvailable],
      ['Parkir', access.parking, ACCESSIBILITY_WEIGHTS.parking, false],
    ] as const
  )
    .map(
      ([label, value, weight, neutral]) =>
        `<tr><td>${escapeHtml(label)}${neutral ? escapeHtml(neutralNote) : ''}</td><td>${escapeHtml(
          number(value, 1),
        )}</td><td>${escapeHtml(formatPercent(weight))}</td><td>${escapeHtml(number(value * weight, 1))}</td></tr>`,
    )
    .join('');

  const warnings =
    analysis.warnings.length === 0
      ? '<p class="muted">Tidak ada peringatan khusus dari data yang tersedia.</p>'
      : `<ul class="warn-list">${analysis.warnings
          .map((warning) => `<li>${escapeHtml(warning.message)}</li>`)
          .join('')}</ul>`;

  const columns = (title: string, items: readonly string[]) =>
    items.length === 0
      ? ''
      : `<div><h4>${escapeHtml(title)}</h4><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;

  return chapter(
    '1 · Skor lokasi',
    'Lima indikator, masing-masing dinilai 0–100 lalu dikalikan bobotnya. Angka akhir adalah jumlah kontribusinya.',
    `${barChart(bars)}

    <div class="split">
      <div>
        <h3>Cara skor dihitung</h3>
        <table>
          <thead><tr><th>Indikator</th><th>Nilai</th><th>Bobot</th><th>Kontribusi</th></tr></thead>
          <tbody>${calcRows}</tbody>
          <tfoot><tr><td colspan="3">Total sebelum pembulatan</td><td>${escapeHtml(number(total, 1))}</td></tr></tfoot>
        </table>
      </div>
      <div>
        <h3>Rincian Kemudahan Akses</h3>
        <table>
          <thead><tr><th>Bagian</th><th>Nilai</th><th>Bobot</th><th>Kontribusi</th></tr></thead>
          <tbody>${accessRows}</tbody>
          <tfoot><tr><td colspan="3">Kemudahan Akses</td><td>${escapeHtml(number(access.value, 1))}</td></tr></tfoot>
        </table>
      </div>
    </div>

    <h3>Sebaran fasilitas menurut jarak</h3>
    ${stackedBar([
      { label: 'Sangat dekat, 0–300 m', value: analysis.evidence.zones.a, color: TONE_INK.excellent },
      { label: 'Cukup dekat, 300–800 m', value: analysis.evidence.zones.b, color: TONE_INK.good },
      { label: 'Area terluar, 800 m–1,5 km', value: analysis.evidence.zones.c, color: TONE_INK.neutral },
    ])}

    <div class="split">
      <div>
        <h3>Alasan lengkap</h3>
        <p class="muted">${
          analysis.narrative.generatedBy === 'ai'
            ? 'AI hanya merangkum hasil. Nilai skor tetap dihitung oleh model LOKABIS dari data lokasi.'
            : 'Ringkasan dibuat otomatis dari data lokasi dan hasil perhitungan LOKABIS.'
        }</p>
        <div class="reasons">
          ${columns('Yang mendukung', analysis.narrative.positives)}
          ${columns('Perlu diperiksa', analysis.narrative.cautions)}
        </div>
      </div>
      <div>
        <h3>Peringatan data</h3>
        ${warnings}
        ${
          analysis.narrative.nextSteps.length === 0
            ? ''
            : `<h3>Langkah selanjutnya</h3><ol>${analysis.narrative.nextSteps
                .map((step) => `<li>${escapeHtml(step)}</li>`)
                .join('')}</ol>`
        }
      </div>
    </div>`,
  );
}

/* ── 2. Pilihan usaha ──────────────────────────────────────────────────── */

function recommendChapter(recommend: RecommendResponse | null, chosen: AnalysisResponse['businessType']): string {
  if (recommend === null) return chapter('2 · Pilihan usaha', 'Peringkat setiap jenis usaha di titik ini.', missing('Peringkat jenis usaha'));

  const ranked = [
    ...recommend.recommendations.map((entry, index) => ({
      businessType: entry.businessType,
      score: entry.score,
      status: STATUS_LABELS[entry.status],
      detail: entry.rationale,
      extra: `Pelanggan utama: ${SEGMENT_LABELS[entry.dominantSegment]}. ${entry.differentiator}`,
      rank: index + 1,
      recommended: true,
    })),
    ...recommend.notRecommended.map((entry) => ({
      businessType: entry.businessType,
      score: entry.score,
      status: STATUS_LABELS.not_recommended,
      detail: `${entry.reason}.`,
      extra: '',
      rank: null as number | null,
      recommended: false,
    })),
  ];

  const bars: BarDatum[] = ranked.map((entry) => ({
    label: `${BUSINESS_TYPE_LABELS[entry.businessType]}${entry.businessType === chosen ? ' (dianalisis)' : ''}`,
    value: entry.score.value,
    tone: scoreTone(entry.score.value),
    valueLabel: `${displayScore(entry.score.value)} · ${entry.status}`,
    note: `Rentang ${formatRange(entry.score)}`,
  }));

  const rows = ranked
    .map(
      (entry) =>
        `<tr>
          <td>${entry.rank === null ? '–' : entry.rank}</td>
          <td><strong>${escapeHtml(BUSINESS_TYPE_LABELS[entry.businessType])}</strong><br><span class="muted">${escapeHtml(
            entry.status,
          )}</span></td>
          <td class="num">${escapeHtml(displayScore(entry.score.value))}<br><span class="muted">${escapeHtml(
            formatRange(entry.score),
          )}</span></td>
          <td>${escapeHtml(entry.detail)}${entry.extra === '' ? '' : `<br><span class="muted">${escapeHtml(entry.extra)}</span>`}</td>
        </tr>`,
    )
    .join('');

  const equivalence = recommend.equivalent
    .filter((group) => group.length > 1)
    .map((group) => group.map((type) => BUSINESS_TYPE_LABELS[type]).join(', '));

  return chapter(
    '2 · Pilihan usaha',
    'Setiap jenis usaha dinilai di titik yang sama. Batas kelayakan ada di skor 60; di bawah itu tidak direkomendasikan.',
    `${barChart(bars)}
    <table class="wide">
      <thead><tr><th>#</th><th>Jenis usaha</th><th class="num">Skor</th><th>Alasan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${
      equivalence.length === 0
        ? ''
        : `<p class="muted">Skor berdekatan, perlakukan sebagai sama-sama cocok: ${escapeHtml(equivalence.join('; '))}.</p>`
    }`,
  );
}

/* ── 3. Pelanggan ──────────────────────────────────────────────────────── */

function segmentsChapter(data: ReportData): string {
  const { analysis, pois } = data;
  const weights = SEGMENT_WEIGHTS[analysis.businessType];
  const ordered = [...SEGMENTS]
    .filter((segment) => weights[segment] > 0)
    .sort((a, b) => weights[b] * analysis.segments[b].score - weights[a] * analysis.segments[a].score);

  const evidence = pois === null ? null : segmentEvidence(pois.facilities, pois.facilityCounts);

  const bars: BarDatum[] = ordered.map((segment) => {
    const { score, role } = analysis.segments[segment];
    return {
      label: SEGMENT_LABELS[segment],
      value: score,
      tone: roleTone(role),
      valueLabel: `${formatWhole(score)} · ${segmentSignal(score)}`,
      note: `${SEGMENT_ROLE_LABELS[role]} · bobot ${formatPercent(weights[segment])} untuk ${BUSINESS_TYPE_LABELS[analysis.businessType]}`,
    };
  });

  const evidenceRows = ordered
    .map((segment) => {
      const kinds = evidence?.[segment as Segment] ?? [];
      const chips =
        kinds.length === 0
          ? '<span class="muted">Belum ada fasilitas pendukung yang terpetakan.</span>'
          : kinds
              .map(
                (kind) =>
                  `<span class="tag">${escapeHtml(number(kind.count))} ${escapeHtml(
                    FACILITY_KIND_LABELS[kind.kind].toLowerCase(),
                  )}</span>`,
              )
              .join(' ');
      return `<tr><td>${escapeHtml(SEGMENT_LABELS[segment])}</td><td>${chips}</td></tr>`;
    })
    .join('');

  return chapter(
    '3 · Pelanggan',
    `Kelompok pelanggan diurutkan menurut kontribusinya ke ${BUSINESS_TYPE_LABELS[analysis.businessType]}: nilai kelompok dikalikan bobotnya untuk jenis usaha ini.`,
    `${barChart(bars)}
    <h3>Fasilitas yang menjadi dasar penilaian</h3>
    ${
      pois === null
        ? missing('Rincian fasilitas per kelompok pelanggan')
        : `<table class="wide"><thead><tr><th>Kelompok</th><th>Fasilitas terpetakan</th></tr></thead><tbody>${evidenceRows}</tbody></table>`
    }`,
  );
}

/* ── 4. Pesaing ────────────────────────────────────────────────────────── */

function competitionChapter(analysis: AnalysisResponse): string {
  const { competition } = analysis;
  const tone = saturationTone(competition.reading);
  const counted = competition.strongest
    .filter((entry) => entry.distanceMeters === null)
    .sort((a, b) => ['a', 'b', 'c'].indexOf(a.zone) - ['a', 'b', 'c'].indexOf(b.zone));
  const mapped = competition.strongest.filter((entry) => entry.distanceMeters !== null);
  const named = competition.namedCompetitors ?? [];

  const zoneTotals = { a: 0, b: 0, c: 0 };
  for (const entry of competition.strongest) zoneTotals[entry.zone] += entry.count;

  const competitorName = (entry: Competitor) =>
    entry.distanceMeters === null ? FACILITY_KIND_LABELS[entry.kind] : entry.name ?? FACILITY_KIND_LABELS[entry.kind];

  const naturalZone = (zone: 'a' | 'b' | 'c') =>
    zone === 'a' ? 'Sangat dekat · 0–300 m' : zone === 'b' ? 'Cukup dekat · 300–800 m' : 'Area terluar · 800 m–1,5 km';

  const countedRows = counted
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(number(entry.count))} ${escapeHtml(
          competitorName(entry).toLowerCase(),
        )}</td><td>${escapeHtml(naturalZone(entry.zone))}</td></tr>`,
    )
    .join('');

  const namedRows = named
    .map(
      (entry) =>
        `<tr><td><strong>${escapeHtml(entry.name)}</strong></td><td>${escapeHtml(
          FACILITY_KIND_LABELS[entry.kind],
        )}</td><td>${escapeHtml(naturalZone(entry.zone))}</td><td class="num">${escapeHtml(
          formatDistance(entry.distanceMeters),
        )}</td></tr>`,
    )
    .join('');

  const mappedRows = mapped
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(competitorName(entry))}</td><td>${escapeHtml(
          FACILITY_KIND_LABELS[entry.kind],
        )}</td><td class="num">${escapeHtml(
          entry.distanceMeters === null ? '—' : formatDistance(entry.distanceMeters),
        )}</td><td class="num">${escapeHtml(number(entry.contribution, 2))}</td></tr>`,
    )
    .join('');

  return chapter(
    '4 · Pesaing',
    'Nilai Kondisi Persaingan mengukur ruang peluang, bukan jumlah pesaing. Semakin padat pasarnya, semakin nilainya mendekati 0 meski daftar di bawah berisi data.',
    `${scaleMeter(SATURATION_STEPS, SATURATION_ORDER.indexOf(competition.reading), tone)}
    <p><strong style="color:${TONE_TEXT[tone]}">${escapeHtml(SATURATION_LABELS[competition.reading])}</strong> untuk ${escapeHtml(
      BUSINESS_TYPE_LABELS[analysis.businessType],
    )} di radius ${escapeHtml(formatDistance(competition.radiusMeters))}.</p>

    <dl class="facts">
      <div><dt>Usaha sejenis</dt><dd>${escapeHtml(number(competition.rawCount))}</dd></div>
      <div><dt>Setara kompetitor</dt><dd>${escapeHtml(number(competition.equivalentCount, 2))}</dd></div>
      <div><dt>Kepadatan</dt><dd>${escapeHtml(DENSITY_LABELS[competition.density])}</dd></div>
      <div><dt>Rasio teknis</dt><dd>${escapeHtml(number(competition.saturationRatio, 2))}</dd></div>
    </dl>
    <p class="muted">Jumlah pesaing disesuaikan menurut jarak, kualitas data, jam operasional, kemiripan usaha, dan skala. Rasio teknis bukan persentase keuntungan.</p>

    <h3>Sebaran pesaing menurut jarak</h3>
    ${stackedBar([
      { label: 'Sangat dekat, 0–300 m', value: zoneTotals.a, color: TONE_INK.bad },
      { label: 'Cukup dekat, 300–800 m', value: zoneTotals.b, color: TONE_INK.poor },
      { label: 'Area terluar, 800 m–1,5 km', value: zoneTotals.c, color: TONE_INK.neutral },
    ])}

    ${
      counted.length === 0
        ? ''
        : `<h3>Kelompok usaha sejenis (${counted.length})</h3><table><thead><tr><th>Jumlah</th><th>Jarak</th></tr></thead><tbody>${countedRows}</tbody></table>`
    }
    ${
      named.length === 0
        ? '<p class="muted">Nama pesaing belum tersedia pada data peta terbuka.</p>'
        : `<h3>Nama pesaing terdekat (${named.length})</h3><table class="wide"><thead><tr><th>Nama</th><th>Jenis</th><th>Jarak</th><th class="num">Ukur</th></tr></thead><tbody>${namedRows}</tbody></table>`
    }
    ${
      counted.length > 0 || mapped.length === 0
        ? ''
        : `<h3>Pesaing terkuat (${mapped.length})</h3><table class="wide"><thead><tr><th>Nama</th><th>Jenis</th><th class="num">Jarak</th><th class="num">Setara</th></tr></thead><tbody>${mappedRows}</tbody></table>`
    }
    <p class="muted">${
      analysis.dataSource.places.status === 'used'
        ? 'Jumlah dan skor memakai hitungan Google Maps per zona. Nama di atas hanya contoh dari data peta terbuka dan tidak dihitung dua kali.'
        : 'Jumlah, skor, dan nama memakai data peta terbuka. Daftar nama dapat belum lengkap dan perlu dicek langsung.'
    }</p>`,
  );
}

/* ── Attribution ───────────────────────────────────────────────────────── */

function footer(dataSource: DataSource, modelVersion: string): string {
  const credits = [`Data © OpenStreetMap contributors, ${dataSource.licence}`];
  if (dataSource.places.status === 'used') credits.push(`Jumlah usaha: ${dataSource.places.attribution ?? 'Google Maps'}`);
  if (dataSource.overture !== null) credits.push(`Fotokopi & ATK: ${dataSource.overture.attribution}`);

  return `<footer class="report-footer">
    <p><strong>Sumber data.</strong> ${escapeHtml(credits.join(' · '))}</p>
    <p>${dataSource.via === 'snapshot' ? 'Snapshot' : 'Diambil'} ${escapeHtml(
      formatDateTime(dataSource.fetchedAt),
    )} · model ${escapeHtml(modelVersion)}${dataSource.stale ? ' · memakai data tersimpan karena sumber sedang tidak tersedia' : ''}</p>
    <p class="disclaimer">Skor membantu membandingkan lokasi, bukan menjamin keuntungan. Cek sewa, banjir, legalitas, lalu lintas, dan kondisi lapangan sebelum berinvestasi.</p>
  </footer>`;
}

/* ── Document ──────────────────────────────────────────────────────────── */

const STYLES = `
  @page { size: A4; margin: 14mm; }
  /* Charts are the point of this document, and browsers drop background colours
     when printing unless told otherwise. */
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: ${INK}; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; line-height: 1.5; }
  h1 { margin: 4px 0 2px; font-size: 24pt; letter-spacing: -0.02em; }
  h2 { margin: 0 0 4px; font-size: 14pt; color: ${BRAND}; }
  h3 { margin: 16px 0 6px; font-size: 10.5pt; letter-spacing: 0.04em; text-transform: uppercase; color: ${MUTED}; }
  h4 { margin: 10px 0 4px; font-size: 10pt; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0; padding-left: 18px; }
  li { margin: 2px 0; }
  .muted { color: ${MUTED}; font-size: 9pt; }
  .lead { color: ${MUTED}; margin: 0 0 12px; }

  .cover { padding-bottom: 10px; border-bottom: 3px solid ${INK}; }
  .cover-brand { display: flex; align-items: baseline; gap: 10px; }
  .cover-mark { font-size: 13pt; font-weight: 800; letter-spacing: 0.08em; color: ${BRAND}; }
  .cover-kind { font-size: 9pt; color: ${MUTED}; }
  .cover-meta { margin: 0; color: ${MUTED}; font-size: 9pt; }

  .hero { display: flex; gap: 20px; align-items: flex-start; padding: 14px 0 4px; }
  .hero-figure { flex: 0 0 auto; text-align: center; }
  .hero-body { flex: 1 1 auto; min-width: 0; }
  .hero-body h2 { font-size: 13pt; color: ${INK}; }
  .chip { display: inline-block; margin-top: 4px; padding: 2px 10px; border-radius: 999px; font-size: 9pt; font-weight: 700; }

  .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; margin: 10px 0 0; }
  .facts > div { border-top: 1px solid ${RULE}; padding-top: 4px; }
  .facts dt { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: ${MUTED}; }
  .facts dd { margin: 0; font-size: 11pt; font-weight: 700; }

  /* Deliberately no break-inside rule on the chapter itself: most chapters are
     taller than the space left on a page, so asking to keep one whole pushes it
     to the next page and leaves the previous one half empty. The small units
     below are the ones worth keeping together. */
  .chapter { margin-top: 22px; padding-top: 12px; border-top: 1px solid ${RULE}; }
  .chapter h2, h3, h4 { break-after: avoid; }
  tr, .bar-row, .facts > div, .stack, .meter { break-inside: avoid; }
  table, .split { break-inside: auto; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .reasons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 9pt; }
  th, td { padding: 5px 6px; text-align: left; border-bottom: 1px solid ${RULE}; vertical-align: top; }
  th { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: ${MUTED}; border-bottom: 1px solid ${INK}; }
  tfoot td { font-weight: 700; border-bottom: 0; border-top: 1px solid ${INK}; }
  .num { text-align: right; }
  table.wide td { font-size: 9pt; }

  .bar-chart { display: grid; gap: 9px; margin: 10px 0 14px; }
  .bar-row { break-inside: avoid; }
  .bar-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .bar-label { font-weight: 650; font-size: 9.5pt; }
  .bar-value { font-weight: 700; font-size: 9.5pt; white-space: nowrap; }
  .bar-track { position: relative; height: 9px; margin-top: 3px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: 999px; }
  .bar-note { margin: 2px 0 0; font-size: 8pt; color: ${MUTED}; }

  .stack { display: flex; height: 14px; margin: 6px 0 4px; border-radius: 4px; overflow: hidden; }
  .stack > span { display: block; height: 100%; }
  .stack-keys { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 8.5pt; color: ${MUTED}; }
  .key { display: inline-flex; align-items: center; gap: 5px; }
  .key i { width: 9px; height: 9px; border-radius: 2px; }

  .meter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; margin: 4px 0 8px; }
  .meter-step { padding: 4px 2px; text-align: center; font-size: 8pt; font-weight: 650; border-radius: 3px; }

  .notice { padding: 8px 10px; background: #fef9c3; border-left: 3px solid #ca8a04; font-size: 9pt; }
  .warn-list { margin: 4px 0; }
  .tag { display: inline-block; margin: 0 2px 2px 0; padding: 1px 7px; background: #f1f5f9; border-radius: 999px; font-size: 8pt; }

  .report-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid ${INK}; font-size: 8.5pt; color: ${MUTED}; }
  .disclaimer { font-style: italic; }
  .donut { display: block; }
`;

export function reportHtml(data: ReportData): string {
  const generatedAt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const { analysis } = data;

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan LOKABIS — ${escapeHtml(BUSINESS_TYPE_LABELS[analysis.businessType])}</title>
<style>${STYLES}</style>
</head>
<body>
${cover(analysis, generatedAt)}
${scoreChapter(analysis)}
${recommendChapter(data.recommend, analysis.businessType)}
${segmentsChapter(data)}
${competitionChapter(analysis)}
${footer(analysis.dataSource, analysis.modelVersion)}
</body>
</html>`;
}

/** Shown while the chapters behind their own endpoints are still being collected. */
export const PREPARING_HTML = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Menyiapkan laporan…</title>
<style>body{margin:0;display:grid;place-items:center;height:100vh;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#14213d}
p{color:#64748b}h1{font-size:15pt;color:#0f766e;letter-spacing:.08em}</style></head>
<body><div><h1>LOKABIS</h1><p>Menyiapkan laporan lengkap…</p></div></body></html>`;

export function writeReport(target: Window, data: ReportData): void {
  target.document.open();
  target.document.write(reportHtml(data));
  target.document.close();
  // Printed after the document settles, so the charts are laid out before the
  // dialog samples the page.
  target.setTimeout(() => target.print(), 250);
}
