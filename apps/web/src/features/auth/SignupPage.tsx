import { useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { Link, Navigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { MailIcon, MapPinIcon } from '../../components/Icons';
import { ApiError, registerProfile } from '../../lib/api';
import { currentIdToken, sendVerificationEmail, signUp } from '../../lib/auth';
import { errorMessage, firebaseAuthErrorMessage } from '../../lib/copy';
import { AuthField } from './AuthField';
import { AuthLoading } from './AuthLoading';
import { AuthUnavailable } from './AuthUnavailable';
import { fieldErrors, signupSchema, type FieldErrors } from './schemas';
import { useAuthState } from './useAuthState';

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
        await sendVerificationEmail(user).catch(() => undefined);
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

  if (authState.status === 'loading') return <AuthLoading />;
  // A signup form that can never succeed is worse than no form at all.
  if (authState.status === 'unavailable') return <AuthUnavailable />;
  if (authState.status === 'signed-in' && !signingUp) return <Navigate to="/app" replace />;

  if (sent) {
    return (
      <div className="auth-page">
        <Card>
          <div className="auth-card">
            <p className="auth-brand">
              <MapPinIcon size={20} />
              LOKABIS
            </p>
            <h1 className="auth-title">
              <MailIcon size={18} /> Cek email Anda
            </h1>
            <p className="auth-subtitle">
              Akun Anda sudah aktif. Kami mengirim tautan verifikasi ke <strong>{email}</strong> — klik tautan itu untuk
              mengamankan akun Anda.
            </p>
            <Link className="button-secondary auth-submit auth-submit-link" to="/app">
              Mulai pakai LOKABIS
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Card>
        {/* noValidate: the browser's own popup would otherwise block submit before
            these fields' Indonesian messages ever get a chance to render. */}
        <form className="auth-card" noValidate onSubmit={(event) => void onSubmit(event)}>
          <p className="auth-brand">
            <MapPinIcon size={20} />
            LOKABIS
          </p>
          <h1 className="auth-title">Buat akun baru</h1>
          <p className="auth-subtitle">Skor lokasi usaha Anda, dengan bukti dan tingkat keyakinannya.</p>

          {formError !== null && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}

          <div className="auth-form">
            <AuthField label="Email" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
            <AuthField
              label="Username"
              type="text"
              value={username}
              onChange={setUsername}
              error={errors.username}
              autoComplete="username"
            />
            <AuthField
              label="Kata sandi"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              autoComplete="new-password"
            />
            <button type="submit" className="button-secondary auth-submit" disabled={submitting}>
              {submitting ? 'Memproses…' : 'Daftar'}
            </button>
          </div>

          <p className="auth-switch">
            Sudah punya akun? <Link to="/login">Login</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
