import {
  band,
  COMPONENT_KEYS,
  COMPONENT_WEIGHTS,
  locationScore,
  scoreRange,
  uncertaintyMargin,
  type ComponentKey,
} from '@gayatama/scoring';
import { lazy, Suspense, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import lokabisLogo from '../../assets/lokabis-logo.png';
import { bandTone, toneChip } from '../../lib/band-color';
import { BAND_LABELS, BUSINESS_TYPE_LABELS, COMPONENT_LABELS } from '../../lib/copy';
import { LANDING_EXAMPLE } from './landingExample';
import { ScoreBreakdown } from './ScoreBreakdown';
import { SevenAnswers } from './SevenAnswers';
import { WhenWeDecline } from './WhenWeDecline';
import { ZonesDiagram } from './ZonesDiagram';
import { useActiveLandingSection, useHeroExit, useScrollReveal } from './useScrollReveal';

const LandingMap = lazy(() => import('./LandingMap'));

const EXAMPLE_TOTAL = locationScore(LANDING_EXAMPLE.components);
const EXAMPLE_SCORE = Math.round(EXAMPLE_TOTAL);
const EXAMPLE_BAND = band(EXAMPLE_SCORE);
const EXAMPLE_MARGIN = uncertaintyMargin(LANDING_EXAMPLE.confidence);
const EXAMPLE_RANGE = scoreRange(EXAMPLE_SCORE, EXAMPLE_MARGIN);
const EXAMPLE_STRENGTHS = [...COMPONENT_KEYS]
  .sort((a, b) => LANDING_EXAMPLE.components[b] - LANDING_EXAMPLE.components[a])
  .slice(0, 3);
const EXAMPLE_SNAPSHOT_DATE = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(LANDING_EXAMPLE.source.osmSnapshotAt));

const COMPONENT_EXPLANATIONS: Record<ComponentKey, string> = {
  demandFit:
    'Kekuatan segmen pelanggan yang relevan: pelajar, pekerja kantor, warga, pengguna transit, dan pengunjung fasilitas kesehatan.',
  accessibility: 'Kelas dan lebar jalan, angkutan umum, kemudahan berjalan kaki, serta kapasitas parkir.',
  competition: 'Kejenuhan pesaing dibandingkan permintaan yang tersedia untuk jenis usaha ini.',
  supportingFacility: 'Kedekatan fasilitas yang mendukung transaksi untuk jenis usaha ini.',
  risk: 'Banjir, zonasi, gangguan lingkungan, ukuran tempat, drainase, dan kebutuhan operasional.',
};

const SECTIONS = [
  { id: 'bukti', label: 'Bukti' },
  { id: 'jawaban', label: 'Jawaban' },
  { id: 'zona', label: 'Zona' },
  { id: 'metode', label: 'Metode' },
] as const;
const SECTION_IDS = SECTIONS.map(({ id }) => id);

function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 3.5v12m0 0 4-4m-4 4-4-4" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 16.5v-12m0 0-4 4m4-4 4 4" />
    </svg>
  );
}

export function LandingPage() {
  const heroEnd = useRef<HTMLDivElement>(null);
  const activeSection = useActiveLandingSection(SECTION_IDS);
  useScrollReveal();
  useHeroExit(heroEnd);

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-nav-brand" href="#top" aria-label="LOKABIS, ke atas halaman">
          <img src={lokabisLogo} alt="" width={132} height={44} />
        </a>

        <div className="landing-nav-pill">
          <nav className="landing-nav-links" aria-label="Bagian halaman">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={activeSection === section.id ? 'location' : undefined}
              >
                {section.label}
              </a>
            ))}
          </nav>
          <Link className="landing-nav-login" to="/login">
            Masuk
          </Link>
        </div>

        <Link className="landing-nav-action" to="/signup">
          Nilai lokasi gratis
        </Link>
      </header>

      <main className="landing-main" id="top">
        <div className="landing-opening" data-reveal-eager="">
          <section className="landing-hero">
            <div className="landing-sky">
              <div className="landing-sky-inner">
                <Suspense fallback={null}>
                  <LandingMap />
                </Suspense>
              </div>
            </div>

            <h1 className="landing-title">
              <span className="landing-title-line" data-reveal="line">
                Tahu sebelum
              </span>
              <span
                className="landing-title-line landing-title-line-indent"
                data-reveal="line"
                style={{ '--delay': '90ms' } as CSSProperties}
              >
                <svg className="landing-title-rings" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                  <circle cx="60" cy="60" r="58" />
                  <circle cx="60" cy="60" r="31" />
                  <circle cx="60" cy="60" r="12" />
                </svg>
                tanda tangan.
              </span>
            </h1>

            <div className="landing-hero-foot" data-reveal="rise" style={{ '--delay': '220ms' } as CSSProperties}>
              <p className="landing-deck">
                Skor 0–100 untuk satu titik dan satu jenis usaha, lengkap dengan rentang ketidakpastiannya dan fasilitas
                yang menghasilkannya.
              </p>
              <p className="landing-hero-availability">
                <strong>Skor inti gratis</strong> · Saat ini tersedia untuk Kota Semarang.
              </p>
              <div className="landing-hero-meta">
                <a className="landing-hero-next" href="#bukti">
                  Lihat cara titik ini dibaca
                  <ArrowDownIcon />
                </a>
                <p className="landing-credit">
                  Peta{' '}
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                    © OpenStreetMap contributors
                  </a>
                  , ODbL 1.0
                </p>
              </div>
            </div>

            <div ref={heroEnd} className="landing-hero-sentinel" aria-hidden="true" />
          </section>

          <section className="landing-slab" id="bukti" aria-labelledby="landing-slab-title" data-reveal="slab">
            <div className="landing-slab-lede">
              <h2 id="landing-slab-title">
                Satu titik,
                <br />
                dibaca lengkap.
              </h2>
              <p>
                Setiap skor terurai kembali menjadi fasilitas, jarak dan mutu data yang menghasilkannya. Angka yang
                tidak bisa Anda bongkar sendiri belum menjawab apa pun.
              </p>
              <p className="landing-lede-action">
                <Link className="landing-cta" to="/signup">
                  Nilai lokasi gratis
                </Link>
                <span className="landing-lede-action-note">Satu lokasi, satu jenis usaha · saat ini Kota Semarang.</span>
              </p>
              <p className="landing-lede-flow">Pilih jenis usaha → tandai lokasi → periksa skor dan buktinya.</p>
            </div>

            <article className="landing-tile landing-tile-claim landing-tile-uncertainty">
              <h3>Angkanya membawa ketidakpastiannya</h3>
              <div className="landing-interval" aria-hidden="true">
                <span className="landing-interval-track">
                  <span
                    className="landing-interval-span"
                    style={{ left: `${EXAMPLE_RANGE[0]}%`, width: `${EXAMPLE_RANGE[1] - EXAMPLE_RANGE[0]}%` }}
                  />
                  <span className="landing-interval-mark" style={{ left: `${EXAMPLE_SCORE}%` }} />
                </span>
                <span className="landing-interval-scale">
                  <span>0</span>
                  <span className="landing-interval-read">
                    {EXAMPLE_RANGE[0]}–{EXAMPLE_RANGE[1]}
                  </span>
                  <span>100</span>
                </span>
              </div>
              <p>
                Selalu {EXAMPLE_SCORE} ± {EXAMPLE_MARGIN}, tidak pernah {EXAMPLE_SCORE} saja. Kalau datanya tipis,
                rentangnya melebar — dan di bawah batas keyakinan,{' '}
                <a className="landing-inline-link" href="#batas">
                  LOKABIS menolak menjawab
                </a>
                .
              </p>
            </article>

            <article className="landing-tile landing-tile-claim landing-tile-claim-prose landing-tile-data">
              <h3>Tidak mengarang data kependudukan</h3>
              <p>
                Tidak ada jumlah penduduk atau tingkat pendapatan yang tidak bisa kami sebut sumbernya. Fasilitas
                sekitar dibaca sebagai indikator, bukan sebagai kepala yang dihitung.
              </p>
            </article>

            <article className="landing-tile landing-tile-result">
              <div className="landing-result-head">
                <p className="landing-result-figure">
                  <span className="landing-result-value">{EXAMPLE_SCORE}</span>
                  <span className="landing-result-margin">± {EXAMPLE_MARGIN}</span>
                  <span className={`${toneChip(bandTone(EXAMPLE_BAND))} chip-lg`}>{BAND_LABELS[EXAMPLE_BAND]}</span>
                </p>
                <p className="landing-result-where">
                  {BUSINESS_TYPE_LABELS[LANDING_EXAMPLE.featuredBusiness]} · {LANDING_EXAMPLE.label}
                </p>
                <p className="landing-result-source">
                  Snapshot OpenStreetMap {EXAMPLE_SNAPSHOT_DATE} · model LOKABIS v{LANDING_EXAMPLE.source.modelVersion}
                  <br />
                  {LANDING_EXAMPLE.source.warning}
                </p>
              </div>

              <ul className="landing-result-evidence">
                {EXAMPLE_STRENGTHS.map((key) => (
                  <li key={key}>
                    <span className="landing-result-evidence-name">{COMPONENT_LABELS[key]}</span>
                    <span className="landing-result-evidence-value">
                      {Math.round(LANDING_EXAMPLE.components[key])}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="landing-result-range">
                Kemungkinan sebenarnya antara {EXAMPLE_RANGE[0]} dan {EXAMPLE_RANGE[1]}.
              </p>
              <ScoreBreakdown components={LANDING_EXAMPLE.components} total={EXAMPLE_TOTAL} />
            </article>

            <article className="landing-tile landing-tile-dark">
              <h3>Skornya per jenis usaha, bukan per lokasi</h3>
              <p>
                Tempat yang bagus untuk laundry bisa buruk untuk apotek. Sebuah lokasi hanya pernah bagus untuk
                sesuatu, jadi jenis usaha bukan keterangan tambahan; dia setengah dari pertanyaannya.
              </p>
            </article>
          </section>
        </div>

        <SevenAnswers />
        <ZonesDiagram />
        <WhenWeDecline />

        <section className="landing-method" id="metode" aria-labelledby="landing-method-title">
          <div className="landing-method-lede" data-reveal="rise">
            <h2 id="landing-method-title">Rumusnya terbuka.</h2>
            <p>
              Bobotnya adalah penilaian yang didokumentasikan, bukan parameter hasil pengepasan data — ditulis supaya
              bisa dibantah, bukan supaya terdengar pasti. Setiap contoh perhitungan di dokumentasi diuji oleh mesin
              skornya sendiri, jadi dokumentasi tidak bisa menyimpang dari kode tanpa membuat build gagal.
            </p>
            <p className="landing-method-link">
              <a
                className="landing-textlink"
                href="https://github.com/CaptainSDD/GAYATAMA-2026/blob/main/docs/methodology.md"
                target="_blank"
                rel="noreferrer"
                aria-label="Lihat metodologi lengkapnya, terbuka di tab baru"
              >
                Lihat metodologi lengkapnya
              </a>{' '}
              <span className="muted">— rumus, ambang, dan rujukan akademiknya. Dokumen teknis, berbahasa Inggris.</span>
            </p>
          </div>

          <ol className="landing-weights">
            {COMPONENT_KEYS.map((key, index) => (
              <li key={key}>
                <details
                  className="landing-weight"
                  data-reveal="weight"
                  style={{ ['--w' as string]: COMPONENT_WEIGHTS[key], ['--delay' as string]: `${index * 70}ms` }}
                >
                  <summary>
                    <span className="landing-weight-name">{COMPONENT_LABELS[key]}</span>
                    <span className="landing-weight-value">{Math.round(COMPONENT_WEIGHTS[key] * 100)}%</span>
                    <span className="landing-weight-track" aria-hidden="true">
                      <span className="landing-weight-bar" />
                    </span>
                  </summary>
                  <p className="landing-weight-copy">{COMPONENT_EXPLANATIONS[key]}</p>
                </details>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-close" aria-labelledby="landing-close-title" data-reveal="rise">
          <h2 id="landing-close-title">Nilai satu lokasi sebelum Anda terikat padanya.</h2>
          <Link className="landing-cta" to="/signup" aria-describedby="landing-close-note">
            Nilai lokasi gratis
          </Link>
          <p className="landing-close-note" id="landing-close-note">
            Menilai satu lokasi untuk satu jenis usaha gratis — saat ini untuk Kota Semarang. Alat perbandingan dan
            ekspor sedang disiapkan sebagai paket berbayar.
          </p>
        </section>
      </main>

      <footer className="landing-foot">
        <a className="landing-back-top" href="#top">
          Kembali ke atas
          <ArrowUpIcon />
        </a>
        <nav className="landing-foot-nav" aria-label="Bagian halaman">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>
        <p>
          Data © OpenStreetMap contributors, ODbL 1.0; data tempat tambahan © Overture Maps Foundation,
          CDLA-Permissive-2.0. Skor dihitung oleh model LOKABIS dan selalu disertai rentang ketidakpastiannya.
        </p>
      </footer>
    </div>
  );
}
