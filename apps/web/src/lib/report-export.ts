import type { AnalysisResponse } from './api-types';
import { BUSINESS_TYPE_LABELS, COMPONENT_LABELS, SEGMENT_LABELS } from './copy';
import { displayScore, formatCoordinate, formatRange } from './format';

const escapeHtml = (value: string | number): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

function reportHtml(analysis: AnalysisResponse): string {
  const generatedAt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const components = Object.entries(analysis.components)
    .map(([key, component]) => `<tr><td>${escapeHtml(COMPONENT_LABELS[key as keyof typeof COMPONENT_LABELS])}</td><td>${component.value.toFixed(1)}</td><td>${Math.round(component.weight * 100)}%</td></tr>`)
    .join('');
  const segments = Object.entries(analysis.segments)
    .map(([key, segment]) => `<tr><td>${escapeHtml(SEGMENT_LABELS[key as keyof typeof SEGMENT_LABELS])}</td><td>${segment.score.toFixed(1)}</td><td>${escapeHtml(segment.role)}</td></tr>`)
    .join('');
  const competitors = analysis.competition.strongest.length === 0
    ? '<p>Tidak ada pesaing yang terpetakan dalam radius analisis.</p>'
    : `<table><thead><tr><th>Usaha</th><th>Zona</th><th>Jumlah</th></tr></thead><tbody>${analysis.competition.strongest
        .map((entry) => `<tr><td>${escapeHtml(entry.name ?? entry.kind)}</td><td>${escapeHtml(entry.zone.toUpperCase())}</td><td>${entry.count}</td></tr>`)
        .join('')}</tbody></table>`;
  const warnings = analysis.warnings.length === 0 ? '<p>Tidak ada peringatan khusus dari data yang tersedia.</p>' : `<ul>${analysis.warnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join('')}</ul>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan LOKABIS</title><style>
    @page { size: A4; margin: 18mm; } * { box-sizing: border-box; } body { color:#14213d; font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; font-size:10.5pt; line-height:1.45; } h1 { color:#0f766e; margin:0; font-size:25pt; } h2 { color:#0f766e; font-size:14pt; margin:24px 0 8px; border-bottom:1px solid #cbd5e1; padding-bottom:4px; } p { margin:6px 0; } .meta { color:#64748b; } .hero { margin:18px 0; padding:16px; background:#ecfeff; border:1px solid #0f766e; } .score { font-size:34pt; font-weight:700; color:#0f172a; } .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; } table { width:100%; border-collapse:collapse; margin-top:8px; } th,td { padding:7px; text-align:left; border-bottom:1px solid #e2e8f0; } th { color:#475569; font-size:9pt; text-transform:uppercase; } .footer { margin-top:28px; padding-top:10px; border-top:1px solid #cbd5e1; color:#64748b; font-size:8.5pt; } @media print { .no-print { display:none; } }
  </style></head><body><header><h1>LOKABIS</h1><p class="meta">Laporan analisis lokasi - dibuat ${escapeHtml(generatedAt)}</p></header>
  <section class="hero"><strong>${escapeHtml(BUSINESS_TYPE_LABELS[analysis.businessType])}</strong><div class="score">${escapeHtml(displayScore(analysis.score.value))}/100</div><p>${escapeHtml(analysis.score.band)} · Rentang ${escapeHtml(formatRange(analysis.score))} · Keyakinan ${Math.round(analysis.score.confidence)}/100</p><p>Koordinat: ${escapeHtml(formatCoordinate(analysis.location))}</p></section>
  <h2>Ringkasan</h2><p><strong>${escapeHtml(analysis.narrative.headline)}</strong></p><p>${escapeHtml(analysis.narrative.summary)}</p>
  <div class="grid"><section><h2>Komponen skor</h2><table><thead><tr><th>Indikator</th><th>Nilai</th><th>Bobot</th></tr></thead><tbody>${components}</tbody></table></section><section><h2>Target pelanggan</h2><table><thead><tr><th>Segmen</th><th>Nilai</th><th>Peran</th></tr></thead><tbody>${segments}</tbody></table></section></div>
  <h2>Persaingan</h2><p>${analysis.competition.rawCount} pesaing terpetakan · Rasio kejenuhan ${analysis.competition.saturationRatio.toFixed(2)}</p>${competitors}
  <h2>Peringatan</h2>${warnings}
  <h2>Langkah berikutnya</h2><ol>${analysis.narrative.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
  <footer class="footer">Sumber data: ${escapeHtml(analysis.dataSource.attribution)}. Data dianalisis pada ${escapeHtml(analysis.dataSource.fetchedAt)}. Skor membantu membandingkan lokasi, bukan menjamin keuntungan.</footer>
  <script>window.onload=()=>window.print();</script></body></html>`;
}

export function exportReport(analysis: AnalysisResponse): void {
  // `noopener,noreferrer` in the feature string makes some browsers return
  // `null` even though they have opened a blank tab. Write the report first,
  // then explicitly sever the opener, so the blank page is never left behind.
  const report = window.open('', '_blank');
  if (report === null) {
    window.alert('Browser memblokir jendela laporan. Izinkan pop-up lalu coba lagi.');
    return;
  }
  report.opener = null;
  report.document.open();
  report.document.write(reportHtml(analysis));
  report.document.close();
}
