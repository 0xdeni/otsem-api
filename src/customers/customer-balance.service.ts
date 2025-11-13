import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatementsService } from '../statements/statements.service';

@Injectable()
export class CustomerBalanceService {
    private readonly logger = new Logger(CustomerBalanceService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly statements: StatementsService,
    ) { }

    async getBalanceByCustomerId(customerId: string) {
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Customer não encontrado');

        if (!customer.externalClientId) {
            return {
                available: 0,
                blocked: 0,
                total: 0,
                currency: 'BRL',
                accountHolderId: null,
                pixKey: null,
                updatedAt: new Date().toISOString(),
                pendingExternalActivation: true,
            };
        }

        // Delegar para StatementsService (já existente)
        const raw = await this.statements.getBalance(customer.externalClientId).catch(() => null);

        if (!raw) {
            this.logger.warn(`Saldo não disponível para externalClientId=${customer.externalClientId}`);
            return {
                available: 0,
                blocked: 0,
                total: 0,
                currency: 'BRL',
                accountHolderId: customer.externalClientId,
                pixKey: null,
                updatedAt: new Date().toISOString(),
                pendingExternalActivation: true,
            };
        }

        return {
            available: raw.availableBalance ?? raw.balance ?? 0,
            blocked: raw.blockedAmount ?? raw.blockedBalance ?? 0,
            total: (raw.availableBalance ?? raw.balance ?? 0) + (raw.blockedAmount ?? raw.blockedBalance ?? 0),
            currency: 'BRL',
            accountHolderId: customer.externalClientId,
            pixKey: raw.pixKey ?? null,
            updatedAt: raw.updatedAt ?? new Date().toISOString(),
        };
    }
}