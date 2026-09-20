import { useEffect, useState } from 'react';
import { refreshIdToken, type User } from '../../lib/auth';

/**
 * Whether this account's email address is verified, kept current.
 *
 * `user.emailVerified` is a snapshot taken when the user signed in, and
 * `onAuthStateChanged` does not fire when the verification link is followed —
 * usually in another tab, or another browser entirely. Only `reload()` refreshes
 * it, so ask again whenever the window regains focus, which is exactly when
 * someone comes back from their inbox.
 *
 * Shared by the in-app banner and the account page, which both used to answer
 * this question and only one of which used to answer it correctly.
 */
export function useEmailVerified(user: User | null): boolean {
  // Keyed by uid rather than a bare boolean, so one account's verification never
  // carries over to the next account signed in during the same session.
  const [verifiedUid, setVerifiedUid] = useState<string | null>(null);

  useEffect(() => {
    if (user === null || user.emailVerified) return;

    const check = () => {
      void user
        .reload()
        .then(async () => {
          if (!user.emailVerified) return;
          // The API reads `email_verified` off the ID token, so without minting
          // a fresh one the next request still carries the old claim and the
          // server goes on believing the address is unverified.
          await refreshIdToken(user).catch(() => undefined);
          setVerifiedUid(user.uid);
        })
        .catch(() => undefined);
    };

    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [user]);

  return user !== null && (user.emailVerified || verifiedUid === user.uid);
}
