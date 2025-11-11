// src/users/users.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role, AccountStatus } from '@prisma/client';
import type { CreateUserWithCustomerDto } from './dto/create-user-with-customer.dto';

const SALT_ROUNDS = 10;

function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '');
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createByAdminWithCustomer(dto: CreateUserWithCustomerDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (exists) {
      throw new BadRequestException(
        'Este e-mail já está em uso. Por favor, utilize outro endereço.',
      );
    }

    const identifier = dto.customer.identifier?.trim() || 'app';
    const productId = dto.customer.productId ?? 1;

    const rawPhone = dto.customer.phone?.trim() ?? '';
    const phone = onlyDigits(rawPhone);
    if (!phone) {
      throw new BadRequestException(
        'Telefone é obrigatório para criar o cadastro do cliente.',
      );
    }

    const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            passwordHash: hash,
            name: dto.name?.trim() || null,
            role: dto.role ?? Role.CUSTOMER,
            isActive: dto.isActive ?? true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });

        const customer = await tx.customer.create({
          data: {
            type: dto.customer.type,
            accountStatus: AccountStatus.not_requested,
            userId: user.id,
            externalClientId: null,
            externalAccredId: null,
            identifier,
            productId,
            email: user.email,
            phone,
            name: dto.name,
            socialName: null,
            cpf: null,
            birthday: null,
            genderId: null,
            legalName: null,
            tradeName: null,
            cnpj: null,
          },
          select: {
            id: true,
            type: true,
            accountStatus: true,
            identifier: true,
            productId: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        });

        return { user, customer };
      });

      return { ...result, message: 'Usuário e cliente criados com sucesso.' };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // unique constraint (email, etc.)
        throw new BadRequestException(
          'Este e-mail já está em uso. Por favor, utilize outro endereço.',
        );
      }
      throw e;
    }
  }

  // async createByAdmin(dto: {
  //     email: string;
  //     password: string;
  //     name?: string;
  //     role?: Role;
  //     isActive?: boolean;
  //     phone: string;
  //     type: CustomerType;
  // }) {
  //     return this.createByAdminWithCustomer({
  //         email: dto.email,
  //         password: dto.password,
  //         name: dto.name,
  //         role: dto.role,
  //         isActive: dto.isActive,
  //         customer: {
  //             phone: dto.phone,
  //             type: dto.type,
  //             identifier: 'admin',
  //             productId: 1,
  //         },
  //     });
  // }

  async list(take = 50, skip = 0) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          // ajuste o nome do campo conforme seu Prisma: `customers` ou `Customer`
          customers: {
            select: {
              id: true,
              type: true,
              accountStatus: true,
              phone: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    return { total, items };
  }

  async updateByAdmin(
    id: string,
    dto: { name?: string; role?: Role; isActive?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('user_not_found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, role: dto.role, isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
    return updated;
  }

  async changePassword(
    requestUser: { userId: string; role: Role },
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (requestUser.role !== Role.ADMIN && requestUser.userId !== id) {
      throw new ForbiddenException('not_allowed');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('user_not_found');

    if (requestUser.role !== Role.ADMIN) {
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) throw new BadRequestException('current_password_invalid');
    }
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });
    return { ok: true };
  }
}
