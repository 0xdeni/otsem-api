import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from '../users/dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MeDto } from './dto/me.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 login attempts per minute
  @ApiOperation({ summary: 'Login de usuário' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente mais tarde.' })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 registrations per minute per IP
  @ApiOperation({ summary: 'Registrar novo usuário' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente mais tarde.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /api/auth/forgot
  @Post('forgot')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 reset requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar redefinição de senha' })
  @ApiResponse({ status: 200, description: 'E-mail de recuperação enviado' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente mais tarde.' })
  async forgot(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  // POST /api/auth/reset
  @Post('reset')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 reset attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com token' })
  @ApiResponse({ status: 200, description: 'Senha redefinida com sucesso' })
  @ApiResponse({ status: 429, description: 'Muitas tentativas. Tente novamente mais tarde.' })
  async reset(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obter dados completos do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Dados completos do usuário' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async me(@Req() req: any) {
    const u = req.user;
    return this.authService.getAccountDetails(u.sub);
  }
}
