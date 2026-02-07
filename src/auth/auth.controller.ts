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
import { TwoFactorCodeDto } from './dto/two-factor.dto';
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
    return this.authService.login(body.email, body.password, body.twoFactorCode);
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

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Gerar segredo 2FA e QR Code' })
  @ApiResponse({ status: 200, description: 'QR Code e segredo gerados' })
  @ApiResponse({ status: 400, description: '2FA já está ativado' })
  async setup2FA(@Req() req: any) {
    return this.authService.setup2FA(req.user.sub);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar código e ativar 2FA' })
  @ApiResponse({ status: 200, description: '2FA ativado com sucesso' })
  @ApiResponse({ status: 400, description: 'Código inválido' })
  async verify2FA(@Req() req: any, @Body() body: TwoFactorCodeDto) {
    return this.authService.verify2FA(req.user.sub, body.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativar 2FA' })
  @ApiResponse({ status: 200, description: '2FA desativado com sucesso' })
  @ApiResponse({ status: 400, description: 'Código inválido ou 2FA não está ativo' })
  async disable2FA(@Req() req: any, @Body() body: TwoFactorCodeDto) {
    return this.authService.disable2FA(req.user.sub, body.code);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout — revoga o refresh token' })
  @ApiResponse({ status: 200, description: 'Logout realizado com sucesso' })
  async logout(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      return { success: true, data: { message: 'No token provided' } };
    }
    return this.authService.logout(refreshToken);
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiResponse({ status: 200, description: 'Token renovado com sucesso' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido ou expirado' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }
}
