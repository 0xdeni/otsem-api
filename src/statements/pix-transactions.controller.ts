import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { StatementsService } from './statements.service';

@ApiTags('PIX Transactions')
@ApiBearerAuth()
@Controller('pix/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PixTransactionsController {
  constructor(private readonly service: StatementsService) {}

  @Get('account-holders/:accountHolderId')
  @Roles(Role.ADMIN, Role.CUSTOMER)
  @ApiOperation({ summary: 'Listar transações PIX (incoming and outgoing) por accountHolderId' })
  @ApiParam({ name: 'accountHolderId', description: 'ID do account holder' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número da página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limite por página (default: 20)' })
  async getPixTransactions(
    @Request() req: any,
    @Param('accountHolderId') accountHolderId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Validation is handled inside the service method
    return this.service.getPixTransactionsByAccountHolder(
      accountHolderId,
      page ?? 1,
      limit ?? 20,
    );
  }
}
