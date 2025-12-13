// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { passwordResetHtml } from './templates/password-reset.html';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not configured - email sending disabled');
    }
  }

  async sendPasswordReset(to: string, resetUrl: string) {
    if (!this.resend) {
      this.logger.warn(`Email sending disabled - would send password reset to ${to}`);
      this.logger.log(`Reset URL: ${resetUrl}`);
      return;
    }

    const productName = process.env.PRODUCT_NAME ?? 'Otsem Bank';
    const html = passwordResetHtml({ resetUrl, productName });

    await this.resend.emails.send({
      from: `Otsem Bank <no-reply@notify.otsembank.com>`,
      to,
      subject: 'Redefinição de senha',
      html,
      text: [
        `Redefinição de senha - ${productName}`,
        `Abra o link (válido por 30 minutos):`,
        resetUrl,
        `Se você não solicitou, ignore este e-mail.`,
      ].join('\n'),
    });

    this.logger.log(`E-mail de reset enviado para ${to}`);
  }
}
