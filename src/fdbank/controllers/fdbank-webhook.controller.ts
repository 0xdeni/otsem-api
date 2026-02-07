import {
    Controller,
    Post,
    Get,
    Body,
    Headers,
    UseGuards,
    Logger,
    HttpCode,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { FdbankWebhookService } from '../services/fdbank-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';

@ApiTags('FDBank Webhooks')
@Controller('fdbank/webhooks')
export class FdbankWebhookController {
    private readonly logger = new Logger(FdbankWebhookController.name);

    constructor(
        private readonly webhookService: FdbankWebhookService,
        private readonly prisma: PrismaService,
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
            this.logger.error('❌ Header de autenticação ausente no webhook FDBank');
            throw new BadRequestException('Webhook authentication required');
        }

        const isValid = crypto.timingSafeEqual(
            Buffer.from(receivedSecret),
            Buffer.from(secret),
        );

        if (!isValid) {
            this.logger.error('❌ Webhook secret inválido');
            throw new BadRequestException('Invalid webhook secret');
        }
    }

    /**
     * Receive PIX webhook from FDBank — requires x-webhook-secret header
     */
    @Post('receive/pix')
    @HttpCode(200)
    @ApiOperation({ summary: 'Receive PIX webhook from FDBank' })
    @ApiHeader({ name: 'x-webhook-secret', description: 'Shared webhook secret', required: true })
    async handlePixWebhook(@Body() payload: any, @Headers() headers: any) {
        this.logger.log('Received FDBank PIX webhook');

        this.validateWebhookSecret(headers);

        try {
            await this.webhookService.handlePixReceived(payload);
            return { status: 'ok' };
        } catch (error: any) {
            this.logger.error(`Error processing FDBank PIX webhook: ${error.message}`);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Get recent FDBank webhook logs (admin only)
     */
    @Get('logs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get FDBank webhook logs' })
    async getLogs() {
        const logs = await this.prisma.webhookLog.findMany({
            where: { source: 'FDBANK' },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return logs;
    }

    /**
     * Get webhook health stats (admin only)
     */
    @Get('health')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get FDBank webhook health stats' })
    async healthCheck() {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const logs = await this.prisma.webhookLog.findMany({
            where: {
                source: 'FDBANK',
                createdAt: { gte: since },
            },
            select: { type: true, processed: true, error: true },
        });

        const stats = {
            total: logs.length,
            processed: logs.filter(l => l.processed).length,
            failed: logs.filter(l => !l.processed).length,
            byType: {} as Record<string, number>,
        };

        for (const log of logs) {
            stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
        }

        return { period: '24h', ...stats };
    }
}
