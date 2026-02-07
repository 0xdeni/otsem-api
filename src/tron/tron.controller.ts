import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TronService } from './tron.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Tron')
@ApiBearerAuth()
@Controller('tron')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TronController {
    constructor(private readonly tronService: TronService) {}

    @Get('hot-wallet')
    @ApiOperation({ summary: 'Endereço e saldos da hot wallet Tron' })
    async getHotWalletInfo() {
        const address = this.tronService.getHotWalletAddress();
        const [usdtBalance, trxBalance] = await Promise.all([
            this.tronService.getHotWalletUsdtBalance(),
            this.tronService.getHotWalletTrxBalance()
        ]);

        return {
            address,
            usdtBalance,
            trxBalance,
            network: 'TRC20'
        };
    }

    @Get('balance')
    @ApiOperation({ summary: 'Saldo USDT de uma carteira Tron' })
    async getBalance(@Query('address') address: string) {
        const usdt = await this.tronService.getUsdtBalance(address);
        const trx = await this.tronService.getTrxBalance(address);
        return { address, usdtBalance: usdt, trxBalance: trx };
    }

    @Post('create-wallet')
    @ApiOperation({ summary: 'Criar nova carteira Tron' })
    async createWallet() {
        return await this.tronService.createWallet();
    }

    @Post('send-usdt')
    @ApiOperation({ summary: 'Enviar USDT da hot wallet para endereço' })
    async sendUsdt(@Body() body: { toAddress: string; amount: number }) {
        return await this.tronService.sendUsdt(body.toAddress, body.amount);
    }

    @Get('validate-address')
    @ApiOperation({ summary: 'Validar endereço Tron' })
    async validateAddress(@Query('address') address: string) {
        return { 
            address, 
            valid: this.tronService.isValidAddress(address) 
        };
    }
}
