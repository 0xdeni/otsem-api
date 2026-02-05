import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/jwt-payload.type';
import { BoletoPaymentsService } from './boleto-payments.service';
import { QueryBoletoPaymentsDto } from './dto/query-boleto-payments.dto';
import {
  AdminMarkBoletoAsPaidDto,
  AdminRejectBoletoDto,
} from './dto/admin-update-boleto.dto';

@ApiTags('Admin Boleto Payments')
@ApiBearerAuth()
@Controller('admin/boleto-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminBoletoPaymentsController {
  constructor(private readonly boletoService: BoletoPaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os pagamentos de boleto' })
  @ApiResponse({ status: 200, description: 'Lista paginada de pagamentos' })
  async list(@Query() query: QueryBoletoPaymentsDto) {
    return this.boletoService.adminListBoletoPayments(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de pagamentos de boleto' })
  @ApiResponse({ status: 200, description: 'Estatísticas agregadas' })
  async stats() {
    return this.boletoService.adminGetStats();
  }

  @Post(':id/processing')
  @ApiOperation({
    summary: 'Marcar boleto como em processamento (admin está pagando)',
  })
  @ApiResponse({ status: 200, description: 'Status atualizado' })
  async markAsProcessing(@Param('id') id: string) {
    return this.boletoService.adminMarkAsProcessing(id);
  }

  @Post(':id/paid')
  @ApiOperation({
    summary: 'Confirmar que o boleto foi pago pelo admin',
  })
  @ApiResponse({ status: 200, description: 'Boleto marcado como pago' })
  async markAsPaid(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: AdminMarkBoletoAsPaidDto,
  ) {
    const adminUserId = req.user?.sub || 'unknown';
    return this.boletoService.adminMarkAsPaid(id, adminUserId, dto.adminNotes);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: 'Rejeitar pagamento de boleto e devolver crypto ao cliente',
  })
  @ApiResponse({ status: 200, description: 'Boleto rejeitado, crypto devolvido' })
  async reject(
    @Param('id') id: string,
    @Body() dto: AdminRejectBoletoDto,
  ) {
    return this.boletoService.adminRejectBoletoPayment(id, dto.reason);
  }
}
