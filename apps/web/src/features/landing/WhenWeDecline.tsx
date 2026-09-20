import { CONFIDENCE_FLOOR } from '@gayatama/scoring';
import { ApiError } from '../../lib/api';
import { errorMessage, errorTitle } from '../../lib/copy';

const REFUSAL = new ApiError(422, 'INSUFFICIENT_DATA', 'INSUFFICIENT_DATA');

/** The real held-back state and a real recovery explanation beside it. */
export function WhenWeDecline() {
  return (
    <section className="landing-decline" id="batas" aria-labelledby="landing-decline-title">
      <div className="landing-decline-inner">
        <div className="landing-decline-lede" data-reveal="rise">
          <h2 id="landing-decline-title">
            Kadang jawabannya:
            <br />
            kami tidak tahu.
          </h2>
          <p>
            Peta terbuka tidak merata. Di sebagian tempat datanya cukup untuk menilai; di tempat lain tidak. Kalau
            keyakinannya jatuh di bawah <strong>{CONFIDENCE_FLOOR} dari 100</strong>, LOKABIS tidak memberi rekomendasi
            sama sekali.
          </p>
          <p className="landing-decline-aside">
            Angka yang terlihat pasti padahal tidak, lebih berbahaya daripada tidak ada angka — apalagi kalau kontrak
            sewanya sudah di depan mata.
          </p>
          <details className="landing-decline-help">
            <summary>Apa yang bisa dilakukan?</summary>
            <p>
              Coba titik lain di sekitar lokasi, lalu bandingkan bukti fasilitasnya. Anda juga dapat{' '}
              <a
                href="https://github.com/CaptainSDD/GAYATAMA-2026/blob/main/docs/data-sources.md"
                target="_blank"
                rel="noreferrer"
              >
                memeriksa sumber dan batas datanya
              </a>{' '}
              sebelum mengambil keputusan. Dokumen teknis terbuka di tab baru dan berbahasa Inggris.
            </p>
          </details>
        </div>

        <figure className="landing-decline-figure" data-reveal="slab" style={{ ['--delay' as string]: '120ms' }}>
          <div className="landing-held" role="presentation">
            <p className="landing-held-title">{errorTitle(REFUSAL)}</p>
            <p className="landing-held-body">{errorMessage(REFUSAL)}</p>
            <span className="landing-held-action" aria-hidden="true">
              Pilih titik lain di peta
            </span>
          </div>
          <figcaption className="landing-decline-caption">
            Tampilan sebenarnya di dalam aplikasi saat LOKABIS menahan penilaian.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
