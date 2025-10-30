// src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private resend: Resend;

    constructor() {
        const apiKey = process.env.RESEND_API_KEY;
        this.resend = new Resend(apiKey);
    }

    async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
        try {
            await this.resend.emails.send({
                from: 'Otsem Bank <no-reply@otsembank.com>', // ou seu domínio verificado
                to,
                subject: 'Redefinição de senha - Otsem Bank',
                html: `
          <p>Olá!</p>
          <p>Você solicitou a redefinição de senha.</p>
          <p>Clique no link abaixo para criar uma nova senha (válido por 30 minutos):</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Se você não fez essa solicitação, ignore este e-mail.</p>
          <p>— Equipe Otsem Bank</p>
        `,
            });

            this.logger.log(`E-mail de reset enviado para ${to}`);
        } catch (err) {
            this.logger.error(`Falha ao enviar e-mail de reset:`, err);
        }
    }
}
