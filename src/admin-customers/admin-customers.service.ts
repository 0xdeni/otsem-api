// src/admin-customers/admin-customers.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminListCustomersDto } from './dto/admin-list-customers.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminCustomersService {
    constructor(private prisma: PrismaService) { }

    async list(dto: AdminListCustomersDto) {
        const { page = 1, pageSize = 10, q, type, status } = dto;
        const skip = (page - 1) * pageSize;
        const take = pageSize;

        const where: Prisma.CustomerWhereInput = {
            AND: [
                type ? { type } : {},
                status ? { accountStatus: status } : {},
                q
                    ? {
                        OR: [
                            { email: { contains: q, mode: 'insensitive' } },
                            { phone: { contains: q, mode: 'insensitive' } },
                            { name: { contains: q, mode: 'insensitive' } },
                            { cpf: { contains: q } },
                            { cnpj: { contains: q } },
                            { legalName: { contains: q, mode: 'insensitive' } },
                            { tradeName: { contains: q, mode: 'insensitive' } },
                        ],
                    }
                    : {},
            ],
        };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.customer.findMany({
                skip,
                take,
                where,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    type: true,
                    accountStatus: true,
                    email: true,
                    phone: true,
                    name: true,
                    cpf: true,
                    cnpj: true,
                    legalName: true,
                    tradeName: true,
                    createdAt: true,
                    updatedAt: true,
                    authUser: {
                        select: { id: true, name: true, email: true, isActive: true, role: true },
                    },
                },
            }),
            this.prisma.customer.count({ where }),
        ]);

        // resposta “achatada” pra UI
        const mapped = items.map((c) => ({
            id: c.id,
            type: c.type,                        // PF | PJ
            kycStatus: c.accountStatus,          // enum do prisma
            userName: c.authUser?.name ?? null,
            userEmail: c.authUser?.email ?? null,
            isActive: c.authUser?.isActive ?? true,
            phone: c.phone,
            name: c.type === 'PF' ? c.name : c.legalName,
            taxId: c.type === 'PF' ? c.cpf : c.cnpj,
            createdAt: c.createdAt,
        }));

        return { total, page, pageSize, items: mapped };
    }
}
