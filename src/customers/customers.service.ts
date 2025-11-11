// src/customers/customers.service.ts
import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccreditationService } from '../accreditation/accreditation.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import {
  UpdateCustomerDto,
  AccountStatusDto,
  CustomerTypeDto,
} from './dto/update-customer.dto';
import { Role, AccountStatus } from '@prisma/client';

function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '');
}

interface AuthUser {
  sub: string;
  role?: Role;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accreditationService: AccreditationService,
  ) {}

  /* -------------------- CREATE -------------------- */

  async createPF(
    input: CreatePersonDto,
    userId?: string,
    initialStatus: AccountStatusDto = AccountStatusDto.not_requested,
    accreditNow = false,
  ) {
    const { identifier, productId, person, pixLimits } = input;
    const cpf = onlyDigits(person.cpf);

    const created = await this.prisma.customer.create({
      data: {
        userId: userId ?? null,
        type: 'PF',
        accountStatus: initialStatus,
        identifier,
        productId,
        email: person.email,
        phone: person.phone,
        name: person.name,
        socialName: person.socialName ?? null,
        cpf,
        birthday: new Date(person.birthday),
        genderId: person.genderId ?? null,
        address: {
          create: {
            zipCode: person.address.zipCode,
            street: person.address.street,
            number: person.address.number ?? null,
            complement: person.address.complement ?? null,
            neighborhood: person.address.neighborhood,
            cityIbgeCode: person.address.cityIbgeCode,
          },
        },
        pixLimits: {
          create: {
            singleTransfer: pixLimits.singleTransfer,
            daytime: pixLimits.daytime,
            nighttime: pixLimits.nighttime,
            monthly: pixLimits.monthly,
            serviceId: pixLimits.serviceId,
          },
        },
      },
      include: { address: true, pixLimits: true, ownerships: true },
    });

    if (accreditNow) {
      try {
        const dto = {
          identifier: input.identifier,
          productId: input.productId,
          name: person.name,
          socialName: person.socialName ?? '',
          cpf,
          birthday: person.birthday,
          phone: onlyDigits(person.phone),
          email: person.email.toLowerCase(),
          genderId: person.genderId ?? undefined,
          address: {
            zipCode: onlyDigits(person.address.zipCode),
            street: person.address.street,
            number: person.address.number ?? '',
            complement: person.address.complement ?? '',
            neighborhood: person.address.neighborhood,
            cityIbgeCode: person.address.cityIbgeCode,
          },
          pixLimits: {
            singleTransfer: pixLimits.singleTransfer,
            daytime: pixLimits.daytime,
            nighttime: pixLimits.nighttime,
            monthly: pixLimits.monthly,
            serviceId: pixLimits.serviceId,
          },
        };

        const brxRes = await this.accreditationService.accreditPerson(
          dto as any,
        );

        this.logger.log(
          `[BRX][PF] Credenciado id=${brxRes.accreditationId} status=${brxRes.accreditationStatus}`,
        );
        console.log('[BRX][PF] Response:', JSON.stringify(brxRes, null, 2));

        if (!created.externalAccredId || !created.externalClientId) {
          await this.prisma.customer.update({
            where: { id: created.id },
            data: {
              externalAccredId: brxRes.accreditationId,
              externalClientId: brxRes.clientId,
            },
          });
        }
      } catch (e: any) {
        this.logger.error(
          `[BRX][PF] Falha ao credenciar cpf=${cpf}: ${e?.message || e}`,
        );
        console.error('[BRX][PF] Error:', e?.response?.data || e?.message || e);
      }
    }

    return created;
  }

  async createPJ(input: CreateCompanyDto) {
    const { identifier, productId, company, pixLimits } = input;
    const cnpj = onlyDigits(company.cnpj);

    return this.prisma.customer.create({
      data: {
        type: 'PJ',
        accountStatus: 'not_requested',
        identifier,
        productId,
        email: company.email,
        phone: company.phone,
        legalName: company.legalName,
        tradeName: company.tradeName,
        cnpj,
        address: {
          create: {
            zipCode: company.address.zipCode,
            street: company.address.street,
            number: company.address.number ?? null,
            complement: company.address.complement ?? null,
            neighborhood: company.address.neighborhood,
            cityIbgeCode: company.address.cityIbgeCode,
          },
        },
        pixLimits: {
          create: {
            singleTransfer: pixLimits.singleTransfer,
            daytime: pixLimits.daytime,
            nighttime: pixLimits.nighttime,
            monthly: pixLimits.monthly,
            serviceId: pixLimits.serviceId,
          },
        },
        ownerships: {
          create: company.ownershipStructure.map((o) => ({
            name: o.name,
            cpf: onlyDigits(o.cpf),
            birthday: new Date(o.birthday),
            isAdministrator: o.isAdministrator,
          })),
        },
      },
      include: { address: true, pixLimits: true, ownerships: true },
    });
  }

  /* -------------------- LIST -------------------- */

  async list(query: ListCustomersDto, user?: AuthUser) {
    const where: any = {};

    // Auto-scope: CUSTOMER vê só seus customers
    if (user?.role !== Role.ADMIN && user?.sub) {
      where.userId = user.sub;
    }

    if (query.accountStatus) {
      where.accountStatus = query.accountStatus;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.hasAccreditation !== undefined) {
      where.externalAccredId = query.hasAccreditation ? { not: null } : null;
    }

    const customers = await this.prisma.customer.findMany({
      where,
      take: query.limit ?? 50,
      skip: query.page ? (query.page - 1) * (query.limit ?? 50) : 0,
      orderBy: { createdAt: 'desc' },
      include: {
        address: true,
        pixLimits: true,
        ownerships: query.type === CustomerTypeDto.PJ,
      },
    });

    const total = await this.prisma.customer.count({ where });

    return {
      data: customers,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    };
  }

  /* -------------------- STATS (Admin) -------------------- */

  async getStats() {
    const [total, byStatus, byType] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.groupBy({
        by: ['accountStatus'],
        _count: true,
      }),
      this.prisma.customer.groupBy({
        by: ['type'],
        _count: true,
      }),
    ]);

    const statusMap = byStatus.reduce(
      (acc, item) => {
        acc[item.accountStatus] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const typeMap = byType.reduce(
      (acc, item) => {
        acc[item.type] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      byStatus: statusMap,
      byType: typeMap,
    };
  }

  /* -------------------- FIND -------------------- */

  async findById(id: string, user?: AuthUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { address: true, pixLimits: true, ownerships: true },
    });

    if (!customer) return null;

    // Validar ownership
    if (user && user.role !== Role.ADMIN && customer.userId !== user.sub) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso.',
      );
    }

    return customer;
  }

  async findByUserId(userId: string) {
    return this.prisma.customer.findFirst({
      where: { userId },
      include: { address: true, pixLimits: true, ownerships: true },
    });
  }

  async resolveCustomerId(taxId: string): Promise<string | null> {
    const digits = onlyDigits(taxId);
    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [{ cpf: digits }, { cnpj: digits }],
      },
    });
    return customer?.id ?? null;
  }

  /* -------------------- UPDATE -------------------- */

  async update(id: string, dto: UpdateCustomerDto, user?: AuthUser) {
    // Validar ownership
    const customer = await this.findById(id, user);
    if (!customer) {
      throw new BadRequestException('Customer não encontrado.');
    }

    // Preparar dados para o Prisma
    const data: any = {};

    // Campos simples
    if (dto.accountStatus) data.accountStatus = dto.accountStatus;
    if (dto.type) data.type = dto.type;
    if (dto.name) data.name = dto.name;
    if (dto.socialName !== undefined) data.socialName = dto.socialName;
    if (dto.email) data.email = dto.email;
    if (dto.phone) data.phone = dto.phone;
    if (dto.cpf) data.cpf = onlyDigits(dto.cpf);
    if (dto.cnpj) data.cnpj = onlyDigits(dto.cnpj);
    if (dto.birthday) data.birthday = new Date(dto.birthday);
    if (dto.genderId !== undefined) data.genderId = dto.genderId;
    if (dto.legalName) data.legalName = dto.legalName;
    if (dto.tradeName) data.tradeName = dto.tradeName;

    // Atualizar Address (relacionamento)
    if (dto.address) {
      data.address = {
        update: {
          zipCode: dto.address.zipCode,
          street: dto.address.street,
          number: dto.address.number ?? null,
          complement: dto.address.complement ?? null,
          neighborhood: dto.address.neighborhood,
          cityIbgeCode: dto.address.cityIbgeCode,
        },
      };
    }

    // Atualizar PixLimits (relacionamento)
    if (dto.pixLimits) {
      data.pixLimits = {
        update: {
          singleTransfer: dto.pixLimits.singleTransfer,
          daytime: dto.pixLimits.daytime,
          nighttime: dto.pixLimits.nighttime,
          monthly: dto.pixLimits.monthly,
          serviceId: dto.pixLimits.serviceId,
        },
      };
    }

    return this.prisma.customer.update({
      where: { id },
      data,
      include: { address: true, pixLimits: true, ownerships: true },
    });
  }

  async updateStatus(id: string, status: AccountStatusDto) {
    return this.prisma.customer.update({
      where: { id },
      data: { accountStatus: status },
    });
  }

  async submitKycByUser(userId: string) {
    const customer = await this.findByUserId(userId);
    if (!customer) {
      throw new BadRequestException('Você ainda não possui cadastro.');
    }
    return this.updateStatus(customer.id, AccountStatusDto.requested);
  }

  /* -------------------- DELETE -------------------- */

  async remove(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }
}
