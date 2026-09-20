import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';

// Replaced wholesale so neither the real API client nor the Firebase SDK is
// loaded: this is about which sender gets chosen, not about either one working.
const requestVerificationEmail = vi.fn();
const sendVerificationEmail = vi.fn();
const currentIdToken = vi.fn();

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  requestVerificationEmail: (...args: unknown[]) => requestVerificationEmail(...args),
}));

vi.mock('./auth', () => ({
  currentIdToken: (...args: unknown[]) => currentIdToken(...args),
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
}));

const { resendVerificationEmail } = await import('./verification');

const USER = { uid: 'uid-1' } as never;

describe('resendVerificationEmail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentIdToken.mockResolvedValue('id-token');
    requestVerificationEmail.mockResolvedValue({ sent: true, alreadyVerified: false });
    sendVerificationEmail.mockResolvedValue(undefined);
  });

  it('prefers the API, so the message is the one we wrote', async () => {
    await expect(resendVerificationEmail(USER)).resolves.toBe('api');

    expect(requestVerificationEmail).toHaveBeenCalledWith('id-token');
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('falls back to Firebase when the server has no mail transport', async () => {
    requestVerificationEmail.mockRejectedValue(new ApiError(503, 'MAIL_NOT_CONFIGURED', ''));

    await expect(resendVerificationEmail(USER)).resolves.toBe('firebase');
    expect(sendVerificationEmail).toHaveBeenCalledWith(USER);
  });

  it('falls back when the API cannot be reached at all', async () => {
    requestVerificationEmail.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', ''));

    await expect(resendVerificationEmail(USER)).resolves.toBe('firebase');
    expect(sendVerificationEmail).toHaveBeenCalledWith(USER);
  });

  it('falls back when the relay refused the send', async () => {
    requestVerificationEmail.mockRejectedValue(new ApiError(502, 'REQUEST_FAILED', ''));

    await expect(resendVerificationEmail(USER)).resolves.toBe('firebase');
    expect(sendVerificationEmail).toHaveBeenCalledWith(USER);
  });

  /** Falling back here would defeat the throttle by mailing the address anyway. */
  it('surfaces a rate limit instead of sending through the other route', async () => {
    requestVerificationEmail.mockRejectedValue(new ApiError(429, 'RATE_LIMITED', ''));

    await expect(resendVerificationEmail(USER)).rejects.toThrow(ApiError);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  /**
   * The failure that started this: an unlisted code used to mean "send nothing",
   * so anything unanticipated ended in silence and an empty inbox.
   */
  it('still falls back on a failure nobody anticipated', async () => {
    requestVerificationEmail.mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', ''));

    await expect(resendVerificationEmail(USER)).resolves.toBe('firebase');
    expect(sendVerificationEmail).toHaveBeenCalledWith(USER);
  });

  it('falls back when the failure is not an ApiError at all', async () => {
    requestVerificationEmail.mockRejectedValue(new Error('boom'));

    await expect(resendVerificationEmail(USER)).resolves.toBe('firebase');
    expect(sendVerificationEmail).toHaveBeenCalledWith(USER);
  });

  it('reports a failure when both senders fail, rather than claiming success', async () => {
    requestVerificationEmail.mockRejectedValue(new ApiError(503, 'MAIL_NOT_CONFIGURED', ''));
    sendVerificationEmail.mockRejectedValue(
      Object.assign(new Error('blocked'), { code: 'auth/too-many-requests' }),
    );

    await expect(resendVerificationEmail(USER)).rejects.toThrow('blocked');
  });

  it('treats an already-verified account as a success without a second send', async () => {
    requestVerificationEmail.mockResolvedValue({ sent: false, alreadyVerified: true });

    await expect(resendVerificationEmail(USER)).resolves.toBe('api');
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
