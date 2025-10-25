import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

// src/auth/auth.service.ts
type JwtPayload = { sub: string; email: string; role: string };

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService, private jwt: JwtService) { }

    async validateUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('invalid_credentials');
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new UnauthorizedException('invalid_credentials');
        return user;
    }


    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: String(user.role), // <- evita conflito com $Enums.Role
        };
        const token = await this.jwt.signAsync(payload); // <- sem options aqui
        return { access_token: token, role: payload.role };
    }

}
