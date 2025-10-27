import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from '../users/dto/register.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) { }

    @Post('login')
    async login(@Body() body: { email: string; password: string }) {
        return this.auth.login(body.email, body.password);
    }
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.auth.register(dto);
    }
}
