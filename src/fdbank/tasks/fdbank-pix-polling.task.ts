import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FdbankPixIntegrationService } from '../services/fdbank-pix-integration.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FdbankPixPollingTask {
    private readonly logger = new Logger(FdbankPixPollingTask.name);
    private isRunning = false;

    constructor(
        private readonly fdbankPixService: FdbankPixIntegrationService,
        private readonly prisma: PrismaService,
    ) {}

    @Cron('*/1 * * * *')
    async pollPixReceived() {
        // Check if FDBank is enabled before polling
        const settings = await this.prisma.systemSettings.findUnique({
            where: { id: 'singleton' },
        });

        if (!settings?.fdbankEnabled) {
            return;
        }

        if (this.isRunning) {
            this.logger.debug('FDBank polling already running, skipping...');
            return;
        }

        this.isRunning = true;
        try {
            this.logger.log('Starting FDBank PIX reconciliation polling...');
            const resultado = await this.fdbankPixService.reconciliarCobrancas(1);

            if (resultado.processadas > 0) {
                this.logger.log(`FDBank polling: ${resultado.processadas} transactions credited`);
            } else {
                this.logger.debug('FDBank polling: no new transactions to process');
            }

            if (resultado.erros.length > 0) {
                this.logger.warn(`FDBank polling: ${resultado.erros.length} errors - ${resultado.erros.join(', ')}`);
            }
        } catch (error: any) {
            this.logger.error(`Error in FDBank PIX polling: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }
}
