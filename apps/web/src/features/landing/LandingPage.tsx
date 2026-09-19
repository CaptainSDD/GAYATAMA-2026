import { Link } from 'react-router-dom';
import lokabisLogo from '../../assets/lokabis-logo.png';
import { CheckIcon } from '../../components/Icons';

/**
 * The public landing page.
 *
 * It is about the minute before a lease is signed, not about a feature list.
 * The argument LOKABIS can make that a neighbouring product cannot is that the
 * same decision looks different once the evidence is visible — so the first
 * viewport reads one shopfront twice, and the rest of the page closes the gap
 * between the two readings.
 *
 * The left column is deliberately not a straw man. Counting shopfronts on the
 * way past is a real method and it is often right; a page that sneers at how
 * its reader currently decides loses them before the argument starts.
 */

/** The worked example. Real numbers from the scoring engine's own worked case. */
const EXAMPLE = {
  place: 'Sumurboto, Banyumanik',
  business: 'Laundry',
  score: '62',
  margin: '9',
  band: 'Cukup cocok',
  evidence: [
    'Kampus dan kos padat dalam radius 300 m',
    'Jalan sekunder dengan trotoar menerus',
    'Enam laundry setara sudah berbagi permintaan',
  ],
};

const REASONS = [
  {
    title: 'Skornya per jenis usaha, bukan per lokasi',
    body: 'Satu titik dapat tujuh skor berbeda. Tempat yang bagus untuk laundry bisa buruk untuk kedai kopi — sebuah lokasi hanya pernah bagus untuk sesuatu.',
  },
  {
    title: 'Angkanya membawa ketidakpastiannya',
    body: 'Selalu 62 ± 9, tidak pernah 62. Kalau datanya tipis, rentangnya melebar dan halaman mengatakannya. Di bawah batas kepercayaan, LOKABIS menolak memberi rekomendasi.',
  },
  {
    title: 'Tidak mengarang data kependudukan',
    body: 'Tidak ada jumlah penduduk atau tingkat pendapatan yang tidak bisa kami sebut sumbernya. Fasilitas di sekitar dibaca sebagai indikator kekuatan segmen, bukan sebagai kepala yang dihitung.',
  },
];

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-bar">
        <img className="landing-logo" src={lokabisLogo} alt="LOKABIS" width={132} height={44} />
        <Link className="button-secondary" to="/login">
          Masuk
        </Link>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <h1 className="landing-title">Satu ruko, dibaca dua kali.</h1>

          <div className="landing-readings">
            <div className="landing-reading">
              <h2>Cara biasanya diputuskan</h2>
              <p>
                Lewat depannya beberapa kali. Hitung warung sejenis di sepanjang jalan itu. Tanya yang sudah lama
                berjualan di sana. Perhatikan ramainya jam berapa.
              </p>
              <p className="landing-aside">
                Cara ini sering benar. Yang tidak dibawanya: berapa banyak yang terlewat di gang sebelah, dan seberapa
                yakin Anda boleh merasa sebelum tanda tangan.
              </p>
            </div>

            <div className="landing-reading landing-reading-scored">
              <h2>Ruko yang sama, dengan buktinya</h2>

              <p className="landing-score">
                <span className="landing-score-value">{EXAMPLE.score}</span>
                <span className="landing-score-margin">± {EXAMPLE.margin}</span>
                <span className="landing-score-band">{EXAMPLE.band}</span>
              </p>
              <p className="landing-score-where">
                {EXAMPLE.business} · {EXAMPLE.place}
              </p>

              <ul className="landing-evidence">
                {EXAMPLE.evidence.map((item) => (
                  <li key={item}>
                    <CheckIcon size={16} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="landing-action">
            <Link className="button-primary landing-cta" to="/signup">
              Daftar akun
            </Link>
            <p className="landing-action-note">
              Menilai satu lokasi untuk satu jenis usaha gratis. Alat perbandingan dan ekspor sedang disiapkan sebagai
              paket berbayar.
            </p>
          </div>
        </section>

        <section className="landing-reasons" aria-labelledby="landing-reasons-title">
          <h2 id="landing-reasons-title">Kenapa angkanya bisa dipercaya</h2>
          <div className="landing-reason-list">
            {REASONS.map((reason) => (
              <article key={reason.title} className="landing-reason">
                <h3>{reason.title}</h3>
                <p>{reason.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-method" aria-labelledby="landing-method-title">
          <h2 id="landing-method-title">Rumusnya terbuka</h2>
          <p>
            Bobot 35 / 20 / 20 / 15 / 10 yang dipakai LOKABIS adalah penilaian yang didokumentasikan, bukan parameter
            hasil pengepasan data — ditulis supaya bisa dibantah, bukan supaya terdengar pasti. Setiap contoh
            perhitungan di dokumentasi diuji oleh mesin skornya sendiri, jadi dokumentasi tidak bisa menyimpang dari
            kode tanpa membuat build gagal.
          </p>
          <p className="landing-coverage">Saat ini mencakup Kota Semarang.</p>
        </section>
      </main>

      <footer className="landing-foot">
        Data © OpenStreetMap contributors, ODbL 1.0. Skor dihitung oleh model LOKABIS dan selalu disertai rentang
        ketidakpastiannya.
      </footer>
    </div>
  );
}
