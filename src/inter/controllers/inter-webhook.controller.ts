// src/inter/controllers/inter-webhook.controller.ts

import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Headers,
    Logger,
    BadRequestException,
    HttpCode,
    HttpStatus,
    Req,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiTags,
    ApiParam,
    ApiBody,
    ApiHeader,
    ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';
import { InterWebhookService } from '../services/inter-webhook.service';
import {
    CreateWebhookCallbackDto,
    UpdateWebhookCallbackDto,
} from '../dto/webhook.dto';
import type { Request } from 'express';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('🔔 Webhooks (Inter)')
@Controller('inter/webhooks')
export class InterWebhookController {
    private readonly logger = new Logger(InterWebhookController.name);

    constructor(private readonly service: InterWebhookService) { }

    // ==================== GERENCIAR CALLBACKS (ADMIN) ====================

    @Get(':tipoWebhook/callbacks')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: '📋 Consultar callbacks cadastrados' })
    @ApiParam({
        name: 'tipoWebhook',
        enum: ['pix', 'boletos'],
        description: 'Tipo do webhook',
        example: 'pix',
    })
    @ApiResponse({ status: 200, description: 'Callbacks encontrados' })
    async getCallbacks(@Param('tipoWebhook') tipoWebhook: string) {
        this.logger.log(`📋 Consultando callbacks: ${tipoWebhook}`);
        return this.service.getCallbacks(tipoWebhook);
    }

    @Post(':tipoWebhook/callbacks')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: '➕ Criar callback' })
    @ApiParam({
        name: 'tipoWebhook',
        enum: ['pix', 'boletos'],
    })
    @ApiBody({ type: CreateWebhookCallbackDto })
    @ApiResponse({ status: 201, description: 'Callback criado com sucesso' })
    async createCallback(
        @Param('tipoWebhook') tipoWebhook: string,
        @Body() dto: CreateWebhookCallbackDto,
    ) {
        this.logger.log(`➕ Criando callback ${tipoWebhook}: ${dto.webhookUrl}`);
        return this.service.createCallback(tipoWebhook, dto);
    }

    @Put(':tipoWebhook/callbacks')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: '✏️ Atualizar callback' })
    @ApiParam({
        name: 'tipoWebhook',
        enum: ['pix', 'boletos'],
    })
    @ApiBody({ type: UpdateWebhookCallbackDto })
    @ApiResponse({ status: 200, description: 'Callback atualizado' })
    async updateCallback(
        @Param('tipoWebhook') tipoWebhook: string,
        @Body() dto: UpdateWebhookCallbackDto,
    ) {
        this.logger.log(`✏️ Atualizando callback ${tipoWebhook}: ${dto.webhookUrl}`);
        return this.service.updateCallback(tipoWebhook, dto);
    }

    @Delete(':tipoWebhook/callbacks')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: '🗑️ Excluir callback' })
    @ApiParam({
        name: 'tipoWebhook',
        enum: ['pix', 'boletos'],
    })
    @ApiResponse({ status: 200, description: 'Callback excluído' })
    async deleteCallback(@Param('tipoWebhook') tipoWebhook: string) {
        this.logger.log(`🗑️ Excluindo callback: ${tipoWebhook}`);
        return this.service.deleteCallback(tipoWebhook);
    }

    // ==================== RECEBER WEBHOOKS (PÚBLICO) ====================

    @Post('receive/pix')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { ttl: 60000, limit: 30 } }) // 30 webhook calls per minute per IP
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '💰 Receber webhook de Pix (Público)',
        description:
            'Endpoint chamado automaticamente pelo Banco Inter quando um Pix é recebido. Requer assinatura HMAC válida.',
    })
    @ApiHeader({
        name: 'x-inter-signature',
        description: 'Assinatura HMAC SHA256 do webhook (obrigatória)',
        required: true,
    })
    @ApiResponse({
        status: 200,
        description: 'Webhook processado com sucesso',
        schema: {
            example: {
                success: true,
                message: 'Webhook processado',
                processedAt: '2025-11-13T16:00:00.000Z',
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Erro ao processar webhook' })
    @ApiResponse({ status: 401, description: 'Assinatura ausente ou inválida' })
    async handlePixWebhook(@Req() req: Request, @Headers() headers: any) {
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        this.logger.log(`📥 Webhook Pix recebido de IP: ${ipAddress}`);
        this.logger.debug('Headers:', JSON.stringify(headers, null, 2));
        this.logger.debug('Body:', JSON.stringify(req.body, null, 2));

        try {
            // ✅ Validar assinatura (OBRIGATÓRIA)
            const signature = headers['x-inter-signature'] || headers['x-signature'];
            if (!signature) {
                this.logger.error(`❌ Webhook Pix sem assinatura! IP: ${ipAddress} | UA: ${userAgent}`);
                await this.service.logRejectedWebhook('pix_received', req.body, 'Assinatura ausente', String(ipAddress), String(userAgent));
                throw new BadRequestException('Assinatura obrigatória');
            }

            const isValid = await this.service.validateWebhookSignature(
                req.body,
                signature,
            );

            if (!isValid) {
                this.logger.error(`❌ Assinatura inválida! IP: ${ipAddress} | UA: ${userAgent}`);
                await this.service.logRejectedWebhook('pix_received', req.body, 'Assinatura inválida', String(ipAddress), String(userAgent));
                throw new BadRequestException('Assinatura inválida');
            }
            this.logger.log('✅ Assinatura validada');

            const isValid = await this.service.validateWebhookSignature(
                req.body,
                signature,
            );

            if (!isValid) {
                this.logger.error('❌ Assinatura inválida!');
                throw new BadRequestException('Assinatura inválida');
            }
            this.logger.log('✅ Assinatura validada');

            // ✅ Processar webhook
            await this.service.handlePixReceived(req.body, String(ipAddress), String(userAgent));

            this.logger.log('✅ Webhook Pix processado com sucesso');

            return {
                success: true,
                message: 'Webhook processado',
                processedAt: new Date().toISOString(),
            };
        } catch (error: any) {
            this.logger.error('❌ Erro ao processar webhook Pix:', error.message);
            this.logger.error('Stack:', error.stack);

            // Re-throw BadRequestException so NestJS returns the proper status
            if (error instanceof BadRequestException) {
                throw error;
            }

            // For other errors, return 200 to prevent Inter from retrying
            return {
                success: false,
                error: error.message,
                processedAt: new Date().toISOString(),
            };
        }
    }

    @Post('receive/boletos')
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { ttl: 60000, limit: 30 } }) // 30 webhook calls per minute per IP
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '📄 Receber webhook de Boleto (Público)',
        description:
            'Endpoint chamado automaticamente pelo Banco Inter quando há alteração em boleto. Requer assinatura HMAC válida.',
    })
    @ApiHeader({
        name: 'x-inter-signature',
        description: 'Assinatura HMAC SHA256 (obrigatória)',
        required: true,
    })
    @ApiResponse({
        status: 200,
        description: 'Webhook processado',
    })
    @ApiResponse({ status: 401, description: 'Assinatura ausente ou inválida' })
    async handleBoletoWebhook(@Req() req: Request, @Headers() headers: any) {
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        this.logger.log(`📥 Webhook Boleto recebido de IP: ${ipAddress}`);

        try {
            // ✅ Validar assinatura (OBRIGATÓRIA)
            const signature = headers['x-inter-signature'] || headers['x-signature'];
            if (!signature) {
                this.logger.error(`❌ Webhook Boleto sem assinatura! IP: ${ipAddress} | UA: ${userAgent}`);
                await this.service.logRejectedWebhook('boleto_received', req.body, 'Assinatura ausente', String(ipAddress), String(userAgent));
                throw new BadRequestException('Assinatura obrigatória');
            }

            const isValid = await this.service.validateWebhookSignature(
                req.body,
                signature,
            );

            if (!isValid) {
                this.logger.error(`❌ Assinatura inválida! IP: ${ipAddress} | UA: ${userAgent}`);
                await this.service.logRejectedWebhook('boleto_received', req.body, 'Assinatura inválida', String(ipAddress), String(userAgent));
                throw new BadRequestException('Assinatura inválida');
            }

            await this.service.handleBoletoReceived(req.body);

            this.logger.log('✅ Webhook Boleto processado');

            return {
                success: true,
                message: 'Webhook processado',
                processedAt: new Date().toISOString(),
            };
        } catch (error: any) {
            this.logger.error('❌ Erro ao processar webhook Boleto:', error.message);

            if (error instanceof BadRequestException) {
                throw error;
            }

            return {
                success: false,
                error: error.message,
                processedAt: new Date().toISOString(),
            };
        }
    }

    // ==================== TESTE/DEBUG (ADMIN) ====================

    @Post('test/:tipoWebhook') // ✅ POST em vez de GET
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: '🧪 Testar webhook manualmente' })
    @ApiParam({
        name: 'tipoWebhook',
        enum: ['pix', 'boletos'],
        description: 'Tipo do webhook para testar',
        example: 'pix',
    })
    @ApiResponse({
        status: 200,
        description: 'Teste executado com sucesso',
        schema: {
            example: {
                success: true,
                message: 'Webhook Pix de teste processado',
                payload: {
                    pix: [
                        {
                            e2eId: 'E1731512345TEST',
                            txid: 'TEST-1731512345',
                            valor: 100.5,
                            horario: '2025-11-13T16:00:00.000Z',
                        },
                    ],
                },
            },
        },
    })
    async testWebhook(@Param('tipoWebhook') tipoWebhook: string) {
        this.logger.log(`🧪 Teste manual do webhook: ${tipoWebhook}`);
        return this.service.testWebhook(tipoWebhook);
    }

    // ==================== LOGS (ADMIN) ====================

    @Get('logs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: '📊 Ver logs de webhooks' })
    @ApiResponse({ status: 200, description: 'Logs encontrados' })
    async getLogs() {
        const logs = await this.service['prisma'].webhookLog.findMany({
            where: { source: 'INTER' },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                type: true,
                endToEnd: true,
                txid: true,
                processed: true,
                error: true,
                createdAt: true,
                processedAt: true,
            },
        });

        return {
            total: logs.length,
            logs,
        };
    }

    @Get('logs/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: '🔍 Ver detalhes do log' })
    @ApiParam({ name: 'id', description: 'ID do log' })
    @ApiResponse({ status: 200, description: 'Log encontrado' })
    @ApiResponse({ status: 404, description: 'Log não encontrado' })
    async getLogDetails(@Param('id') id: string) {
        const log = await this.service['prisma'].webhookLog.findUnique({
            where: { id },
        });

        if (!log) {
            throw new BadRequestException('Log não encontrado');
        }

        return log;
    }

    @Get('health')
    @ApiOperation({ summary: '💚 Health check dos webhooks' })
    @ApiResponse({ status: 200, description: 'Status do sistema' })
    async healthCheck() {
        const stats = await this.service['prisma'].webhookLog.groupBy({
            by: ['type', 'processed'],
            where: {
                source: 'INTER',
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h
                },
            },
            _count: true,
        });

        const summary = {
            last24Hours: stats.reduce(
                (acc, curr) => {
                    const key = curr.processed ? 'processed' : 'failed';
                    acc[key] += curr._count;
                    return acc;
                },
                { processed: 0, failed: 0 },
            ),
            byType: stats.reduce(
                (acc, curr) => {
                    if (!acc[curr.type]) {
                        acc[curr.type] = { processed: 0, failed: 0 };
                    }
                    const key = curr.processed ? 'processed' : 'failed';
                    acc[curr.type][key] += curr._count;
                    return acc;
                },
                {} as Record<string, { processed: number; failed: number }>,
            ),
        };

        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            stats: summary,
        };
    }
}