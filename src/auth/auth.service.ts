import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

const SALT_ROUNDS = 10;
type JwtPayload = { sub: string; email: string; role: Role };

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService, private jwt: JwtService) { }

    async validateUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('invalid_credentials');
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) throw new UnauthorizedException('invalid_credentials');
        return user;
    }

    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);
        const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
        const access_token = await this.jwt.signAsync(payload);
        return { access_token, role: user.role };
    }

    async register(dto: { email: string; password: string; name?: string }) {
        const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (exists) throw new BadRequestException('email_in_use');

        const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
        const user = await this.prisma.user.create({
            data: { email: dto.email, password: hash, name: dto.name, role: Role.CUSTOMER },
            select: { id: true, email: true, role: true },
        });

        const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
        const access_token = await this.jwt.signAsync(payload);
        return { access_token, role: user.role };
    }
}
