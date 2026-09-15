import { Card } from '../../components/Card';
import { Attribution, StaleDataNotice } from '../../components/Notices';
import type { AnalysisResponse, Competitor, NamedCompetitor } from '../../lib/api-types';
import { BUSINESS_TYPE_LABELS, FACILITY_KIND_LABELS } from '../../lib/copy';
import { formatDistance, formatZone } from '../../lib/format';
import { SaturationMeter } from './SaturationMeter';

export function CompetitionView({ analysis }: { analysis: AnalysisResponse }) {
  const { competition } = analysis;
  const businessLabel = BUSINESS_TYPE_LABELS[analysis.businessType];
  const countedGroups = competition.strongest
    .filter((competitor) => competitor.distanceMeters === null)
    .sort((a, b) => ['a', 'b', 'c'].indexOf(a.zone) - ['a', 'b', 'c'].indexOf(b.zone));
  const mappedStrongest = competition.strongest.filter((competitor) => competitor.distanceMeters !== null);
  const namedCompetitors = competition.namedCompetitors ?? [];
  const usesGoogleCounts = analysis.dataSource.places.status === 'used';

  return (
    <div className="competition">
      {analysis.dataSource.stale && <StaleDataNotice fetchedAt={analysis.dataSource.fetchedAt} />}

      <Card>
        <SaturationMeter reading={competition.reading} businessLabel={businessLabel} />
      </Card>

      <dl className="stats competition-stats">
        <div>
          <dt>Usaha sejenis</dt>
          <dd>{competition.rawCount.toLocaleString('id-ID')}</dd>
          <small>radius {formatDistance(competition.radiusMeters)}</small>
        </div>
        <div>
          <dt>Nama tersedia</dt>
          <dd>{namedCompetitors.length.toLocaleString('id-ID')}</dd>
          <small>data peta terbuka</small>
        </div>
      </dl>

      <details className="panel-disclosure">
        <summary>Cara persaingan dihitung</summary>
        <div className="disclosure-content">
          <p>
            Nilai Kondisi Persaingan mengukur ruang peluang, bukan jumlah pesaing. Semakin padat dan jenuh pasar,
            nilainya semakin mendekati 0 meskipun daftar pesaing berisi data.
          </p>
          <p>
            Jumlah pesaing disesuaikan menurut jarak, kualitas data, jam operasional, kemiripan usaha, dan skala.
            Hasilnya setara {competition.equivalentCount.toLocaleString('id-ID', { maximumFractionDigits: 2 })}{' '}
            kompetitor.
          </p>
          <p className="muted">
            Rasio teknis {competition.saturationRatio.toLocaleString('id-ID', { maximumFractionDigits: 2 })}; bukan
            persentase keuntungan.
          </p>
        </div>
      </details>

      {competition.equivalentCount === 0 && (
        <p className="notice notice-neutral">
          Belum ada pesaing yang ditemukan. Ini juga dapat berarti permintaan belum terbukti, bukan selalu peluang
          pasar kosong.
        </p>
      )}

      {countedGroups.length > 0 && (
        <details className="card panel-disclosure competitor-disclosure">
          <summary>Sebaran usaha sejenis ({countedGroups.length})</summary>
          <div className="disclosure-content">
            <p className="lead">Jumlah dikelompokkan berdasarkan jarak dari titik pilihan.</p>
            <ul className="competitor-list">
              {countedGroups.map((competitor) => (
                <li key={competitor.id}>
                  <div>
                    <span className="competitor-name">
                      {competitor.count.toLocaleString('id-ID')} {competitorName(competitor).toLowerCase()}
                    </span>
                    <span className="competitor-meta">{naturalZone(competitor.zone)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {countedGroups.length > 0 && (
        <details className="card panel-disclosure competitor-disclosure">
          <summary>Nama pesaing terdekat ({namedCompetitors.length})</summary>
          <div className="disclosure-content">
            {namedCompetitors.length > 0 ? (
              <ul className="competitor-list">
                {namedCompetitors.map((competitor) => (
                  <li key={competitor.id}>
                    <div>
                      <span className="competitor-name">{competitor.name}</span>
                      <span className="competitor-meta">{namedCompetitorDetail(competitor)}</span>
                    </div>
                    <span className="competitor-weight">{formatDistance(competitor.distanceMeters)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notice notice-neutral">Nama pesaing belum tersedia pada data peta terbuka.</p>
            )}
            <p className="competitor-source-note">
              {usesGoogleCounts
                ? 'Jumlah dan skor memakai hitungan Google Maps per zona. Nama di atas hanya contoh dari data peta terbuka dan tidak dihitung dua kali.'
                : 'Jumlah, skor, dan nama memakai data peta terbuka. Daftar nama dapat belum lengkap dan perlu dicek langsung.'}
            </p>
          </div>
        </details>
      )}

      {countedGroups.length === 0 && mappedStrongest.length > 0 && (
        <details className="card panel-disclosure competitor-disclosure">
          <summary>Pesaing terkuat ({mappedStrongest.length})</summary>
          <ul className="competitor-list disclosure-content">
            {mappedStrongest.map((competitor) => (
              <li key={competitor.id}>
                <div>
                  <span className="competitor-name">{competitorName(competitor)}</span>
                  <span className="competitor-meta">{competitorDetail(competitor)}</span>
                </div>
                <span className="competitor-weight" title="Kontribusi ke hitungan setara kompetitor">
                  {competitor.contribution.toFixed(2)} setara
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="disclaimer">Data peta dapat belum lengkap. Verifikasi pesaing langsung di sekitar lokasi.</p>
      <Attribution dataSource={analysis.dataSource} />
    </div>
  );
}

function naturalZone(zone: Competitor['zone']): string {
  switch (zone) {
    case 'a':
      return 'Sangat dekat · 0–300 meter';
    case 'b':
      return 'Cukup dekat · 300–800 meter';
    case 'c':
      return 'Area terluar · 800 meter–1,5 kilometer';
  }
}

function competitorName(competitor: Competitor): string {
  const label = FACILITY_KIND_LABELS[competitor.kind];
  if (competitor.distanceMeters === null) return label;
  return competitor.name ?? label;
}

function namedCompetitorDetail(competitor: NamedCompetitor): string {
  const source = competitor.source === 'overture' ? 'Overture Maps' : 'OpenStreetMap';
  return `${FACILITY_KIND_LABELS[competitor.kind]} · ${formatZone(competitor.zone)} · ${source}`;
}

function competitorDetail(competitor: Competitor): string {
  const label = FACILITY_KIND_LABELS[competitor.kind];
  if (competitor.distanceMeters === null) {
    const source = competitor.source === 'google' ? 'dihitung oleh Google Maps' : `dihitung oleh ${competitor.source}`;
    return `${competitor.count} tempat terhitung · ${formatZone(competitor.zone)} · ${source}`;
  }
  const source = competitor.source === 'overture' ? ' · dari Overture Maps' : '';
  return `${label} · ${formatDistance(competitor.distanceMeters)}${source}`;
}
