import { Controller, Post, Body, Logger, HttpCode, HttpStatus, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { DiditWebhookPayloadDto } from './dto/webhook.dto';
import { AccountStatus } from '@prisma/client';
import * as crypto from 'crypto';

@ApiTags('Didit Webhooks')
@Controller('kyc/didit')
export class DiditController {
  private readonly logger = new Logger(DiditController.name);

  constructor(private readonly prisma: PrismaService) {}

  private verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.DIDIT_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.warn('DIDIT_WEBHOOK_SECRET não configurado — rejeitando webhook');
      return false;
    }
    if (!signature) return false;
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook para receber notificações de verificação Didit' })
  @ApiResponse({ status: 200, description: 'Webhook processado com sucesso' })
  async handleVerificationWebhook(
    @Body() payload: DiditWebhookPayloadDto,
    @Headers('x-didit-signature') signature?: string,
  ) {
    if (!this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      this.logger.warn('Webhook Didit rejeitado: assinatura inválida');
      throw new BadRequestException('Assinatura do webhook inválida');
    }

    this.logger.log(`Webhook Didit recebido: sessionId=${payload.session_id}, status=${payload.status}`);

    await this.prisma.webhookLog.create({
      data: {
        source: 'didit',
        type: 'verification',
        payload: payload as any,
        processed: false,
      },
    });

    if (!payload.session_id) {
      this.logger.warn('Webhook sem session_id, ignorando');
      return { received: true, warning: 'Missing session_id' };
    }

    const customer = await this.prisma.customer.findFirst({
      where: { diditSessionId: payload.session_id },
    });

    if (!customer) {
      this.logger.warn(`Session ID não encontrado no banco: ${payload.session_id}`);
      return { received: true, warning: 'Session ID não encontrado' };
    }

    let newStatus: AccountStatus | null = null;
    const statusLower = payload.status?.toLowerCase();

    switch (statusLower) {
      case 'approved':
        newStatus = AccountStatus.approved;
        break;
      case 'declined':
        newStatus = AccountStatus.rejected;
        break;
      case 'in progress':
      case 'in_progress':
        newStatus = AccountStatus.in_review;
        break;
      case 'review':
        newStatus = AccountStatus.in_review;
        break;
    }

    if (newStatus) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { accountStatus: newStatus },
      });

      this.logger.log(`Customer ${customer.id} atualizado para status ${newStatus}`);
    }

    await this.prisma.webhookLog.updateMany({
      where: {
        source: 'didit',
        payload: { path: ['session_id'], equals: payload.session_id },
        processed: false,
      },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    return { received: true, customerId: customer.id, newStatus };
  }
}
