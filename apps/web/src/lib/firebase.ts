import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// These are public by design — see docs/installation.md and .env.example.
// They identify the project; they do not authorise access. Firestore access
// is controlled by firestore.rules, and Authentication has its own gate
// (the Email/Password sign-in method must be enabled in the console).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);

/**
 * `null` when the Web SDK config is missing or invalid — most often a fresh
 * checkout before docs/installation.md's Firebase setup has been done.
 * `getAuth` throws synchronously on a bad key, and that throw happens at
 * import time; letting it propagate would take down the entire app (map and
 * all) rather than just the parts that need a signed-in user. Every caller
 * handles `null` explicitly, the same way the API treats an unconfigured
 * Firestore as absent rather than fatal.
 */
export const auth: Auth | null = (() => {
  try {
    return getAuth(firebaseApp);
  } catch {
    return null;
  }
})();
