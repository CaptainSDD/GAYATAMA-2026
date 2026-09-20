import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { mailNotConfigured, mailSendFailed } from '../common/errors';
import type { Env } from '../config/env';
import { MAIL_TRANSPORT } from './mail.tokens';

export interface MailMessage {
  to: string;
  subject: string;
  /** Both parts are always sent: some clients refuse HTML, and spam filters distrust HTML with no text alternative. */
  text: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: Transporter | null,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Lets a caller choose a different route instead of provoking an error it already knows is coming. */
  get configured(): boolean {
    return this.transport !== null;
  }

  async send(message: MailMessage): Promise<void> {
    if (this.transport === null) throw mailNotConfigured();

    try {
      await this.transport.sendMail({
        from: this.config.get('MAIL_FROM', { infer: true }),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      // The reason belongs in the server log, not in the response: SMTP
      // rejections quote credentials and internal hostnames.
      this.logger.error(`SMTP send to ${message.to} failed: ${String(error)}`);
      throw mailSendFailed();
    }
  }
}
