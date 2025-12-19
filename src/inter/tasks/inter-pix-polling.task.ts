import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InterPixService } from '../services/inter-pix.service';

@Injectable()
export class InterPixPollingTask {
    private readonly logger = new Logger(InterPixPollingTask.name);
    private isRunning = false;

    constructor(private readonly interPixService: InterPixService) { }

    @Cron('*/1 * * * *')
    async pollPixReceived() {
        if (this.isRunning) {
            this.logger.debug('⏳ Polling já em execução, ignorando...');
            return;
        }

        this.isRunning = true;
        try {
            this.logger.log('🔄 Iniciando polling de reconciliação PIX...');
            const resultado = await this.interPixService.reconciliarCobrancas(1);
            
            if (resultado.processadas > 0) {
                this.logger.log(`✅ Polling: ${resultado.processadas} transações creditadas automaticamente`);
            } else {
                this.logger.debug(`📋 Polling: nenhuma nova transação para processar`);
            }
            
            if (resultado.erros.length > 0) {
                this.logger.warn(`⚠️ Polling: ${resultado.erros.length} erros - ${resultado.erros.join(', ')}`);
            }
        } catch (error: any) {
            this.logger.error(`❌ Erro no polling PIX: ${error.message}`);
        } finally {
            this.isRunning = false;
        }
    }
}
