import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { MapPinIcon } from '../../components/Icons';
import { signIn } from '../../lib/auth';
import { firebaseAuthErrorMessage } from '../../lib/copy';
import { AuthField } from './AuthField';
import { fieldErrors, loginSchema, type FieldErrors } from './schemas';

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
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(firebaseAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

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
          <h1 className="auth-title">Masuk</h1>
          <p className="auth-subtitle">Lanjutkan menilai lokasi usaha Anda.</p>

          {formError !== null && (
            <p className="error" role="alert">
              {formError}
            </p>
          )}

          <div className="auth-form">
            <AuthField label="Email" type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
            <AuthField
              label="Kata sandi"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              autoComplete="current-password"
            />
            <button type="submit" className="button-secondary auth-submit" disabled={submitting}>
              {submitting ? 'Memproses…' : 'Masuk'}
            </button>
          </div>

          <p className="auth-switch">
            Belum punya akun? <Link to="/signup">Daftar</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
