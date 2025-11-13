import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class CustomerKycService {
    private readonly logger = new Logger(CustomerKycService.name);

    constructor(private readonly prisma: PrismaService) { }

    async requestKyc(customerId: string) {
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Customer não encontrado');

        if (customer.accountStatus !== AccountStatus.not_requested) {
            throw new BadRequestException('KYC já solicitado ou processado');
        }

        const updated = await this.prisma.customer.update({
            where: { id: customerId },
            data: { accountStatus: AccountStatus.requested },
        });

        this.logger.log(`KYC solicitado para customer=${customerId}`);

        return {
            id: updated.id,
            accountStatus: updated.accountStatus,
            requestedAt: updated.updatedAt,
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