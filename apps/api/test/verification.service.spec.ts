import type { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import type { Transporter } from 'nodemailer';
import { RequireVerifiedEmailGuard } from '../src/auth/require-verified-email.guard';
import { verificationEmail } from '../src/auth/verification-email';
import { VerificationService } from '../src/auth/verification.service';
import type { AuthenticatedRequest } from '../src/auth/verify-token.guard';
import { ApiError } from '../src/common/errors';
import type { Env } from '../src/config/env';
import { createMailTransport } from '../src/mail/mail.module';
import { MailService } from '../src/mail/mail.service';

interface FakeUser {
  email?: string;
  emailVerified: boolean;
}

/** Just enough of firebase-admin Auth for VerificationService to run against. */
class FakeAuth {
  getUserCalls = 0;
  linksMinted: { email: string; url: string | undefined }[] = [];

  constructor(private readonly users: Record<string, FakeUser>) {}

  getUser(uid: string) {
    this.getUserCalls += 1;
    const user = this.users[uid];
    if (user === undefined) return Promise.reject(new Error(`no such user: ${uid}`));
    return Promise.resolve(user);
  }

  generateEmailVerificationLink(email: string, settings?: { url?: string }) {
    this.linksMinted.push({ email, url: settings?.url });
    return Promise.resolve(`https://example.test/verify?email=${encodeURIComponent(email)}&oob=abc123`);
  }
}

class FakeTransport {
  sent: { to?: string; subject?: string; from?: string; html?: string }[] = [];
  failWith: Error | null = null;

  sendMail(message: { to?: string; subject?: string; from?: string; html?: string }) {
    if (this.failWith !== null) return Promise.reject(this.failWith);
    this.sent.push(message);
    return Promise.resolve({ messageId: 'fake' });
  }
}

function fakeConfig(values: Partial<Record<keyof Env, unknown>>) {
  return { get: (key: keyof Env) => values[key] } as unknown as ConfigService<Env, true>;
}

const CONFIG = fakeConfig({ MAIL_FROM: 'LOKABIS <no-reply@lokabis.test>', APP_PUBLIC_URL: 'https://app.lokabis.test' });

function setup(users: Record<string, FakeUser>, options: { mailer?: boolean } = {}) {
  const auth = new FakeAuth(users);
  const transport = new FakeTransport();
  const mail = new MailService(
    options.mailer === false ? null : (transport as unknown as Transporter),
    CONFIG,
  );
  const service = new VerificationService(auth as unknown as Auth, mail, CONFIG);
  return { service, auth, transport };
}

describe('VerificationService.status', () => {
  it('reports live state from Firebase rather than a token claim', async () => {
    const { service } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: true } });

    await expect(service.status('uid-1')).resolves.toEqual({ email: 'budi@example.com', emailVerified: true });
  });

  it('reports a missing address as null rather than undefined', async () => {
    const { service } = setup({ 'uid-1': { emailVerified: false } });

    await expect(service.status('uid-1')).resolves.toEqual({ email: null, emailVerified: false });
  });

  it('fails clearly when Firebase Auth is not configured', async () => {
    const service = new VerificationService(null, new MailService(null, CONFIG), CONFIG);

    await expect(service.status('uid-1')).rejects.toThrow(ApiError);
  });
});

describe('VerificationService.send', () => {
  it('mints a link and sends it to the account address', async () => {
    const { service, auth, transport } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: false } });

    await expect(service.send('uid-1')).resolves.toEqual({ sent: true, alreadyVerified: false });

    expect(auth.linksMinted).toEqual([{ email: 'budi@example.com', url: 'https://app.lokabis.test/login' }]);
    expect(transport.sent).toHaveLength(1);
    const [message] = transport.sent;
    expect(message).toMatchObject({ to: 'budi@example.com', from: 'LOKABIS <no-reply@lokabis.test>' });
    expect(message?.html).toContain('oob=abc123');
  });

  it('sends nothing when the address is already verified, and says so', async () => {
    const { service, auth, transport } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: true } });

    await expect(service.send('uid-1')).resolves.toEqual({ sent: false, alreadyVerified: true });

    expect(auth.linksMinted).toEqual([]);
    expect(transport.sent).toEqual([]);
  });

  it('refuses an account that has no address to verify', async () => {
    const { service } = setup({ 'uid-1': { emailVerified: false } });

    await expect(service.send('uid-1')).rejects.toThrow(ApiError);
  });

  it('reports MAIL_NOT_CONFIGURED so the caller can fall back to Firebase', async () => {
    const { service } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: false } }, { mailer: false });

    try {
      await service.send('uid-1');
      throw new Error('expected send to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('MAIL_NOT_CONFIGURED');
      expect((error as ApiError).getStatus()).toBe(503);
    }
  });

  it('keeps the SMTP reason out of the response when the relay refuses', async () => {
    const { service, transport } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: false } });
    transport.failWith = new Error('535 auth failed for user no-reply@lokabis.test');

    try {
      await service.send('uid-1');
      throw new Error('expected send to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).getStatus()).toBe(502);
      expect((error as ApiError).message).not.toContain('535');
    }
  });
});

describe('VerificationService.isVerified', () => {
  it('trusts a positive claim without asking Firebase', async () => {
    const { service, auth } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: false } });

    await expect(service.isVerified('uid-1', true)).resolves.toBe(true);
    expect(auth.getUserCalls).toBe(0);
  });

  /** The whole point of the fallback: the claim is a snapshot, Firebase is the truth. */
  it('asks Firebase when the claim says no, catching a token minted before verification', async () => {
    const { service, auth } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: true } });

    await expect(service.isVerified('uid-1', false)).resolves.toBe(true);
    expect(auth.getUserCalls).toBe(1);
  });

  it('stays false when Firebase agrees the address is unverified', async () => {
    const { service } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: false } });

    await expect(service.isVerified('uid-1', false)).resolves.toBe(false);
  });
});

describe('RequireVerifiedEmailGuard', () => {
  const contextFor = (request: Partial<AuthenticatedRequest>) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as never;

  it('lets a verified account through', async () => {
    const { service } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: true } });
    const guard = new RequireVerifiedEmailGuard(service);

    await expect(guard.canActivate(contextFor({ uid: 'uid-1', emailVerified: true }))).resolves.toBe(true);
  });

  it('lets through an account that verified after its token was minted', async () => {
    const { service } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: true } });
    const guard = new RequireVerifiedEmailGuard(service);

    await expect(guard.canActivate(contextFor({ uid: 'uid-1', emailVerified: false }))).resolves.toBe(true);
  });

  it('rejects an unverified account with 403 EMAIL_NOT_VERIFIED', async () => {
    const { service } = setup({ 'uid-1': { email: 'budi@example.com', emailVerified: false } });
    const guard = new RequireVerifiedEmailGuard(service);

    try {
      await guard.canActivate(contextFor({ uid: 'uid-1', emailVerified: false }));
      throw new Error('expected the guard to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('EMAIL_NOT_VERIFIED');
      // 403, not 401: signing in again is not the remedy.
      expect((error as ApiError).getStatus()).toBe(403);
    }
  });
});

describe('createMailTransport', () => {
  it('returns null when SMTP_HOST is absent, so the feature degrades instead of the API', () => {
    expect(createMailTransport(fakeConfig({ MAIL_FROM: 'a@b.test' }))).toBeNull();
  });

  it('returns null when MAIL_FROM is absent, since the relay would reject every message', () => {
    expect(createMailTransport(fakeConfig({ SMTP_HOST: 'smtp.test', SMTP_PORT: 587 }))).toBeNull();
  });

  it('builds a transport once both the host and the From address are set', () => {
    const transport = createMailTransport(
      fakeConfig({ SMTP_HOST: 'smtp.test', SMTP_PORT: 587, SMTP_SECURE: false, MAIL_FROM: 'a@b.test' }),
    );

    expect(transport).not.toBeNull();
  });
});

describe('verificationEmail', () => {
  it('carries the link in both the text and the HTML part', () => {
    const message = verificationEmail('budi@example.com', 'https://example.test/verify?oob=abc');

    expect(message.to).toBe('budi@example.com');
    expect(message.text).toContain('https://example.test/verify?oob=abc');
    expect(message.html).toContain('https://example.test/verify?oob=abc');
  });

  it('escapes the link so it cannot break out of the href', () => {
    const message = verificationEmail('budi@example.com', 'https://example.test/verify?a=1&b="><script>');

    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&amp;b=&quot;&gt;');
  });
});
