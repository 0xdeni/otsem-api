import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AffiliatesService } from './affiliates.service';

@ApiTags('Admin - Affiliates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/affiliates')
export class AffiliatesController {
  constructor(private affiliatesService: AffiliatesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo afiliado' })
  async create(@Body() body: {
    name: string;
    email: string;
    phone?: string;
    code: string;
    spreadRate: number;
    payoutWalletAddress?: string;
    payoutWalletNetwork?: string;
  }) {
    return this.affiliatesService.createAffiliate(body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar afiliados' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.affiliatesService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar afiliado por ID' })
  async findById(@Param('id') id: string) {
    return this.affiliatesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar afiliado' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      email?: string;
      phone?: string;
      spreadRate?: number;
      payoutWalletAddress?: string;
      payoutWalletNetwork?: string;
      isActive?: boolean;
    },
  ) {
    return this.affiliatesService.updateAffiliate(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletar afiliado (desvincula clientes e remove comissões)' })
  async delete(@Param('id') id: string) {
    return this.affiliatesService.deleteAffiliate(id);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({ summary: 'Ativar/desativar afiliado' })
  async toggleActive(@Param('id') id: string) {
    return this.affiliatesService.toggleActive(id);
  }

  @Get(':id/commissions')
  @ApiOperation({ summary: 'Listar comissões do afiliado' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getCommissions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.affiliatesService.getCommissions(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post(':id/pay-commissions')
  @ApiOperation({ summary: 'Marcar comissões como pagas' })
  async payCommissions(
    @Param('id') id: string,
    @Body() body: { commissionIds: string[] },
  ) {
    return this.affiliatesService.markCommissionsAsPaid(id, body.commissionIds);
  }
}

@ApiTags('Affiliates')
@Controller('affiliates')
export class PublicAffiliatesController {
  constructor(private affiliatesService: AffiliatesService) {}

  @Get('validate/:code')
  @ApiOperation({ summary: 'Validar código de afiliado (disabled — only default 0X affiliate is active)' })
  async validateCode(@Param('code') code: string) {
    // All referral codes are disabled except the default 0X
    return { valid: false, message: 'Referral codes are currently disabled' };
  }
}
