import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { SendEmailDto } from './dto/send-email.dto';
import { AdminChangePasswordDto, AdminChangePasswordByEmailDto } from './dto/admin-change-password.dto';
import { AdminUsersService } from './admin-users.service';
import { KycLimitsService } from '../customers/kyc-limits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, KycLevel } from '@prisma/client';

@ApiTags('Admin Users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(
    private readonly service: AdminUsersService,
    private readonly kycLimits: KycLimitsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuários com paginação e filtros' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'kycStatus', required: false, type: String })
  @ApiQuery({ name: 'accountStatus', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Lista de usuários' })
  async listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('kycStatus') kycStatus?: string,
    @Query('accountStatus') accountStatus?: string,
  ) {
    return this.service.listUsers({ page, limit, search, kycStatus, accountStatus });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do usuário' })
  @ApiResponse({ status: 200, description: 'Detalhes completos do usuário' })
  async getUserDetails(@Param('id') id: string) {
    return this.service.getUserDetails(id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Transações do usuário' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de transações' })
  async getUserTransactions(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.service.getUserTransactions(id, limit);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Deletar todos os customers, accounts e wallets' })
  @ApiResponse({ status: 200, description: 'Todos os usuários deletados' })
  async deleteAllUsers() {
    return this.service.deleteAllUsers();
  }

  @Post('delete-batch')
  @ApiOperation({ summary: 'Deletar múltiplos usuários por IDs' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] } })
  @ApiResponse({ status: 200, description: 'Usuários deletados' })
  async deleteUsers(@Body('ids') ids: string[]) {
    return this.service.deleteUsers(ids);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletar usuário e todos os dados relacionados' })
  @ApiResponse({ status: 200, description: 'Usuário deletado' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async deleteUser(@Param('id') id: string) {
    return this.service.deleteUser(id);
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Bloquear usuário' })
  @ApiResponse({ status: 200, description: 'Usuário bloqueado' })
  async blockUser(@Param('id') id: string) {
    return this.service.blockUser(id);
  }

  @Post(':id/unblock')
  @ApiOperation({ summary: 'Desbloquear usuário' })
  @ApiResponse({ status: 200, description: 'Usuário desbloqueado' })
  async unblockUser(@Param('id') id: string) {
    return this.service.unblockUser(id);
  }

  @Post(':id/send-email')
  @ApiOperation({ summary: 'Enviar email para usuário' })
  @ApiBody({ type: SendEmailDto })
  @ApiResponse({ status: 200, description: 'Email enviado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async sendEmail(
    @Param('id') id: string,
    @Body() dto: SendEmailDto,
  ) {
    return this.service.sendEmail(id, dto.subject, dto.message, dto.template);
  }

  @Post(':id/change-password')
  @ApiOperation({ summary: 'Alterar senha do usuário (por customer ID)' })
  @ApiBody({ type: AdminChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async changePassword(
    @Param('id') id: string,
    @Body() dto: AdminChangePasswordDto,
  ) {
    return this.service.changePasswordByCustomerId(id, dto.newPassword);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Redefinir senha do usuário (por customer ID)' })
  @ApiBody({ type: AdminChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: AdminChangePasswordDto,
  ) {
    return this.service.changePasswordByCustomerId(id, dto.newPassword);
  }

  @Post('change-password-by-email')
  @ApiOperation({ summary: 'Alterar senha do usuário (por email)' })
  @ApiBody({ type: AdminChangePasswordByEmailDto })
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  async changePasswordByEmail(
    @Body() dto: AdminChangePasswordByEmailDto,
  ) {
    return this.service.changePasswordByEmail(dto.email, dto.newPassword);
  }

  @Patch(':id/spread')
  @ApiOperation({ summary: 'Ajustar spread do usuário' })
  @ApiBody({ schema: { type: 'object', properties: { spreadPercent: { type: 'number', description: 'Spread em percentual (ex: 0.95 para 0.95%)' } } } })
  @ApiResponse({ status: 200, description: 'Spread atualizado' })
  async updateSpread(
    @Param('id') id: string,
    @Body('spreadPercent') spreadPercent: number,
  ) {
    return this.service.updateSpread(id, spreadPercent);
  }

  @Patch(':id/kyc-level')
  @ApiOperation({ summary: 'Alterar nível KYC do cliente' })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        kycLevel: { 
          type: 'string', 
          enum: ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'],
          description: 'Nível KYC (LEVEL_1: básico, LEVEL_2: intermediário, LEVEL_3: ilimitado)' 
        } 
      } 
    } 
  })
  @ApiResponse({ status: 200, description: 'Nível KYC atualizado' })
  async updateKycLevel(
    @Param('id') id: string,
    @Body('kycLevel') kycLevel: KycLevel,
  ) {
    await this.kycLimits.upgradeKycLevel(id, kycLevel);
    return { message: `Nível KYC atualizado para ${kycLevel}`, customerId: id, kycLevel };
  }

  @Get('kyc-levels/config')
  @ApiOperation({ summary: 'Listar configurações de limites por nível KYC' })
  @ApiResponse({ status: 200, description: 'Configurações de limites' })
  async getKycLevelConfigs() {
    return this.kycLimits.getAllConfigs();
  }

  @Get(':id/limits')
  @ApiOperation({ summary: 'Ver limites e uso mensal do cliente' })
  @ApiResponse({ status: 200, description: 'Limites e uso do cliente' })
  async getCustomerLimits(@Param('id') id: string) {
    return this.kycLimits.getMonthlyUsage(id);
  }
}
