import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  ForbiddenException,
  UseGuards,
  Request,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { AccountSummaryDto } from './dto/account-summary.dto';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get(':customerId/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER, Role.ADMIN)
  @ApiBearerAuth()
  async getAccountSummary(
    @Param('customerId') customerId: string,
    @Req() req: { user: { sub: string; role: string; customerId?: string } },
  ): Promise<AccountSummaryDto> {
    // IDOR protection: customers can only access their own account
    if (req.user.role !== 'ADMIN' && req.user.customerId !== customerId) {
      throw new ForbiddenException('Acesso negado');
    }
    const summary = await this.accountsService.getAccountSummary(customerId);
    if (!summary) {
      throw new NotFoundException('Account not found');
    }
    return summary;
  }

  @Post(':customerId/balance-adjustment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ajuste manual de saldo (admin)' })
  @ApiResponse({ status: 200, description: 'Ajuste realizado com sucesso' })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos ou saldo insuficiente',
  })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async adjustBalance(
    @Param('customerId') customerId: string,
    @Body() dto: AdjustBalanceDto,
    @Request() req: { user: { sub: string } },
  ) {
    const adminId = req.user.sub;
    return this.accountsService.adjustBalance(customerId, dto, adminId);
  }
}
