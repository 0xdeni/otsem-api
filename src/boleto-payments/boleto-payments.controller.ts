import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthRequest } from '../auth/jwt-payload.type';
import { BoletoPaymentsService } from './boleto-payments.service';
import { CreateBoletoPaymentDto } from './dto/create-boleto-payment.dto';

@ApiTags('Boleto Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boleto-payments')
export class BoletoPaymentsController {
  constructor(private readonly boletoService: BoletoPaymentsService) {}

  private getCustomerId(req: AuthRequest): string {
    const customerId = req.user?.customerId;
    if (!customerId) {
      throw new BadRequestException('customerId não encontrado no token');
    }
    return customerId;
  }

  @Get('quote')
  @ApiOperation({
    summary: 'Cotação: quanto crypto é necessário para pagar um boleto',
  })
  @ApiQuery({
    name: 'boletoAmount',
    type: Number,
    required: true,
    description: 'Valor do boleto em BRL',
  })
  @ApiQuery({
    name: 'cryptoCurrency',
    enum: ['USDT', 'SOL', 'TRX'],
    required: true,
    description: 'Moeda crypto para pagamento',
  })
  @ApiResponse({ status: 200, description: 'Cotação do pagamento' })
  async getQuote(
    @Query('boletoAmount') boletoAmount: string,
    @Query('cryptoCurrency') cryptoCurrency: string,
  ) {
    const amount = Number(boletoAmount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('boletoAmount deve ser um número positivo');
    }
    return this.boletoService.getQuote(amount, cryptoCurrency);
  }

  @Post()
  @ApiOperation({
    summary: 'Criar pagamento de boleto com crypto',
  })
  @ApiResponse({ status: 201, description: 'Pagamento criado com sucesso' })
  async createBoletoPayment(
    @Req() req: AuthRequest,
    @Body() dto: CreateBoletoPaymentDto,
  ) {
    const customerId = this.getCustomerId(req);
    return this.boletoService.createBoletoPayment(
      customerId,
      dto.barcode,
      dto.boletoAmount,
      dto.walletId,
      dto.cryptoCurrency,
      dto.description,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar meus pagamentos de boleto' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'PENDING_APPROVAL',
      'ADMIN_PAYING',
      'PAID',
      'FAILED',
      'REFUNDED',
      'CANCELLED',
    ],
  })
  @ApiResponse({ status: 200, description: 'Lista de pagamentos' })
  async listMyBoletoPayments(
    @Req() req: AuthRequest,
    @Query('status') status?: string,
  ) {
    const customerId = this.getCustomerId(req);
    return this.boletoService.getCustomerBoletoPayments(customerId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um pagamento de boleto' })
  @ApiResponse({ status: 200, description: 'Detalhe do pagamento' })
  async getBoletoPayment(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    const customerId = this.getCustomerId(req);
    return this.boletoService.getBoletoPaymentById(id, customerId);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar pagamento de boleto (apenas se pendente)',
  })
  @ApiResponse({ status: 200, description: 'Pagamento cancelado' })
  async cancelBoletoPayment(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    const customerId = this.getCustomerId(req);
    return this.boletoService.cancelBoletoPayment(id, customerId);
  }
}
