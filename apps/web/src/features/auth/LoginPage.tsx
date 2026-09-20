import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '../../lib/auth';
import { firebaseAuthErrorMessage } from '../../lib/copy';
import { AuthField } from './AuthField';
import { AuthSheet, type SheetCounterpart } from './AuthSheet';
import { fieldErrors, loginSchema, type FieldErrors } from './schemas';

const COUNTERPART: SheetCounterpart = { to: '/signup', label: 'Daftar' };

/**
 * What the aside says is what the product promises everywhere else — the
 * interval, the confidence floor, the per-category rule. No claim here that
 * isn't already true in the engine, and nothing about an account the visitor
 * does not have yet.
 */
function LoginAside() {
  return (
    <>
      <h2 className="sheet-aside-title">Angkanya selalu membawa ketidakpastiannya</h2>
      <p className="sheet-aside-copy">
        Setiap skor datang dengan rentang dan tingkat keyakinannya. Di bawah batas keyakinan, LOKABIS menolak memberi
        rekomendasi daripada menyodorkan angka yang terlihat pasti.
      </p>
      <ul className="sheet-aside-list">
        <li>Skor per jenis usaha, bukan per lokasi</li>
        <li>Zona 300 m, 800 m, dan 1.500 m di sekitar titik</li>
        <li>Bukti terurai ke fasilitas, jarak, dan mutu data</li>
      </ul>
      <p className="sheet-aside-note">
        Menilai satu lokasi untuk satu jenis usaha gratis. Alat perbandingan dan ekspor sedang disiapkan sebagai paket
        berbayar — <Link to="/membership">lihat paket</Link>.
      </p>
    </>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<typeof loginSchema>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(fieldErrors(result));
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await signIn(result.data.email, result.data.password);
      navigate('/app', { replace: true });
    } catch (error) {
      setFormError(firebaseAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSheet counterpart={COUNTERPART} aside={<LoginAside />}>
      <h1 className="sheet-title">Masuk</h1>
      <p className="sheet-deck">Lanjutkan menilai lokasi usaha Anda.</p>

      {formError !== null && (
        <p className="sheet-error" role="alert">
          {formError}
        </p>
      )}

      {/* noValidate: the browser's own popup would otherwise block submit before
          these fields' Indonesian messages ever get a chance to render. */}
      <form className="sheet-form" noValidate onSubmit={(event) => void onSubmit(event)}>
        <AuthField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          autoComplete="email"
          autoFocus
        />
        <AuthField
          label="Kata sandi"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          autoComplete="current-password"
        />
        <button type="submit" className="sheet-submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Memproses…' : 'Masuk'}
        </button>
      </form>

      <p className="sheet-switch">
        Belum punya akun? <Link to="/signup">Daftar gratis</Link>
      </p>
    </AuthSheet>
  );
}
