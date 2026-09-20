import { useCallback, useState } from 'react';
import { ApiError } from '../../lib/api';
import type { User } from '../../lib/auth';
import { errorMessage, firebaseAuthErrorMessage } from '../../lib/copy';
import { resendVerificationEmail } from '../../lib/verification';

export type VerificationResendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'failed'; message: string };

function failureMessage(error: unknown): string {
  if (error instanceof ApiError) return errorMessage(error);
  // Firebase throttles verification email hard, and after a few test sends this
  // is the message people actually hit.
  return firebaseAuthErrorMessage(error);
}

/**
 * Sends the verification email and reports how it went.
 *
 * The reporting is the point. Both surfaces that offer this used to hold a lone
 * `resent` boolean and discard any error, so a send that failed looked exactly
 * like one that was never pressed: no message, no change, nothing in the inbox.
 * A pending state matters too — there is a network round trip behind this
 * button, and without one the first press looks ignored.
 */
export function useVerificationResend(user: User | null) {
  const [state, setState] = useState<VerificationResendState>({ status: 'idle' });

  const resend = useCallback(() => {
    if (user === null) return;
    setState((current) => (current.status === 'sending' ? current : { status: 'sending' }));
    void resendVerificationEmail(user).then(
      () => setState({ status: 'sent' }),
      (error: unknown) => setState({ status: 'failed', message: failureMessage(error) }),
    );
  }, [user]);

  return { state, resend };
}
