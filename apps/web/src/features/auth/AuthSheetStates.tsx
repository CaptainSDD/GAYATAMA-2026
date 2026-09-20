import { Link } from 'react-router-dom';
import { AuthSheet } from './AuthSheet';

/**
 * The two states both doors can be in before a form is worth drawing, in the
 * same world as the form itself. The deck-styled `AuthLoading` and
 * `AuthUnavailable` stay where they belong: the account and app routes, which
 * are still the Glass Instrument Deck.
 */

/** Shown while Firebase resolves whether anyone is already signed in. */
export function AuthSheetLoading() {
  return (
    <AuthSheet>
      <p className="sheet-pending" role="status">
        Menyiapkan formulir…
        <span className="sheet-pending-track" aria-hidden="true">
          <span className="sheet-pending-bar" />
        </span>
      </p>
    </AuthSheet>
  );
}

/**
 * Shown instead of a form when Firebase Authentication itself isn't configured —
 * sending someone to a form that can never succeed is worse than saying so.
 * See docs/installation.md's Firebase setup section.
 */
export function AuthSheetUnavailable() {
  return (
    <AuthSheet>
      <h1 className="sheet-title">Akun belum bisa dipakai</h1>
      <p className="sheet-deck">
        Konfigurasi Firebase Authentication belum lengkap di server ini, jadi masuk dan pendaftaran belum bisa
        diproses. Hubungi pengelola aplikasi, atau lihat <code>docs/installation.md</code> untuk langkah
        pengaturannya.
      </p>
      <p className="sheet-switch">
        Sementara itu, <Link to="/">lihat cara LOKABIS menilai satu lokasi</Link>.
      </p>
    </AuthSheet>
  );
}
