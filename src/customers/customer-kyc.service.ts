import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiditService } from '../didit/didit.service';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class CustomerKycService {
    private readonly logger = new Logger(CustomerKycService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly diditService: DiditService,
    ) { }

    async requestKyc(customerId: string, callbackUrl?: string) {
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Customer não encontrado');

        if (customer.accountStatus !== AccountStatus.not_requested) {
            if (customer.diditVerificationUrl) {
                return {
                    id: customer.id,
                    accountStatus: customer.accountStatus,
                    verificationUrl: customer.diditVerificationUrl,
                    sessionId: customer.diditSessionId,
                    message: 'KYC já solicitado. Use a URL de verificação para continuar.',
                };
            }
            throw new BadRequestException('KYC já solicitado ou processado');
        }

        const session = await this.diditService.createSession(customerId, callbackUrl);

        const updated = await this.prisma.customer.update({
            where: { id: customerId },
            data: {
                accountStatus: AccountStatus.requested,
                diditSessionId: session.sessionId,
                diditVerificationUrl: session.verificationUrl,
            },
        });

        this.logger.log(`KYC solicitado para customer=${customerId}, sessionId=${session.sessionId}`);

        return {
            id: updated.id,
            accountStatus: updated.accountStatus,
            verificationUrl: session.verificationUrl,
            sessionId: session.sessionId,
            requestedAt: updated.updatedAt,
        };
    }

    async getKycStatus(customerId: string) {
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Customer não encontrado');

        let diditDecision = null;
        if (customer.diditSessionId) {
            try {
                diditDecision = await this.diditService.getSessionDecision(customer.diditSessionId);
            } catch (error) {
                this.logger.warn(`Não foi possível buscar decisão Didit: ${error.message}`);
            }
        }

        return {
            id: customer.id,
            accountStatus: customer.accountStatus,
            diditSessionId: customer.diditSessionId,
            diditVerificationUrl: customer.diditVerificationUrl,
            diditDecision,
        };
    }

    async moveToReview(customerId: string) {
        return this.setStatus(customerId, AccountStatus.in_review);
    }

    async approve(customerId: string) {
        return this.setStatus(customerId, AccountStatus.approved);
    }

    async reject(customerId: string, reason?: string) {
        const customer = await this.setStatus(customerId, AccountStatus.rejected);
        return { ...customer, rejectionReason: reason || 'Não informado' };
    }

    async setStatus(customerId: string, status: AccountStatus) {
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Customer não encontrado');

        const updated = await this.prisma.customer.update({
            where: { id: customerId },
            data: { accountStatus: status },
        });

        this.logger.log(`Status atualizado: ${customerId} => ${status}`);

        return {
            id: updated.id,
            accountStatus: updated.accountStatus,
            updatedAt: updated.updatedAt,
        };
    }
}
