import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SolanaService } from './solana.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { SendSolDto } from './dto/send-sol.dto';

@ApiTags('Solana')
@ApiBearerAuth()
@Controller('solana')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SolanaController {
    constructor(private readonly solanaService: SolanaService) {}

    @Get('hot-wallet')
    @ApiOperation({ summary: 'Endereço e saldos da hot wallet Solana' })
    async getHotWalletInfo() {
        const address = this.solanaService.getHotWalletAddress();
        const [usdtBalance, solBalance] = await Promise.all([
            this.solanaService.getHotWalletUsdtBalance(),
            this.solanaService.getHotWalletSolBalance()
        ]);

        return {
            address,
            usdtBalance,
            solBalance,
            network: 'Solana'
        };
    }

    @Get('balance')
    @ApiOperation({ summary: 'Saldo USDT e SOL de uma carteira Solana' })
    async getBalance(@Query('address') address: string) {
        const usdt = await this.solanaService.getUsdtBalance(address);
        const sol = await this.solanaService.getSolBalance(address);
        return { address, usdtBalance: usdt, solBalance: sol };
    }

    @Post('send-sol')
    @ApiOperation({ summary: 'Enviar SOL da hot wallet para endereço' })
    async sendSol(@Body() body: SendSolDto) {
        return await this.solanaService.sendSol(body.toAddress, body.amount);
    }

    @Get('validate-address')
    @ApiOperation({ summary: 'Validar endereço Solana' })
    async validateAddress(@Query('address') address: string) {
        try {
            const isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
            return { address, valid: isValid };
        } catch {
            return { address, valid: false };
        }
    }
}
