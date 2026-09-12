import { Card } from '../../components/Card';
import { Attribution, StaleDataNotice } from '../../components/Notices';
import type { AnalysisResponse, Competitor } from '../../lib/api-types';
import { BUSINESS_TYPE_LABELS, DENSITY_LABELS, FACILITY_KIND_LABELS } from '../../lib/copy';
import { formatDistance, formatZone } from '../../lib/format';
import { SaturationMeter } from './SaturationMeter';

export function CompetitionView({ analysis }: { analysis: AnalysisResponse }) {
  const { competition } = analysis;
  const businessLabel = BUSINESS_TYPE_LABELS[analysis.businessType];

  return (
    <div className="competition">
      {analysis.dataSource.stale && <StaleDataNotice fetchedAt={analysis.dataSource.fetchedAt} />}

      <Card>
        <SaturationMeter ratio={competition.saturationRatio} reading={competition.reading} />
      </Card>

      <dl className="stats">
        <div>
          <dt>Setara kompetitor</dt>
          <dd>{competition.equivalentCount.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Ditemukan dalam {formatDistance(competition.radiusMeters)}</dt>
          <dd>{competition.rawCount}</dd>
        </div>
        <div>
          <dt>Kepadatan</dt>
          <dd>{DENSITY_LABELS[competition.density]}</dd>
        </div>
        <div>
          <dt>Radius pencarian</dt>
          <dd>{formatDistance(competition.radiusMeters)}</dd>
        </div>
      </dl>

      <p className="lead">
        Jumlah toko mentah bukan ukurannya. Tiap usaha ditimbang berdasarkan jarak, kebaruan data, jam operasional,
        seberapa mirip dia dengan {businessLabel.toLowerCase()}, dan skalanya. Rasio kejenuhan membandingkan total itu
        dengan permintaan yang dimiliki lokasi ini.
      </p>

      {competition.equivalentCount === 0 && (
        <p className="notice">
          Tidak ada kompetitor ditemukan di sekitar sini. LOKABIS menganggap ini sebagai permintaan yang belum
          terbukti, bukan pasar yang masih kosong — jadi nilai Peluang Persaingan justru dikurangi.
        </p>
      )}

      {competition.strongest.length > 0 && (
        <Card title="Kompetitor terkuat" note={`${competition.strongest.length} teratas`}>
          <ul className="competitor-list">
            {competition.strongest.map((competitor) => (
              <li key={competitor.id}>
                <div>
                  <span className="competitor-name">{competitorName(competitor)}</span>
                  <span className="competitor-meta">{competitorDetail(competitor)}</span>
                </div>
                <span className="competitor-weight" title="Kontribusi ke hitungan setara kompetitor">
                  {competitor.contribution.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="disclaimer">
        Usaha yang sudah tutup tapi datanya belum diperbarui tetap ikut terhitung, dan banyak usaha kecil tidak
        tercatat di peta manapun. Periksa kompetitornya langsung di lokasi.
      </p>

      <Attribution dataSource={analysis.dataSource} />
    </div>
  );
}

function competitorName(competitor: Competitor): string {
  const label = FACILITY_KIND_LABELS[competitor.kind];
  if (competitor.distanceMeters === null) return `${competitor.count} × ${label}`;
  return competitor.name ?? label;
}

/** A counted group has no position, only the zone it lies in. */
function competitorDetail(competitor: Competitor): string {
  const label = FACILITY_KIND_LABELS[competitor.kind];
  if (competitor.distanceMeters === null) {
    const source = competitor.source === 'google' ? 'dihitung oleh Google Maps' : `dihitung oleh ${competitor.source}`;
    return `${formatZone(competitor.zone)} · ${source}`;
  }
  const source = competitor.source === 'overture' ? ' · dari Overture Maps' : '';
  return `${label} · ${formatDistance(competitor.distanceMeters)}${source}`;
}
