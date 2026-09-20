import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthSheetLoading, AuthSheetUnavailable } from './AuthSheetStates';
import { useAuthState } from './useAuthState';

/** Wraps /login and /signup: an already-signed-in visitor is sent to the app instead. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const state = useAuthState();
  // Both waiting states are drawn in the doorway's own world, so the route never
  // flashes the app's Glass Instrument Deck on its way to the Studio Sheet.
  if (state.status === 'loading') return <AuthSheetLoading />;
  // A login/signup form that can never succeed is worse than no form at all.
  if (state.status === 'unavailable') return <AuthSheetUnavailable />;
  if (state.status === 'signed-in') return <Navigate to="/app" replace />;
  return <>{children}</>;
}
