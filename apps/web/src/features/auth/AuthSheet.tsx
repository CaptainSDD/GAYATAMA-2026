import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import lokabisLogo from '../../assets/lokabis-logo.png';
import { ConstellationField } from '../../components/ConstellationField';

/**
 * The shell both doors share, in the landing page's Studio Sheet rather than the
 * app's Glass Instrument Deck.
 *
 * A visitor reaches /login or /signup from the front door's own call to action,
 * so the seam between the two is one click wide: the ground, the corner family,
 * Onest and the single indigo action carry straight through. What changes is the
 * mode — the landing page persuades, this page is a task, so the form leads and
 * the world stands behind it.
 *
 * `.landing` is kept as the root class deliberately. The Studio Sheet's tokens,
 * type reset, caret, selection colour and focus ring are all defined on that
 * selector; a second class would have to restate the whole world to inherit it.
 */

export interface SheetCounterpart {
  /** The other door. */
  to: string;
  /** Its label in the bar. Each page says the same destination in a full
   *  sentence under its own form. */
  label: string;
}

interface AuthSheetProps {
  counterpart?: SheetCounterpart;
  /** The dark anchor beside the form. Omitted by the loading and blocked states. */
  aside?: ReactNode;
  children: ReactNode;
}

export function AuthSheet({ counterpart, aside, children }: AuthSheetProps) {
  return (
    <div className="landing landing-sheet">
      <ConstellationField />
      <a className="landing-skip" href="#formulir">
        Lewati ke formulir
      </a>

      {/* The landing's bar is fixed because its links point down its own page.
          Here every link leaves the page and there is nothing to scroll past, so
          the same bar sits in the layout instead of over it. */}
      <header className="landing-nav sheet-nav">
        <Link className="landing-nav-brand" to="/" aria-label="LOKABIS, ke halaman utama">
          <img src={lokabisLogo} alt="" width={132} height={44} />
        </Link>

        <div className="landing-nav-pill">
          <nav className="landing-nav-links" aria-label="Halaman LOKABIS">
            <Link to="/">Beranda</Link>
            <Link to="/membership">Paket</Link>
          </nav>
          {counterpart !== undefined && (
            <Link className="landing-nav-login sheet-nav-counterpart" to={counterpart.to}>
              {counterpart.label}
            </Link>
          )}
        </div>
      </header>

      {/* The page's one ornament, and the same one the hero draws over the live
          map: the engine's real 300 / 800 / 1.500 m zone radii, hairline, at page
          scale, cropped by the viewport. Non-scaling strokes so all three stay a
          true 1px whatever the field is scaled to. */}
      <span className="sheet-rings" aria-hidden="true">
        <svg viewBox="0 0 120 120" focusable="false">
          <circle className="sheet-ring-outer" cx="60" cy="60" r="58" vectorEffect="non-scaling-stroke" />
          <circle className="sheet-ring-mid" cx="60" cy="60" r="31" vectorEffect="non-scaling-stroke" />
          <circle className="sheet-ring-inner" cx="60" cy="60" r="12" vectorEffect="non-scaling-stroke" />
          <circle className="sheet-ring-point" cx="60" cy="60" r="1.6" />
        </svg>
      </span>

      <main className="sheet-main">
        <div className="sheet-slab" data-columns={aside === undefined ? '1' : '2'}>
          <section className="sheet-form-col" id="formulir" tabIndex={-1}>
            {children}
          </section>
          {aside !== undefined && <aside className="sheet-aside">{aside}</aside>}
        </div>

        <footer className="sheet-foot">
          {/* Only the two destinations that leave this flow. The other door is
              already named twice above — in the bar and in a full sentence under
              the form — and a third copy of it is noise, not wayfinding. */}
          <nav className="sheet-foot-nav" aria-label="Navigasi LOKABIS">
            <Link to="/">Beranda</Link>
            <Link to="/membership">Paket dan harga</Link>
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
