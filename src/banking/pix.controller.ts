import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    Request,
    Query,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { BankingGatewayService } from './banking-gateway.service';
import { SendPixDto, PixPaymentResponseDto } from '../inter/dto/send-pix.dto';
import { CreatePixChargeDto } from '../inter/dto/create-pix-charge.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('PIX (Generic)')
@ApiBearerAuth()
@Controller('pix')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PixController {
    constructor(
        private readonly bankingGateway: BankingGatewayService,
    ) {}

    @Post('send-pix')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Enviar Pix via banco ativo' })
    @ApiResponse({ status: 201, type: PixPaymentResponseDto })
    @ApiResponse({ status: 400, description: 'Saldo insuficiente ou dados invalidos' })
    async sendPix(@Request() req: any, @Body() dto: SendPixDto) {
        const customerId = req.user?.customerId;
        return this.bankingGateway.sendPix(customerId, dto);
    }

    @Get('status/:endToEndId')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Consultar status de Pix enviado' })
    async getPixStatus(@Param('endToEndId') endToEndId: string) {
        return this.bankingGateway.getPixStatus(endToEndId);
    }

    @Post('cobrancas')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Criar cobranca Pix (QR Code) para deposito' })
    @ApiResponse({ status: 201, description: 'Cobranca criada com sucesso' })
    async createCobranca(@Request() req: any, @Body() dto: CreatePixChargeDto) {
        const customerId = dto.customerId || req.user?.customerId;
        return this.bankingGateway.createCobranca(dto, customerId);
    }

    @Get('cobrancas/:txid')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Consultar cobranca Pix' })
    async getCobranca(@Param('txid') txid: string) {
        return this.bankingGateway.getCobranca(txid);
    }

    @Post('validar-chave/:pixKeyId')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Validar chave PIX via micro-transferencia (R$ 0,01)' })
    @ApiResponse({ status: 200, description: 'Resultado da validacao' })
    async validatePixKey(
        @Request() req: any,
        @Param('pixKeyId') pixKeyId: string,
    ) {
        const customerId = req.user?.customerId;
        return this.bankingGateway.validatePixKeyByMicroTransfer(customerId, pixKeyId);
    }

    @Get('cobrancas')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Listar cobrancas PIX dos ultimos N dias' })
    async listCobrancas(@Query('dias') dias?: string) {
        const numDias = dias ? parseInt(dias, 10) : 7;
        return this.bankingGateway.listCobrancas(numDias);
    }

    @Post('reconciliar')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Reconciliar cobrancas PIX pendentes' })
    async reconciliarCobrancas(@Query('dias') dias?: string) {
        const numDias = dias ? parseInt(dias, 10) : 7;
        return this.bankingGateway.reconciliarCobrancas(numDias);
    }
}
