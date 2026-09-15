import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { App } from '../../App';
import { sendVerificationEmail, signOutUser } from '../../lib/auth';
import { AuthLoading } from './AuthLoading';
import { useAuthState } from './useAuthState';

/**
 * Guards the main app: signed-out visitors are sent to /login. When
 * Authentication itself isn't configured, the app is let through anyway
 * rather than blocked — the map and scoring have never depended on an
 * account, and an unconfigured optional integration degrading the whole
 * product would break the one pattern this codebase is consistent about
 * (Firestore, Google Places and Overture all fail the same way: absent, not
 * fatal). /login and /signup still say plainly that they can't work yet.
 */
export function AuthGate() {
  const state = useAuthState();
  const [resent, setResent] = useState(false);
  // Keyed by uid, not a bare boolean, so one account's verification never
  // carries over to the next account signed in during the same session.
  const [verifiedUid, setVerifiedUid] = useState<string | null>(null);

  const signedInUser = state.status === 'signed-in' ? state.user : null;

  // `emailVerified` is a snapshot taken when the user signed in, and
  // onAuthStateChanged does not fire when the verification link is clicked —
  // often in another tab entirely. Only reload() refreshes it, so ask again
  // whenever the window regains focus, which is exactly when the user comes
  // back from their inbox.
  useEffect(() => {
    if (signedInUser === null || signedInUser.emailVerified) return;
    const check = () => {
      void signedInUser
        .reload()
        .then(() => {
          if (signedInUser.emailVerified) setVerifiedUid(signedInUser.uid);
        })
        .catch(() => undefined);
    };
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [signedInUser]);

  if (state.status === 'loading') return <AuthLoading />;
  if (state.status === 'unavailable') return <App />;
  if (state.status === 'signed-out') return <Navigate to="/login" replace />;

  const { user } = state;

  return (
    <App
      userEmail={user.email}
      // Scopes the onboarding tour, so a new account is shown around even on a
      // browser where someone else already finished it.
      userId={user.uid}
      emailVerified={user.emailVerified || verifiedUid === user.uid}
      verificationResent={resent}
      onSignOut={() => void signOutUser()}
      onResendVerification={() => {
        void sendVerificationEmail(user).then(() => setResent(true));
      }}
    />
  );
}
