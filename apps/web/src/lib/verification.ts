import { ApiError, requestVerificationEmail } from './api';
import { currentIdToken, sendVerificationEmail, type User } from './auth';

/** Which sender actually posted the message. Returned for logging and tests, not shown to anyone. */
export type VerificationSender = 'api' | 'firebase';

/**
 * The one code that must not fall back. A 429 is the throttle saying "slow
 * down", so posting the message through the other sender instead would defeat
 * the limit this endpoint has precisely because it can fill someone's inbox.
 *
 * Everything else falls back. The API path exists to make the email nicer, not
 * to be the only way it can be sent, so any other server-side failure — no SMTP
 * configured, a relay rejection, Firebase Admin missing, a 500, the API not
 * running at all — should still end with the visitor getting their link. An
 * earlier version listed the codes to fall back *on*, which meant every
 * unanticipated failure silently sent nothing.
 */
const NO_FALLBACK_CODES = new Set(['RATE_LIMITED']);

/**
 * Sends the account verification email, preferring the API so the message is
 * ours — our wording, our From address, and a server-side log when a relay
 * rejects it. Firebase's own sender remains the fallback, so verification keeps
 * working on a deployment with no SMTP configured, which is the same
 * absent-not-fatal rule the API applies to every optional integration.
 *
 * One path for all three callers (sign-up, the in-app banner, the account page)
 * so the fallback cannot drift between them.
 */
export async function resendVerificationEmail(user: User): Promise<VerificationSender> {
  try {
    const idToken = await currentIdToken(user);
    await requestVerificationEmail(idToken);
    return 'api';
  } catch (error) {
    if (error instanceof ApiError && NO_FALLBACK_CODES.has(error.code)) throw error;
    // Left in the console on purpose: the visitor is about to be told the email
    // is on its way by another route, so the reason the first one failed would
    // otherwise vanish without trace.
    console.warn('Verification email via the API failed, falling back to Firebase:', error);
  }

  await sendVerificationEmail(user);
  return 'firebase';
}
