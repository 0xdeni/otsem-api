import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FdbankWebhookService } from '../services/fdbank-webhook.service';

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
    ) {}

    @Post()
    @HttpCode(200)
    @ApiOperation({ summary: 'Receive PIX webhook from FDBank (legacy URL)' })
    async handleWebhook(@Body() payload: any) {
        this.logger.log('Received FDBank webhook at /webhook-fd');

        try {
            await this.webhookService.handlePixReceived(payload);
            return { status: 'ok' };
        } catch (error: any) {
            this.logger.error(`Error processing FDBank webhook: ${error.message}`);
            return { status: 'error', message: error.message };
        }
    }
}
