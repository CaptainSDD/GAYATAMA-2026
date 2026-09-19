import { Link } from 'react-router-dom';
import lokabisLogo from '../../assets/lokabis-logo.png';
import { CheckIcon } from '../../components/Icons';

/**
 * Draft membership page.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EVERYTHING IN `TIERS` IS A PLACEHOLDER AND NONE OF IT IS A COMMITMENT.
 *
 * PRODUCT.md records two things this page has to respect: LOKABIS is free at
 * the point of use — that is the SDG 8.3 thesis, not a marketing line — and no
 * pricing, licensing or commercial claim exists to be quoted. So the prices
 * here are deliberately left as an em dash rather than invented, and the
 * feature split is a suggestion drawn from features that already ship, not a
 * decision about what stops being free.
 *
 * To make this page real, edit `TIERS` below and delete `DRAFT`.
 * ────────────────────────────────────────────────────────────────────────────
 */
const DRAFT = true;

interface Tier {
  id: string;
  name: string;
  /** Left as null until a real number exists. */
  price: string | null;
  period: string;
  summary: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'gratis',
    name: 'Gratis',
    price: 'Rp 0',
    period: 'selamanya',
    summary: 'Menilai satu lokasi untuk satu jenis usaha, lengkap dengan bukti dan tingkat keyakinannya.',
    features: [
      'Skor potensi lokasi 0–100',
      'Rentang ketidakpastian dan skor kepercayaan',
      'Faktor pendukung dan risiko utama',
      'Peta dengan zona 300 / 800 / 1.500 m',
    ],
    cta: 'Mulai sekarang',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: null,
    period: 'per bulan',
    summary: 'Untuk yang sedang membandingkan beberapa pilihan sebelum menandatangani kontrak sewa.',
    features: [
      'Semua yang ada di Gratis',
      'Bandingkan dua lokasi berdampingan',
      'Peringkat tujuh kategori usaha sekaligus',
      'Simulasi parkir dan jam buka',
      'Peta peluang 3 × 3 di sekitar titik',
      'Ekspor laporan PDF',
    ],
    cta: 'Pilih Pro',
    featured: true,
  },
  {
    id: 'koperasi',
    name: 'Koperasi',
    price: null,
    period: 'per bulan',
    summary: 'Untuk koperasi, pendamping UMKM, dan pemerintah daerah yang mendampingi banyak pelaku usaha.',
    features: [
      'Semua yang ada di Pro',
      'Beberapa akun dalam satu kelompok',
      'Riwayat analisis bersama',
      'Dukungan untuk pendampingan lapangan',
    ],
    cta: 'Hubungi kami',
  },
];

export function MembershipPage() {
  return (
    <div className="membership-page">
      <header className="membership-header">
        <Link to="/" className="membership-brand">
          <img src={lokabisLogo} alt="LOKABIS" width={132} height={44} />
        </Link>
      </header>

      <main className="membership-main">
        {DRAFT && (
          <p className="notice membership-draft" role="status">
            Halaman contoh. Harga dan pembagian fitur di bawah belum ditetapkan dan bukan penawaran.
          </p>
        )}

        <div className="membership-intro">
          <h1>Pilih paket yang sesuai</h1>
          <p className="membership-lede">
            Penilaian lokasi LOKABIS dibangun di atas data terbuka dan tetap gratis untuk dipakai siapa pun. Paket
            berbayar menambah alat bagi yang sedang membandingkan banyak pilihan.
          </p>
        </div>

        <ul className="membership-tiers">
          {TIERS.map((tier) => (
            <li key={tier.id}>
              <article className="membership-tier" data-featured={tier.featured === true}>
                <h2 className="membership-tier-name">{tier.name}</h2>

                <p className="membership-price">
                  {tier.price === null ? (
                    <>
                      <span className="membership-price-blank" aria-label="Harga belum ditetapkan">
                        —
                      </span>
                      <span className="membership-period">harga belum ditetapkan</span>
                    </>
                  ) : (
                    <>
                      <span className="membership-price-value">{tier.price}</span>
                      <span className="membership-period">{tier.period}</span>
                    </>
                  )}
                </p>

                <p className="membership-summary">{tier.summary}</p>

                <ul className="membership-features">
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon size={16} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button type="button" className={tier.featured === true ? 'button-primary' : 'button-secondary'} disabled={DRAFT}>
                  {tier.cta}
                </button>
              </article>
            </li>
          ))}
        </ul>

        <p className="membership-foot">
          Data lokasi berasal dari OpenStreetMap dan kontributornya. Skor dihitung oleh model LOKABIS dan selalu
          disertai rentang ketidakpastiannya — paket mana pun tidak mengubah cara skor dihitung.
        </p>
      </main>
    </div>
  );
}
