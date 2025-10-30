import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async createByAdmin(dto: { email: string; password: string; name?: string; role?: Role; isActive?: boolean; }) {
        const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (exists) throw new BadRequestException('email_in_use');
        const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash: hash,
                name: dto.name,
                role: dto.role ?? Role.CUSTOMER,
                isActive: dto.isActive ?? true,
            },
            select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
        });
        return user;
    }

    async list(take = 50, skip = 0) {
        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                take, skip, orderBy: { createdAt: 'desc' },
                select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
            }),
            this.prisma.user.count(),
        ]);
        return { total, items };
    }

    async updateByAdmin(id: string, dto: { name?: string; role?: Role; isActive?: boolean }) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('user_not_found');
        const updated = await this.prisma.user.update({
            where: { id },
            data: { name: dto.name, role: dto.role, isActive: dto.isActive },
            select: { id: true, email: true, name: true, role: true, isActive: true, updatedAt: true },
        });
        return updated;
    }

    async changePassword(requestUser: { userId: string; role: Role }, id: string, currentPassword: string, newPassword: string) {
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
        await this.prisma.user.update({ where: { id }, data: { passwordHash: hash } });
        return { ok: true };
    }
}
