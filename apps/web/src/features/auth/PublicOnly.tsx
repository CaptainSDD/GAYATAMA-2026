import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthLoading } from './AuthLoading';
import { AuthUnavailable } from './AuthUnavailable';
import { useAuthState } from './useAuthState';

/** Wraps /login and /signup: an already-signed-in visitor is sent to the app instead. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const state = useAuthState();
  if (state.status === 'loading') return <AuthLoading />;
  // A login/signup form that can never succeed is worse than no form at all.
  if (state.status === 'unavailable') return <AuthUnavailable />;
  if (state.status === 'signed-in') return <Navigate to="/" replace />;
  return <>{children}</>;
}
