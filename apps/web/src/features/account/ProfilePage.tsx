import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { COMPONENT_KEYS, type ComponentWeights } from '@gayatama/scoring';
import lokabisLogo from '../../assets/lokabis-logo.png';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { signOutUser } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import { AuthLoading } from '../auth/AuthLoading';
import { AuthUnavailable } from '../auth/AuthUnavailable';
import { useAuthState } from '../auth/useAuthState';
import { useEmailVerified } from '../auth/useEmailVerified';
import { useIdToken } from '../auth/useIdToken';
import { useVerificationResend } from '../auth/useVerificationResend';
import { COMPONENT_LABELS } from '../../lib/copy';
import { useProfile, useSaveWeights } from '../../lib/queries';
import { DEFAULT_WEIGHT_INPUTS } from '../score/WeightsEditor';

/**
 * The account page.
 *
 * Everything here comes from Firebase Auth on the client, because that is the
 * only profile data the app can actually read. Two things a profile page would
 * normally carry are deliberately absent rather than faked:
 *
 * - Saved reports are `allow get: if true; list: if false` by design, so a
 *   visitor's own analyses cannot be enumerated. A history list needs an index
 *   keyed by uid and an endpoint to read it.
 *
 * That one is not invented here.
 *
 * The saved weight set is the exception: `firestore.rules` denies every client
 * read of `users/`, so `GET /auth/profile` exists to serve it through the
 * Admin SDK. `SavedWeights` below reads it from there. The username travels on
 * the same response and is not shown yet.
 */
export function ProfilePage() {
  const state = useAuthState();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  // Was reading `user.emailVerified` straight from the sign-in snapshot, so
  // anyone who verified during this session was still told they had not.
  const emailVerified = useEmailVerified(state.status === 'signed-in' ? state.user : null);
  const verification = useVerificationResend(state.status === 'signed-in' ? state.user : null);

  if (state.status === 'loading') return <AuthLoading />;
  if (state.status === 'unavailable') return <AuthUnavailable />;
  if (state.status === 'signed-out') return <Navigate to="/login" replace />;

  const { user } = state;
  const created = user.metadata.creationTime;
  const lastSignIn = user.metadata.lastSignInTime;

  return (
    <div className="account-page">
      <header className="account-bar">
        <Link to="/app" className="account-back">
          <img className="account-logo" src={lokabisLogo} alt="LOKABIS" width={132} height={44} />
        </Link>
        <Link className="button-secondary" to="/app">
          Kembali ke peta
        </Link>
      </header>

      <main className="account-main">
        <h1 className="account-title">Akun</h1>

        <section className="account-card" aria-labelledby="account-identity">
          <h2 id="account-identity" className="account-section-title">
            Identitas
          </h2>

          <dl className="account-facts">
            <div className="account-fact">
              <dt>Email</dt>
              <dd>{user.email ?? 'Tidak tercatat'}</dd>
            </div>

            <div className="account-fact">
              <dt>Status email</dt>
              <dd>
                {emailVerified ? (
                  <span className="account-state account-state-ok">Terverifikasi</span>
                ) : (
                  <span className="account-state account-state-pending">Belum diverifikasi</span>
                )}
              </dd>
            </div>

            {created !== undefined && (
              <div className="account-fact">
                <dt>Bergabung</dt>
                <dd>{formatDateTime(new Date(created).toISOString())}</dd>
              </div>
            )}

            {lastSignIn !== undefined && (
              <div className="account-fact">
                <dt>Masuk terakhir</dt>
                <dd>{formatDateTime(new Date(lastSignIn).toISOString())}</dd>
              </div>
            )}
          </dl>

          {!emailVerified && (
            <div className="account-verify">
              <p>
                Verifikasi email mengamankan akun ini dan memastikan Anda bisa memulihkannya kalau lupa kata sandi.
              </p>
              {/* Never disabled on success: an email can be filtered or lost, and
                  the whole point of this button is asking for another one. */}
              <button
                type="button"
                className="button-secondary"
                disabled={verification.state.status === 'sending'}
                onClick={verification.resend}
              >
                {verification.state.status === 'sending'
                  ? 'Mengirim…'
                  : verification.state.status === 'sent'
                    ? 'Kirim lagi'
                    : 'Kirim ulang verifikasi'}
              </button>
              {verification.state.status === 'sent' && (
                <p className="account-verify-note" role="status">
                  Tautan verifikasi terkirim ke {user.email ?? 'alamat akun ini'}. Cek inbox dan folder spam.
                </p>
              )}
              {verification.state.status === 'failed' && (
                <p className="account-verify-error" role="alert">
                  {verification.state.message}
                </p>
              )}
            </div>
          )}
        </section>

        <SavedWeights />

        <section className="account-card" aria-labelledby="account-plan">
          <h2 id="account-plan" className="account-section-title">
            Paket
          </h2>
          <p className="account-plan-body">
            Menilai satu lokasi untuk satu jenis usaha gratis dan tidak dibatasi. Alat perbandingan, simulasi, dan
            ekspor sedang disiapkan sebagai paket berbayar.
          </p>
          <Link className="button-secondary" to="/membership">
            Lihat paket
          </Link>
        </section>

        <section className="account-card account-danger" aria-labelledby="account-session">
          <h2 id="account-session" className="account-section-title">
            Sesi
          </h2>
          <p className="account-plan-body">Anda perlu masuk lagi untuk membuka analisis berikutnya.</p>
          <button type="button" className="button-secondary" onClick={() => setConfirmingSignOut(true)}>
            Keluar
          </button>
        </section>
      </main>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Keluar dari LOKABIS?"
        body="Anda perlu login lagi untuk membuka analisis berikutnya."
        confirmLabel="Keluar"
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => {
          setConfirmingSignOut(false);
          void signOutUser();
        }}
      />
    </div>
  );
}

/**
 * What weight set this account scores with — read-only on purpose.
 *
 * The sliders live on the analysis page, where moving one moves the score in
 * front of you. Here there is no score to move, so a slider would be a control
 * with no visible consequence. What this page answers instead is the question
 * that only exists away from an analysis: "which weights am I on?"
 */
function SavedWeights() {
  const idToken = useIdToken();
  const profile = useProfile(idToken);
  const reset = useSaveWeights(idToken);
  const saved = profile.data?.profile?.weights ?? null;

  return (
    <section className="account-card" aria-labelledby="account-weights">
      <h2 id="account-weights" className="account-section-title">
        Bobot penilaian
      </h2>

      {profile.isPending && idToken !== null ? (
        <p className="account-plan-body">Memuat…</p>
      ) : saved === null ? (
        <>
          <p className="account-plan-body">
            Anda memakai bobot bawaan LOKABIS. Bobot ini dipilih dari penalaran lapangan dan didokumentasikan supaya
            bisa dibantah — bukan hasil pengepasan data.
          </p>
          <WeightsTable weights={DEFAULT_WEIGHT_INPUTS} />
        </>
      ) : (
        <>
          <p className="account-plan-body">
            Anda memakai bobot ubahan. Skornya tidak setara dengan skor bawaan, jadi jangan dibandingkan dengan hasil
            orang lain yang memakai bobot berbeda.
          </p>
          <WeightsTable weights={saved} />
          <button
            type="button"
            className="button-secondary"
            onClick={() => reset.mutate(null)}
            disabled={reset.isPending}
          >
            {reset.isPending ? 'Mengembalikan…' : 'Kembalikan ke bawaan'}
          </button>
          {reset.isError && <p className="notice weights-warning">Gagal mengembalikan bobot. Coba lagi.</p>}
        </>
      )}

      <p className="muted account-weights-hint">
        Ubah bobotnya saat menilai lokasi, di kartu <strong>Bobot penilaian</strong> — di sana skornya ikut bergerak
        begitu Anda menggesernya.
      </p>
    </section>
  );
}

function WeightsTable({ weights }: { weights: ComponentWeights }) {
  const total = COMPONENT_KEYS.reduce((sum, key) => sum + weights[key], 0);
  return (
    <dl className="account-facts account-weights">
      {COMPONENT_KEYS.map((key) => (
        <div key={key} className="account-fact">
          <dt>{COMPONENT_LABELS[key]}</dt>
          <dd>{Math.round((weights[key] / total) * 100)}%</dd>
        </div>
      ))}
    </dl>
  );
}
