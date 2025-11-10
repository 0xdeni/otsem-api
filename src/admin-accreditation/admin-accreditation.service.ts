import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccreditationService } from '../accreditation/accreditation.service';
import { AccountStatus, CustomerType } from '@prisma/client';
import { AdminAccreditatePfDto } from './dto/admin-accreditate-pf.dto';
import { AdminAccreditatePjDto } from './dto/admin-accreditate-pj.dto';

@Injectable()
export class AdminAccreditationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly accreditation: AccreditationService,
    ) { }

    /* -------- LISTAR CLIENTES -------- */
    async list() {
        const customers = await this.prisma.customer.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                type: true,
                name: true,
                legalName: true,
                cpf: true,
                cnpj: true,
                email: true,
                phone: true,
                accountStatus: true,
                externalAccredId: true,
                externalClientId: true,
                createdAt: true,
            },
        });

        return customers.map((c) => ({
            id: c.id,
            type: c.type,
            name: c.type === CustomerType.PF ? c.name : c.legalName,
            taxNumber: c.type === CustomerType.PF ? c.cpf : c.cnpj,
            email: c.email,
            phone: c.phone,
            status: c.accountStatus,
            externalClientId: c.externalClientId,
            externalAccredId: c.externalAccredId,
            createdAt: c.createdAt,
        }));
    }

    /* -------- CREDENCIAR PF -------- */
    async accreditPerson(id: string, dto: AdminAccreditatePfDto) {
        const customer = await this.prisma.customer.findUnique({
            where: { id },
            include: { address: true, pixLimits: true },
        });

        if (!customer) throw new BadRequestException('Cliente não encontrado');
        if (customer.type !== CustomerType.PF)
            throw new BadRequestException('Cliente não é pessoa física');

        const result = await this.accreditation.accreditPerson(dto);

        await this.prisma.customer.update({
            where: { id },
            data: {
                externalClientId: result.clientId,
                externalAccredId: result.accreditationId,
                accountStatus: AccountStatus.in_review,
            },
        });

        return result;
    }

    /* -------- CREDENCIAR PJ -------- */
    async accreditCompany(id: string, dto: AdminAccreditatePjDto) {
        const customer = await this.prisma.customer.findUnique({
            where: { id },
            include: { address: true, pixLimits: true, ownerships: true },
        });

        if (!customer) throw new BadRequestException('Cliente não encontrado');
        if (customer.type !== CustomerType.PJ)
            throw new BadRequestException('Cliente não é pessoa jurídica');

        const result = await this.accreditation.accreditCompany(dto);

        await this.prisma.customer.update({
            where: { id },
            data: {
                externalClientId: result.clientId,
                externalAccredId: result.accreditationId,
                accountStatus: AccountStatus.in_review,
            },
        });

        return result;
    }
}
