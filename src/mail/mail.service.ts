import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { passwordResetHtml } from './templates/password-reset.html';

export type EmailTemplate = 'kyc_reminder' | 'account_blocked' | 'account_unblocked' | 'welcome' | 'custom';

interface SendEmailOptions {
  to: string;
  subject: string;
  message: string;
  template?: EmailTemplate;
  recipientName?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null = null;
  private readonly fromEmail = 'Otsem Bank <no-reply@notify.otsembank.com>';

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
      from: this.fromEmail,
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

  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { to, subject, message, template, recipientName } = options;

    if (!this.resend) {
      this.logger.warn(`Email sending disabled - would send "${subject}" to ${to}`);
      this.logger.log(`Message: ${message}`);
      return { success: true, messageId: 'disabled' };
    }

    try {
      const html = this.buildHtmlEmail(message, template, recipientName);
      
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        text: message,
      });

      this.logger.log(`Email "${subject}" enviado para ${to} (template: ${template || 'custom'})`);
      return { success: true, messageId: result.data?.id };
    } catch (error: any) {
      this.logger.error(`Erro ao enviar email para ${to}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private buildHtmlEmail(message: string, template?: EmailTemplate, recipientName?: string): string {
    const formattedMessage = message.replace(/\n/g, '<br>');
    const greeting = recipientName ? `Olá ${recipientName},` : 'Olá,';
    
    const templateStyles = this.getTemplateStyles(template);
    
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Otsem Bank</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background: ${templateStyles.headerBg}; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                ${templateStyles.icon} Otsem Bank
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; color: #333333; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <div style="margin: 0 0 24px; color: #555555; font-size: 15px; line-height: 1.7;">
                ${formattedMessage}
              </div>
              ${templateStyles.ctaButton}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; color: #6c757d; font-size: 13px; text-align: center;">
                Este é um e-mail automático do Otsem Bank. Por favor, não responda.
              </p>
              <p style="margin: 8px 0 0; color: #6c757d; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} Otsem Bank. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private getTemplateStyles(template?: EmailTemplate): { headerBg: string; icon: string; ctaButton: string } {
    const templates: Record<string, { headerBg: string; icon: string; ctaButton: string }> = {
      kyc_reminder: {
        headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        icon: '📋',
        ctaButton: `
          <a href="https://app.otsembank.com/kyc" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
            Completar Verificação
          </a>
        `,
      },
      account_blocked: {
        headerBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        icon: '🔒',
        ctaButton: `
          <a href="https://app.otsembank.com/support" style="display: inline-block; padding: 14px 32px; background: #ef4444; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
            Falar com Suporte
          </a>
        `,
      },
      account_unblocked: {
        headerBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        icon: '✅',
        ctaButton: `
          <a href="https://app.otsembank.com" style="display: inline-block; padding: 14px 32px; background: #10b981; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
            Acessar Minha Conta
          </a>
        `,
      },
      welcome: {
        headerBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        icon: '🎉',
        ctaButton: `
          <a href="https://app.otsembank.com" style="display: inline-block; padding: 14px 32px; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
            Começar Agora
          </a>
        `,
      },
    };

    return templates[template || 'custom'] || {
      headerBg: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
      icon: '💼',
      ctaButton: '',
    };
  }
}
