import { useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { Link, Navigate } from 'react-router-dom';
import { ApiError, registerProfile } from '../../lib/api';
import { currentIdToken, signUp } from '../../lib/auth';
import { resendVerificationEmail } from '../../lib/verification';
import { errorMessage, firebaseAuthErrorMessage } from '../../lib/copy';
import { AuthField } from './AuthField';
import { AuthSheet, type SheetCounterpart } from './AuthSheet';
import { AuthSheetLoading, AuthSheetUnavailable } from './AuthSheetStates';
import { fieldErrors, signupSchema, type FieldErrors } from './schemas';
import { useAuthState } from './useAuthState';

const COUNTERPART: SheetCounterpart = { to: '/login', label: 'Masuk' };

/**
 * Every line here is already true of the shipped free tier: the score and its
 * interval, the confidence score with its reasons, and the facilities inside the
 * three zones. The paid split is named only as what it is — being prepared —
 * because PRODUCT.md records no tier, limit or price as decided.
 */
function SignupAside() {
  return (
    <>
      <h2 className="sheet-aside-title">Skor inti gratis</h2>
      <p className="sheet-aside-copy">
        Menilai satu lokasi untuk satu jenis usaha tetap gratis, lengkap dengan buktinya. Saat ini tersedia untuk Kota
        Semarang.
      </p>
      <ul className="sheet-aside-list">
        <li>Skor potensi 0–100 dengan rentang ketidakpastiannya</li>
        <li>Skor kepercayaan dan alasan tiap komponennya</li>
        <li>Fasilitas, pesaing, dan zona 300 / 800 / 1.500 m di peta</li>
      </ul>
      <p className="sheet-aside-note">
        Alat perbandingan, simulasi, dan ekspor sedang disiapkan sebagai paket berbayar —{' '}
        <Link to="/membership">lihat paket</Link>.
      </p>
    </>
  );
}

/**
 * Guards itself rather than sitting behind PublicOnly, because signing up has a
 * rule login does not: creating the account signs the user in immediately, so a
 * blanket "signed in? go to the app" redirect would tear this page down halfway
 * through its own submission — before the username is registered, and before any
 * failure could be shown. Arriving here already signed in still redirects.
 */
export function SignupPage() {
  const authState = useAuthState();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<typeof signupSchema>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  // Set the moment this page starts creating an account, so the sign-in that
  // Firebase performs as a side effect of that creation does not redirect the
  // page away mid-submission.
  const [signingUp, setSigningUp] = useState(false);
  // Set once Firebase Auth actually creates the account. If registerProfile
  // then fails (say, the username was taken), retrying must not call signUp
  // again — that account already exists, and Firebase would reject the email
  // as already in use.
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = signupSchema.safeParse({ email, username, password });
    if (!result.success) {
      setErrors(fieldErrors(result));
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    setSigningUp(true);
    try {
      let user = createdUser;
      if (user === null || user.email !== result.data.email) {
        const credential = await signUp(result.data.email, result.data.password);
        user = credential.user;
        setCreatedUser(user);
        // Best-effort: a slow or failed verification email should not block
        // the account from existing, since the user can ask to resend it.
        // Goes through the API when it has a mailer, and through Firebase when
        // it does not — see lib/verification.ts.
        await resendVerificationEmail(user).catch(() => undefined);
      }
      const idToken = await currentIdToken(user);
      await registerProfile(idToken, result.data.username);
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'USERNAME_TAKEN') {
        setErrors({ username: 'Username ini sudah dipakai. Coba yang lain.' });
      } else if (error instanceof ApiError) {
        setFormError(errorMessage(error));
      } else {
        setFormError(firebaseAuthErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authState.status === 'loading') return <AuthSheetLoading />;
  // A signup form that can never succeed is worse than no form at all.
  if (authState.status === 'unavailable') return <AuthSheetUnavailable />;
  if (authState.status === 'signed-in' && !signingUp) return <Navigate to="/app" replace />;

  if (sent) {
    return (
      <AuthSheet>
        <h1 className="sheet-title">Cek email Anda</h1>
        <p className="sheet-deck">
          Akun Anda sudah aktif. Kami mengirim tautan verifikasi ke <strong>{email}</strong> — klik tautan itu untuk
          mengamankan akun Anda.
        </p>
        <p className="sheet-sent-actions">
          <Link className="sheet-submit sheet-submit-link" to="/app">
            Mulai pakai LOKABIS
          </Link>
        </p>
        <p className="sheet-switch">
          Belum ada emailnya? Periksa folder spam — Anda juga bisa mengirim ulang tautannya dari dalam aplikasi.
        </p>
      </AuthSheet>
    );
  }

  return (
    <AuthSheet counterpart={COUNTERPART} aside={<SignupAside />}>
      <h1 className="sheet-title">Buat akun</h1>
      <p className="sheet-deck">Skor lokasi usaha Anda, dengan bukti dan tingkat keyakinannya.</p>

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
        />
        <AuthField
          label="Username"
          type="text"
          value={username}
          onChange={setUsername}
          error={errors.username}
          hint="3–20 karakter, diawali huruf. Boleh huruf, angka, atau garis bawah."
          autoComplete="username"
        />
        <AuthField
          label="Kata sandi"
          type="password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint="Minimal 8 karakter, memuat huruf dan angka."
          autoComplete="new-password"
        />
        <button type="submit" className="sheet-submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Memproses…' : 'Buat akun'}
        </button>
      </form>

      <p className="sheet-switch">
        Sudah punya akun? <Link to="/login">Masuk</Link>
      </p>
    </AuthSheet>
  );
}
