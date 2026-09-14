import { useEffect, useState } from 'react';
import { subscribeToAuthState, type AuthState } from '../../lib/auth';

/** The current Firebase Auth state, updated live as the user signs in or out. */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  useEffect(() => subscribeToAuthState(setState), []);
  return state;
}
