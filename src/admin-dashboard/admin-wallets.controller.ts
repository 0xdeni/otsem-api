import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminWalletsService } from './admin-wallets.service';

@ApiTags('Admin - Wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/wallets')
export class AdminWalletsController {
  constructor(private adminWalletsService: AdminWalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as carteiras com paginação' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listWallets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.adminWalletsService.listWallets(pageNum, limitNum);
  }

  @Patch(':walletId/okx-whitelist')
  @ApiOperation({ summary: 'Atualizar status de whitelist OKX' })
  async updateOkxWhitelist(
    @Param('walletId') walletId: string,
    @Body() body: { whitelisted: boolean },
  ) {
    return this.adminWalletsService.updateOkxWhitelist(walletId, body.whitelisted);
  }

  @Patch(':walletId/toggle-active')
  @ApiOperation({ summary: 'Ativar/Desativar carteira' })
  async toggleActive(@Param('walletId') walletId: string) {
    return this.adminWalletsService.toggleActive(walletId);
  }
}
