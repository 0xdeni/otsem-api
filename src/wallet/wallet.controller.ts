import { Controller, Get, Query, Post, Body, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // ajuste o caminho conforme seu projeto

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @Post('create-solana')
    async createSolanaWalletForCustomer(@Req() req: Request) {
        const customerId = (req.user as any).customerId;
        return await this.walletService.createSolanaWalletForCustomer(customerId);
    }

    @Get('solana-usdt-balance')
    async getSolanaUsdtBalance(@Query('address') address: string, @Req() req: Request) {
        const customerId = (req.user as any).customerId;
        return await this.walletService.getSolanaUsdtBalance(address, customerId);
    }

    @Get('usdt')
    async getAllUsdtWalletsForCustomer(@Req() req: Request) {
        const customerId = (req.user as any).customerId;
        return await this.walletService.getAllUsdtWalletsForCustomer(customerId);
    }

    @Post('buy-usdt-with-brl')
    async buyUsdtWithBrl(
        @Body('brlAmount') brlAmount: number,
        @Req() req: any
    ) {
        const customerId = req.user.customerId;
        return this.walletService.buyUsdtWithBrl(customerId, brlAmount);
    }
}