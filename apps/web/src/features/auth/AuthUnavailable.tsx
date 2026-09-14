import { Card } from '../../components/Card';
import { MapPinIcon } from '../../components/Icons';

/**
 * Shown instead of a login form when Firebase Authentication itself isn't
 * configured — sending someone to /login in that state would just be a form
 * that can never succeed. See docs/installation.md's Firebase setup section.
 */
export function AuthUnavailable() {
  return (
    <div className="auth-page">
      <Card>
        <div className="auth-card">
          <p className="auth-brand">
            <MapPinIcon size={20} />
            LOKABIS
          </p>
          <h1 className="auth-title">Login belum bisa dipakai</h1>
          <p className="auth-subtitle">
            Konfigurasi Firebase Authentication belum lengkap di server ini. Hubungi pengelola aplikasi, atau lihat
            docs/installation.md untuk langkah pengaturannya.
          </p>
        </div>
      </Card>
    </div>
  );
}
