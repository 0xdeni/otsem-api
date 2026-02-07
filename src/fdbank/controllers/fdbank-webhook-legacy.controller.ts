import { Controller, Post, Body, Headers, Logger, HttpCode, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { FdbankWebhookService } from '../services/fdbank-webhook.service';
import * as crypto from 'crypto';

/**
 * Legacy webhook endpoint at /webhook-fd
 * FDBank is configured to send webhooks to https://api.otsembank.com/webhook-fd
 */
@ApiTags('FDBank Webhooks')
@Controller('webhook-fd')
export class FdbankWebhookLegacyController {
    private readonly logger = new Logger(FdbankWebhookLegacyController.name);

    constructor(
        private readonly webhookService: FdbankWebhookService,
        private readonly configService: ConfigService,
    ) {}

    private validateWebhookSecret(headers: any): void {
        const secret = this.configService.get<string>('FDBANK_WEBHOOK_SECRET');
        if (!secret) {
            this.logger.error('❌ FDBANK_WEBHOOK_SECRET não configurado — rejeitando webhook por segurança');
            throw new BadRequestException('Webhook secret not configured');
        }

        const receivedSecret = headers['x-webhook-secret'] || headers['x-fdbank-signature'];
        if (!receivedSecret) {
            this.logger.error('❌ Header de autenticação ausente no webhook FDBank (legacy)');
            throw new BadRequestException('Webhook authentication required');
        }

        const isValid = crypto.timingSafeEqual(
            Buffer.from(receivedSecret),
            Buffer.from(secret),
        );

        if (!isValid) {
            this.logger.error('❌ Webhook secret inválido (legacy)');
            throw new BadRequestException('Invalid webhook secret');
        }
    }

    @Post()
    @HttpCode(200)
    @ApiOperation({ summary: 'Receive PIX webhook from FDBank (legacy URL)' })
    @ApiHeader({ name: 'x-webhook-secret', description: 'Shared webhook secret', required: true })
    async handleWebhook(@Body() payload: any, @Headers() headers: any) {
        this.logger.log('Received FDBank webhook at /webhook-fd');

        this.validateWebhookSecret(headers);

        try {
            await this.webhookService.handlePixReceived(payload);
            return { status: 'ok' };
        } catch (error: any) {
            this.logger.error(`Error processing FDBank webhook: ${error.message}`);
            return { status: 'error', message: error.message };
        }
    }
}
