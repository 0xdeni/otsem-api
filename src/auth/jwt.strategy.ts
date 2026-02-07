// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token inválido');
    }

    // Check if user exists and token was issued before password change
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, passwordChangedAt: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // Invalidate tokens issued before password change
    if (user.passwordChangedAt && payload.iat) {
      const passwordChangedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (payload.iat < passwordChangedTimestamp) {
        throw new UnauthorizedException('Token invalidado — senha alterada');
      }
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      customerId: payload.customerId,
    };
  }
}
