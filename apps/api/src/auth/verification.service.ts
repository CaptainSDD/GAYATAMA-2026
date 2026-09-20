import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import { ApiError } from '../common/errors';
import type { Env } from '../config/env';
import { FIREBASE_AUTH } from '../firebase/firebase.module';
import { MailService } from '../mail/mail.service';
import { verificationEmail } from './verification-email';

export interface VerificationStatus {
  email: string | null;
  emailVerified: boolean;
}

export interface VerificationSendResult {
  sent: boolean;
  /** Nothing was sent because there was nothing left to verify. Not a failure. */
  alreadyVerified: boolean;
}

/**
 * Account verification, owned by the API rather than left to the Firebase
 * client SDK.
 *
 * Firebase Auth remains the single source of truth for whether an address is
 * verified: it mints the link and it records the result when the link is
 * followed. What moves here is the sending and the reading — so the email is
 * ours (our wording, our From address, and a log when it fails), and so the
 * server can answer "is this address verified" from live state instead of
 * trusting a claim the caller brought with them.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    @Inject(FIREBASE_AUTH) private readonly auth: Auth | null,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Live state, deliberately not `email_verified` from the ID token. That claim
   * is baked in when the token is minted and stays stale for up to an hour
   * after the link is clicked, which is precisely the moment a visitor is most
   * likely to be asking.
   */
  async status(uid: string): Promise<VerificationStatus> {
    const user = await this.requireAuth().getUser(uid);
    return { email: user.email ?? null, emailVerified: user.emailVerified };
  }

  async send(uid: string): Promise<VerificationSendResult> {
    const auth = this.requireAuth();
    const user = await auth.getUser(uid);

    // Checked against live state before sending, so a second press after the
    // link is already followed does not post another link to a settled account.
    if (user.emailVerified) return { sent: false, alreadyVerified: true };

    const { email } = user;
    if (email === undefined) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'This account has no email address to verify.',
      );
    }

    // Firebase refuses to mint a link whose continue URL is not an authorised
    // domain, so a misconfigured APP_PUBLIC_URL surfaces here rather than as a
    // dead link in someone's inbox.
    const link = await auth.generateEmailVerificationLink(email, {
      url: `${this.config.get('APP_PUBLIC_URL', { infer: true })}/login`,
      handleCodeInApp: false,
    });

    await this.mail.send(verificationEmail(email, link));
    this.logger.log(`Verification email sent for ${uid}.`);
    return { sent: true, alreadyVerified: false };
  }

  /**
   * Whether this account may act. The token's claim is checked first because it
   * needs no round trip; only when it says "not verified" is Firebase asked,
   * since that is the one case where the claim may simply be out of date.
   */
  async isVerified(uid: string, claim: boolean): Promise<boolean> {
    if (claim) return true;
    const user = await this.requireAuth().getUser(uid);
    return user.emailVerified;
  }

  private requireAuth(): Auth {
    if (this.auth === null) {
      throw new ApiError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'REQUEST_FAILED',
        'Firebase Authentication is not configured on the server, so verification cannot be checked or sent.',
      );
    }
    return this.auth;
  }
}
