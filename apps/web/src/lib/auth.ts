import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

// The only file that imports firebase/auth directly, so components never
// talk to the SDK themselves — they call these functions instead.

export type { User };

/** Thrown by every function below when `auth` is `null` — see lib/firebase.ts. */
function notConfigured(): Error {
  return Object.assign(new Error('Firebase Authentication is not configured.'), { code: 'auth/not-configured' });
}

export function signUp(email: string, password: string) {
  if (auth === null) return Promise.reject(notConfigured());
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signIn(email: string, password: string) {
  if (auth === null) return Promise.reject(notConfigured());
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  if (auth === null) return Promise.reject(notConfigured());
  return signOut(auth);
}

export function sendVerificationEmail(user: User) {
  return sendEmailVerification(user);
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User };

/**
 * Wraps onAuthStateChanged so callers never see `undefined` mid-resolution,
 * and never see a thrown error either — `unavailable` is a real, renderable
 * state, not an exception to catch.
 */
export function subscribeToAuthState(callback: (state: AuthState) => void): () => void {
  if (auth === null) {
    callback({ status: 'unavailable' });
    return () => undefined;
  }
  return onAuthStateChanged(auth, (user) => {
    callback(user === null ? { status: 'signed-out' } : { status: 'signed-in', user });
  });
}

/** Firebase Auth's own ID token, sent to the API so it can verify who is calling. */
export function currentIdToken(user: User): Promise<string> {
  return user.getIdToken();
}
