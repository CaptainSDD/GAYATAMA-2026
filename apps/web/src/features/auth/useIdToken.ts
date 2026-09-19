import { useEffect, useState } from 'react';
import { currentIdToken } from '../../lib/auth';
import { useAuthState } from './useAuthState';

/**
 * The signed-in account's ID token, or null when nobody is signed in.
 *
 * Firebase refreshes the token itself and republishes the user through the
 * auth state subscription, so re-reading it whenever that state changes is
 * enough: a stale token is never handed to the API.
 */
export function useIdToken(): string | null {
  const state = useAuthState();
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== 'signed-in') {
      setIdToken(null);
      return;
    }
    let active = true;
    void currentIdToken(state.user).then(
      (token) => {
        if (active) setIdToken(token);
      },
      () => {
        if (active) setIdToken(null);
      },
    );
    return () => {
      active = false;
    };
  }, [state.status, state.status === 'signed-in' ? state.user.uid : null]);

  return idToken;
}
