import { Link } from 'react-router-dom';
import lokabisLogo from '../../assets/lokabis-logo.png';
import { CheckIcon } from '../../components/Icons';

/**
 * The plans page, in the landing page's Studio Sheet rather than the app's
 * Glass Instrument Deck.
 *
 * A visitor reaches `/membership` from the front door or from either auth door,
 * never from inside the analysis deck, so it belongs to the public world: the
 * same ground, the same 30 / 22 / 14px corners, Onest, the one indigo action,
 * and the same ring field the doorway draws behind its plate. `.landing` stays
 * the root class for the same reason it does on `/login` — the `--lp-*` tokens,
 * the resets, the caret, the selection colour and the focus ring are inherited
 * rather than restated — and `.landing-sheet` carries the static bar, the teal
 * breath and the centred main this page shares with the doorway.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE FOUR PRICES ARE DECIDED. THE PAYMENT IS NOT BUILT. BOTH FACTS SHIP.
 *
 * Prices recorded 2026-09-20: Rp 0 for the free core, Rp 25.000 per report,
 * Rp 150.000 per month, Rp 6.000.000 per year for the B2B contract tier. They
 * are held as numbers rather than strings because the page reasons about them:
 * the per-report cell states the point at which the subscription costs less and
 * the contract cell states what it is worth in reports, and both are computed
 * from the constants below. Change a price and the arithmetic that quotes it
 * changes with it — there is no sentence on this page carrying a number that
 * was typed twice.
 *
 * `CHECKOUT_OPEN` is false because nothing in this repository can take money:
 * no payment provider, no usage metering, no orders. So the page states a price
 * and then refuses the purchase, in that order, and says so once at the head
 * rather than hedging every cell. It is no longer a draft — the prices are real
 * and quotable; what is missing is the till.
 *
 * `ready` and `soon` are not a marketing device. `ready` lists what the engine
 * and the app actually do today; `soon` lists what the model promises and the
 * code does not have yet — there is no usage metering, no stored history, no
 * notifications, no interactive Q&A and no unlimited comparison in this
 * repository. PRODUCT.md forbids presenting either one as the other, so the two
 * lists are separated in the markup rather than merged and hedged in copy.
 *
 * Data & insight licensing is deliberately absent. It is a B2B channel, not
 * something a visitor picks here, and advertising aggregated user data on a
 * price list without a published privacy position would be a claim this project
 * has not earned.
 *
 * To open this page for business: move items from `soon` to `ready` as they
 * ship, set `available` on the tiers that can be bought, and flip
 * `CHECKOUT_OPEN`.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** No payment provider, no metering, no orders table. Nothing here can take money yet. */
const CHECKOUT_OPEN = false;

/** The decided prices, in rupiah. Everything else on this page is derived from them. */
const PRICE_REPORT = 25_000;
const PRICE_SUBSCRIPTION = 150_000;
const PRICE_ENTERPRISE = 6_000_000;

/**
 * Indonesian grouping and no currency mark: the `Rp` is set separately, one
 * type step down, so the figures themselves line up down the three-column row
 * and the mark never competes with the number a visitor is comparing.
 */
function groupRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

/**
 * How many reports a price is worth, floored — never rounded, so the count is
 * always one the money actually covers. At Rp 25.000 a report, Rp 6.000.000 is
 * 240 reports and never 241, and if a future price stops dividing evenly the
 * figure understates rather than overstates what is bought.
 */
function reportsWorth(price: number): number {
  return Math.floor(price / PRICE_REPORT);
}

interface Tier {
  id: string;
  name: string;
  /** Rupiah, as a number: the page compares these to each other. */
  price: number;
  /** What the money buys — the billing unit differs on every tier here. */
  unit: string;
  /**
   * One computed line placing this price against another. Only the two tiers
   * where the comparison changes a decision carry it: someone holding a single
   * choice needs to know when the subscription overtakes paying per report, and
   * someone assessing many sites needs the contract in units of report. The
   * subscription cell carries none, because the per-report cell already points
   * at it and saying the same arithmetic twice makes it read as a pitch.
   */
  crossover?: string;
  summary: string;
  /** Capabilities that ship today. */
  ready: string[];
  /** Capabilities the model promises and the code does not have yet. */
  soon: string[];
  /** The control's label where the tier can be acted on. */
  cta: string;
  /**
   * The control's label where it cannot. It names the missing thing rather than
   * saying "unavailable": the price is settled, so what stands in the way is a
   * payment path, or for the contract tier a channel to agree terms on.
   */
  blocked?: string;
  /** Whether the tier can actually be started today. Only the free core can. */
  available?: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'gratis',
    name: 'Gratis',
    price: 0,
    // The quota is the plan, not the behaviour: nothing in the API counts
    // analyses yet, so the unit says so rather than implying a live limit.
    unit: '5 analisis pertama · kuota sedang disiapkan',
    summary:
      'Menilai lokasi untuk satu jenis usaha, lengkap dengan bukti dan tingkat keyakinannya. Cukup untuk menimbang beberapa calon tempat sebelum memutuskan.',
    ready: [
      'Skor potensi lokasi 0–100',
      'Rentang ketidakpastian dan skor kepercayaan',
      'Rekomendasi jenis usaha untuk satu titik',
      'Faktor pendukung dan risiko utama',
      'Peta dengan zona 300 / 800 / 1.500 m',
      'Ringkasan hasil dalam bahasa sehari-hari',
    ],
    soon: [],
    cta: 'Mulai sekarang',
    available: true,
  },
  {
    id: 'laporan',
    name: 'Per laporan',
    price: PRICE_REPORT,
    unit: 'sekali bayar, per laporan',
    // Six reports cost what a month of the subscription costs, so the seventh is
    // where paying per report stops being the cheaper way round. Derived, not
    // written: `+ 1` is the first report the subscription is strictly cheaper
    // than, at any pair of prices.
    crossover: `Mulai laporan ke-${reportsWorth(PRICE_SUBSCRIPTION) + 1} dalam sebulan, langganan lebih murah.`,
    summary: 'Untuk satu keputusan yang sudah dekat: bayar sekali, dapat laporan lengkapnya.',
    ready: [
      'Analisis kompetitor dan tingkat kejenuhan',
      'Enam segmen pasar dengan fasilitas penyebabnya',
      'Bandingkan dua lokasi berdampingan',
      'Peringkat tujuh kategori usaha di satu titik',
      'Simulasi parkir dan jam buka',
      'Laporan PDF siap cetak',
    ],
    soon: ['Pembayaran per laporan'],
    cta: 'Beli laporan',
    blocked: 'Pembayaran belum dibuka',
  },
  {
    id: 'langganan',
    name: 'Langganan',
    price: PRICE_SUBSCRIPTION,
    unit: 'per bulan',
    summary: 'Untuk pemilik usaha yang sedang berkembang dan menimbang lokasi baru lebih dari sekali.',
    ready: ['Semua yang ada di Per laporan', 'Peta peluang 3 × 3 di sekitar satu titik'],
    soon: [
      'Analisis tanpa batas',
      'Bandingkan lokasi tanpa batas jumlah',
      'Peta peluang untuk satu wilayah',
      'Riwayat dan perbandingan banyak lokasi dalam satu dasbor',
      'Pemberitahuan saat kondisi kompetitor berubah',
      'Tanya jawab lanjutan untuk menjajal skenario usaha',
    ],
    cta: 'Mulai langganan',
    blocked: 'Pembayaran belum dibuka',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: PRICE_ENTERPRISE,
    unit: 'per tahun · kontrak B2B',
    // The volume buyer's own unit. Floored, so it is a count the contract
    // certainly covers rather than one it nearly does.
    crossover: `Setara ${groupRupiah(reportsWorth(PRICE_ENTERPRISE))} laporan setahun.`,
    summary:
      'Untuk investor, pemberi waralaba, dan lembaga yang menilai banyak lokasi sekaligus dan perlu laporan yang bisa dipertanggungjawabkan.',
    ready: ['Semua yang ada di Langganan', 'Bukti yang bisa dilacak ke sumbernya di setiap laporan'],
    soon: [
      'Bandingkan banyak lokasi dalam satu laporan',
      'Laporan uji kelayakan untuk calon investor',
      'Izin pakai laporan untuk pemberi waralaba',
      'Harga khusus per laporan di atas volume tertentu',
    ],
    cta: 'Hubungi kami',
    blocked: 'Kontrak belum dibuka',
  },
];

export function MembershipPage() {
  return (
    <div className="landing landing-sheet landing-plans">
      <a className="landing-skip" href="#paket">
        Lewati ke daftar paket
      </a>

      {/* The doorway's bar, with the two doors in place of the counterpart: every
          link here leaves the page, so it sits in the layout rather than over it. */}
      <header className="landing-nav sheet-nav">
        <Link className="landing-nav-brand" to="/" aria-label="LOKABIS, ke halaman utama">
          <img src={lokabisLogo} alt="" width={132} height={44} />
        </Link>

        <div className="landing-nav-pill">
          <nav className="landing-nav-links" aria-label="Halaman LOKABIS">
            <Link to="/">Beranda</Link>
            <Link to="/login">Masuk</Link>
          </nav>
          <Link className="landing-nav-login sheet-nav-counterpart" to="/signup">
            Daftar
          </Link>
        </div>
      </header>

      {/* The same ornament the doorway leaves behind its plate and the hero draws
          over the live map: the engine's real 300 / 800 / 1.500 m radii, hairline,
          at page scale, cropped. Anchored low and left here so the plate's own
          corner is the thing that crosses it. */}
      <span className="sheet-rings" aria-hidden="true">
        <svg viewBox="0 0 120 120" focusable="false">
          <circle className="sheet-ring-outer" cx="60" cy="60" r="58" vectorEffect="non-scaling-stroke" />
          <circle className="sheet-ring-mid" cx="60" cy="60" r="31" vectorEffect="non-scaling-stroke" />
          <circle className="sheet-ring-inner" cx="60" cy="60" r="12" vectorEffect="non-scaling-stroke" />
          <circle className="sheet-ring-point" cx="60" cy="60" r="1.6" />
        </svg>
      </span>

      <main className="sheet-main">
        <div className="plans-head">
          <h1 className="sheet-title">Pilih paket yang sesuai</h1>
          <p className="sheet-deck plans-deck">
            Menilai satu lokasi tetap bisa dicoba tanpa biaya. Paket berbayar menambah alat bagi yang sedang
            membandingkan banyak pilihan, dan tidak mengubah cara skornya dihitung.
          </p>

          {/* The one line no neighbouring product can write. Every number LOKABIS
              produces arrives as an interval, and below its confidence floor the
              product declines to produce one at all — so a page of exact figures
              is the single place that has to be said out loud. It belongs here
              rather than in a footnote: it is what makes the four numbers below
              readable as promises instead of estimates. */}
          <p className="plans-certain">
            Harganya pasti. Ini satu-satunya angka di LOKABIS yang datang tanpa rentang ketidakpastian.
          </p>

          {!CHECKOUT_OPEN && (
            <p className="plans-status" role="status">
              Harga di halaman ini sudah ditetapkan; pembayarannya belum dibuka. Fitur yang ditandai “Sedang
              disiapkan” juga belum bisa dipakai.
            </p>
          )}
        </div>

        {/* One plate, four cells that are not interchangeable. The free tier can
            actually be started today, so it holds a row of its own, the raised
            tile and the page's single indigo element; the three priced tiers take
            the sunken tile and a control that names what is missing. */}
        <div className="sheet-slab plans-slab" id="paket" tabIndex={-1}>
          <ul className="plans-tiers">
            {TIERS.map((tier, index) => {
              const live = tier.available === true;
              return (
                <li key={tier.id}>
                  <article
                    className="plans-tier"
                    data-state={live ? 'live' : 'priced'}
                    data-layout={index === 0 ? 'wide' : 'column'}
                  >
                    <h2 className="plans-tier-name">{tier.name}</h2>

                    {/* The mark names the unit; the figure is what a visitor
                        compares across the row, so they are separate spans at
                        separate steps and the figure carries tabular numerals. */}
                    <p className="plans-price">
                      <span className="plans-price-value">
                        <span className="plans-price-mark">Rp</span>
                        <span className="plans-price-figure">{groupRupiah(tier.price)}</span>
                      </span>
                      <span className="plans-period">{tier.unit}</span>
                      {tier.crossover && <span className="plans-crossover">{tier.crossover}</span>}
                    </p>

                    <p className="plans-summary">{tier.summary}</p>

                    <div className="plans-lists">
                      <ul className="plans-features">
                        {tier.ready.map((feature) => (
                          <li key={feature}>
                            <CheckIcon size={15} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Named as a list heading rather than hedged inside each
                          row: a visitor has to be able to tell in one look which
                          half of the cell they can use today. */}
                      {tier.soon.length > 0 && (
                        <div className="plans-soon">
                          <h3 className="plans-soon-title">Sedang disiapkan</h3>
                          <ul className="plans-soon-list">
                            {tier.soon.map((feature) => (
                              <li key={feature}>{feature}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {live ? (
                      <>
                        <Link className="plans-action plans-action-live" to="/signup">
                          {tier.cta}
                        </Link>
                        <p className="plans-note">Tanpa kartu kredit. Akun diverifikasi lewat email.</p>
                      </>
                    ) : (
                      // The fallback is the old blanket label, so a tier added
                      // without a reason can never render a nameless control.
                      <button type="button" className="plans-action" disabled>
                        {tier.blocked ?? 'Belum tersedia'}
                      </button>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>

          {/* The doorway's dark anchor, doing the same job one room further in:
              the promise the tiers do not change. Every line here is already true
              in the engine. */}
          <aside className="plans-anchor">
            <h2 className="plans-anchor-title">Paket tidak mengubah cara skor dihitung</h2>
            <p className="plans-anchor-copy">
              Model, bobot, dan rentang ketidakpastiannya sama untuk setiap akun. Yang berbayar menambah alat bantu
              perbandingan, bukan angka yang lebih pasti.
            </p>
            <ul className="plans-anchor-list">
              <li>Skor per jenis usaha, bukan per lokasi</li>
              <li>Setiap skor membawa rentang dan skor kepercayaannya</li>
              <li>Di bawah batas keyakinan, LOKABIS menolak memberi rekomendasi</li>
            </ul>
            <p className="plans-anchor-note">Cakupan analisis saat ini Kota Semarang.</p>
          </aside>
        </div>

        <footer className="sheet-foot">
          {/* The bar above carries Beranda and Masuk; the foot carries the move
              this page is actually for, which the narrow bar drops. */}
          <nav className="sheet-foot-nav" aria-label="Navigasi LOKABIS">
            <Link to="/">Beranda</Link>
            <Link to="/signup">Daftar gratis</Link>
          </nav>
          <p>
            Data lokasi © OpenStreetMap contributors, ODbL 1.0. Skor dihitung oleh model LOKABIS dan selalu disertai
            rentang ketidakpastiannya.
          </p>
        </footer>
      </main>
    </div>
  );
}
