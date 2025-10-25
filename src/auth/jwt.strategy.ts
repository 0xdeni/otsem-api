import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET!,
            ignoreExpiration: false,
        });
    }
    async validate(payload: any) {
        // payload que assinamos no login: { sub, email, role }
        return { userId: payload.sub, email: payload.email, role: payload.role };
    }
}
