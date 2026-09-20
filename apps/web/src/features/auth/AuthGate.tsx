import { Navigate } from 'react-router-dom';
import { App } from '../../App';
import { signOutUser } from '../../lib/auth';
import { AuthLoading } from './AuthLoading';
import { useAuthState } from './useAuthState';
import { useEmailVerified } from './useEmailVerified';
import { useVerificationResend } from './useVerificationResend';

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

  const signedInUser = state.status === 'signed-in' ? state.user : null;
  const emailVerified = useEmailVerified(signedInUser);
  const verification = useVerificationResend(signedInUser);

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
      emailVerified={emailVerified}
      verificationState={verification.state}
      onSignOut={() => void signOutUser()}
      onResendVerification={verification.resend}
    />
  );
}
