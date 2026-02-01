import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InterPixService } from '../inter/services/inter-pix.service';
import { FdbankPixIntegrationService } from '../fdbank/services/fdbank-pix-integration.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { SendPixDto, PixPaymentResponseDto } from '../inter/dto/send-pix.dto';
import { CreatePixChargeDto } from '../inter/dto/create-pix-charge.dto';
import { BankProvider } from '@prisma/client';

@Injectable()
export class BankingGatewayService {
    private readonly logger = new Logger(BankingGatewayService.name);

    constructor(
        private readonly interPixService: InterPixService,
        private readonly fdbankPixService: FdbankPixIntegrationService,
        private readonly settingsService: SystemSettingsService,
    ) {}

    /**
     * Get the currently active bank provider
     */
    async getActiveProvider(): Promise<BankProvider> {
        return this.settingsService.getActiveBankProvider();
    }

    /**
     * Create PIX charge (QR Code) - routes to active bank
     */
    async createCobranca(dto: CreatePixChargeDto, customerId?: string): Promise<any> {
        const provider = await this.getActiveProvider();
        this.logger.log(`Creating charge via ${provider}`);

        if (provider === 'FDBANK') {
            return this.fdbankPixService.createCobranca(dto, customerId);
        }

        return this.interPixService.createCobranca(dto, customerId);
    }

    /**
     * Send PIX with validations - routes to active bank
     */
    async sendPix(customerId: string, dto: SendPixDto): Promise<PixPaymentResponseDto> {
        const provider = await this.getActiveProvider();
        this.logger.log(`Sending PIX via ${provider}`);

        if (provider === 'FDBANK') {
            return this.fdbankPixService.sendPix(customerId, dto);
        }

        return this.interPixService.sendPix(customerId, dto);
    }

    /**
     * Send PIX internal (no validations) - routes to active bank
     */
    async sendPixInternal(dto: {
        valor: number;
        chaveDestino: string;
        tipoChave: string;
        descricao?: string;
        nomeFavorecido?: string;
    }): Promise<PixPaymentResponseDto> {
        const provider = await this.getActiveProvider();
        this.logger.log(`[INTERNAL] Sending PIX via ${provider}`);

        if (provider === 'FDBANK') {
            return this.fdbankPixService.sendPixInternal(dto);
        }

        return this.interPixService.sendPixInternal(dto);
    }

    /**
     * Get PIX status - routes to active bank
     */
    async getPixStatus(endToEndId: string): Promise<any> {
        const provider = await this.getActiveProvider();

        if (provider === 'FDBANK') {
            return this.fdbankPixService.getPixStatus(endToEndId);
        }

        return this.interPixService.getPixStatus(endToEndId);
    }

    /**
     * Get charge details - routes to active bank
     */
    async getCobranca(txid: string): Promise<any> {
        const provider = await this.getActiveProvider();

        if (provider === 'FDBANK') {
            return this.fdbankPixService.getCobranca(txid);
        }

        return this.interPixService.getCobranca(txid);
    }

    /**
     * Validate PIX key via micro-transfer (R$ 0.01)
     * Currently only Inter supports this; FDBank falls back to Inter.
     */
    async validatePixKeyByMicroTransfer(customerId: string, pixKeyId: string): Promise<any> {
        return this.interPixService.validatePixKeyByMicroTransfer(customerId, pixKeyId);
    }

    /**
     * List charges for the last N days - routes to active bank
     */
    async listCobrancas(dias: number): Promise<any> {
        const provider = await this.getActiveProvider();

        if (provider === 'FDBANK') {
            return this.fdbankPixService.reconciliarCobrancas(dias);
        }

        return this.interPixService.listCobrancas(dias);
    }

    /**
     * Reconcile pending charges - routes to active bank
     */
    async reconciliarCobrancas(dias: number): Promise<any> {
        const provider = await this.getActiveProvider();

        if (provider === 'FDBANK') {
            return this.fdbankPixService.reconciliarCobrancas(dias);
        }

        return this.interPixService.reconciliarCobrancas(dias);
    }

    /**
     * Explicitly use a specific bank provider (override active setting)
     */
    async sendPixVia(provider: BankProvider, customerId: string, dto: SendPixDto): Promise<PixPaymentResponseDto> {
        if (provider === 'FDBANK') {
            return this.fdbankPixService.sendPix(customerId, dto);
        }
        return this.interPixService.sendPix(customerId, dto);
    }

    /**
     * Explicitly use a specific bank provider for internal sends
     */
    async sendPixInternalVia(provider: BankProvider, dto: {
        valor: number;
        chaveDestino: string;
        tipoChave: string;
        descricao?: string;
        nomeFavorecido?: string;
    }): Promise<PixPaymentResponseDto> {
        if (provider === 'FDBANK') {
            return this.fdbankPixService.sendPixInternal(dto);
        }
        return this.interPixService.sendPixInternal(dto);
    }
}
