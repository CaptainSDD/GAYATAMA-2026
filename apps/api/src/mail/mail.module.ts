import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT } from './mail.tokens';

export { MAIL_TRANSPORT };

/**
 * The SMTP transport, or `null` when SMTP is not configured — the same rule
 * Firebase, Firestore, Google Places and Overture all follow here: an absent
 * optional integration degrades the feature that needs it rather than taking
 * the API down. A missing mailer means the API reports that it cannot send, and
 * the browser falls back to Firebase's own sender.
 *
 * Both the host and the From address are required. SMTP will happily connect
 * without a From header and then have every message rejected by the relay, so
 * the incomplete case is treated as unconfigured rather than left to fail later.
 */
export function createMailTransport(config: ConfigService<Env, true>): Transporter | null {
  const logger = new Logger('Mail');
  const host = config.get('SMTP_HOST', { infer: true });
  const from = config.get('MAIL_FROM', { infer: true });

  if (host === undefined || from === undefined) {
    logger.warn(
      'SMTP is not configured (needs SMTP_HOST and MAIL_FROM): the API cannot send verification email, so the web app falls back to Firebase.',
    );
    return null;
  }

  const user = config.get('SMTP_USER', { infer: true });
  const password = config.get('SMTP_PASSWORD', { infer: true });

  return createTransport({
    host,
    port: config.get('SMTP_PORT', { infer: true }),
    secure: config.get('SMTP_SECURE', { infer: true }),
    // Omitted entirely rather than passed as undefined: local relays and
    // Mailhog-style test servers reject a connection that offers empty
    // credentials, but accept one that never offers any.
    ...(user === undefined || password === undefined ? {} : { auth: { user, pass: password } }),
  });
}

@Module({
  providers: [{ provide: MAIL_TRANSPORT, inject: [ConfigService], useFactory: createMailTransport }, MailService],
  exports: [MailService],
})
export class MailModule {}
