import { Controller, Get, Post, Body, Query, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { OkxService } from './services/okx.service';
import { OkxSpotService } from './services/okx-spot.service';
import { SPOT_PAIRS, type SpotPair } from './spot.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/jwt-payload.type';

const SPOT_PAIR_SET = new Set(SPOT_PAIRS);

@ApiTags('OKX')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('okx')
export class OkxController {
    constructor(
        private readonly okxService: OkxService,
        private readonly okxSpotService: OkxSpotService,
    ) { }

    private normalizePairs(instIds?: string): SpotPair[] {
        if (!instIds) return [...SPOT_PAIRS];
        const list = instIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean) as SpotPair[];
        if (list.length === 0) return [...SPOT_PAIRS];
        return list;
    }

    private assertPairs(instIds: string[]) {
        const invalid = instIds.filter((id) => !SPOT_PAIR_SET.has(id as SpotPair));
        if (invalid.length > 0) {
            throw new BadRequestException(`Par não suportado: ${invalid.join(', ')}`);
        }
    }

    @Get('balance-brl')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Saldo BRL na OKX' })
    async getBrlBalance() {
        return await this.okxService.getBrlBalance();
    }

    @Get('balance-usdt')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Saldo USDT na OKX' })
    async getUsdtBalance() {
        return await this.okxService.getUsdtBalance();
    }

    @Post('buy-and-check-history')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Comprar USDT com BRL e retornar detalhes' })
    async buyAndCheckHistory(@Body('brlAmount') brlAmount: number) {
        return await this.okxService.buyAndCheckHistory(brlAmount);
    }

    @Post('withdraw-usdt')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Sacar USDT para endereço externo (completo)' })
    async safeWithdrawUsdt(@Body() body: {
        amount: string | number;
        toAddress: string;
        fundPwd: string;
        fee: string | number;
        network?: string;
    }) {
        return await this.okxService.withdrawUsdt({
            currency: 'USDT',
            amount: body.amount,
            toAddress: body.toAddress,
            network: body.network || 'Solana',
            fundPwd: body.fundPwd,
            fee: body.fee
        });
    }

    @Post('withdraw-simple')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Sacar USDT (simplificado - taxa automática)' })
    async withdrawSimple(@Body() body: {
        amount: string | number;
        address: string;
        network?: 'Solana' | 'TRC20';
    }) {
        const network = body.network || 'TRC20';
        const fee = network === 'TRC20' ? '2.1' : '1';
        return await this.okxService.withdrawUsdtSimple(
            String(body.amount),
            body.address,
            network,
            fee
        );
    }

    @Get('deposit-address')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Endereço de depósito USDT (Solana ou Tron)' })
    @ApiQuery({ name: 'network', enum: ['Solana', 'TRC20'], required: true })
    async getDepositAddress(@Query('network') network: 'Solana' | 'TRC20') {
        return await this.okxService.getDepositAddress(network);
    }

    @Get('deposits')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Lista depósitos recentes de USDT' })
    async getRecentDeposits() {
        return await this.okxService.getRecentDeposits();
    }

    @Get('withdrawals')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Lista saques recentes de USDT' })
    async getRecentWithdrawals() {
        return await this.okxService.getRecentWithdrawals();
    }

    @Get('trades')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Histórico de trades (compras/vendas)' })
    async getTradeHistory() {
        return await this.okxService.getTradeHistory();
    }

    @Post('transfer-to-funding')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Transferir USDT de trading para funding' })
    async transferToFunding(@Body('amount') amount: string) {
        return await this.okxService.transferFromTradingToFunding('USDT', amount);
    }

    @Get('funding-balance')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Saldo USDT na conta funding (para saque)' })
    async getFundingBalance() {
        return await this.okxService.getFundingBalance('USDT');
    }

    @Post('withdraw-crypto')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Sacar qualquer crypto (SOL, TRX, etc) para endereço externo' })
    async withdrawCrypto(@Body() body: {
        currency: string;
        amount: string;
        toAddress: string;
        chain: string;
        fee?: string;
    }) {
        const fee = body.fee || await this.okxService.getWithdrawalFee(body.currency, body.chain);
        return await this.okxService.withdrawCrypto({
            currency: body.currency,
            amount: body.amount,
            toAddress: body.toAddress,
            chain: body.chain,
            fee: fee
        });
    }

    @Get('withdrawal-fee')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Taxa mínima de saque para uma crypto/chain' })
    @ApiQuery({ name: 'currency', type: String, required: true })
    @ApiQuery({ name: 'chain', type: String, required: true })
    async getWithdrawalFee(
        @Query('currency') currency: string,
        @Query('chain') chain: string
    ) {
        const fee = await this.okxService.getWithdrawalFee(currency, chain);
        return { currency, chain, minFee: fee };
    }

    @Post('buy-crypto')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Comprar crypto (SOL, TRX, etc) com USDT' })
    async buyCrypto(@Body() body: { crypto: string; usdtAmount: number }) {
        return await this.okxService.buyCryptoWithUsdt(body.crypto, body.usdtAmount);
    }

    @Get('crypto-balance')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Saldo de qualquer crypto na conta trading' })
    @ApiQuery({ name: 'currency', type: String, required: true })
    async getCryptoBalance(@Query('currency') currency: string) {
        const balance = await this.okxService.getCryptoBalance(currency);
        return { currency, balance };
    }

    @Get('all-balances')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Todos os saldos (trading + funding)' })
    async getAllBalances() {
        const [trading, funding] = await Promise.all([
            this.okxService.getAllTradingBalances(),
            this.okxService.getAllFundingBalances()
        ]);
        return { trading, funding };
    }

    @Post('transfer-crypto-to-funding')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Transferir crypto de trading para funding (para saque)' })
    async transferCryptoToFunding(@Body() body: { currency: string; amount: string }) {
        return await this.okxService.transferCryptoToFunding(body.currency, body.amount);
    }

    @Get('spot/pairs')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Pares spot suportados para o PRO' })
    async getSpotPairs() {
        return { pairs: SPOT_PAIRS };
    }

    @Get('spot/instruments')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Instrumentos spot (OKX) para os pares suportados' })
    @ApiQuery({ name: 'instIds', required: false, type: String, description: 'Lista separada por vírgula' })
    async getSpotInstruments(@Query('instIds') instIds?: string) {
        const pairs = this.normalizePairs(instIds);
        this.assertPairs(pairs);
        return await this.okxService.getSpotInstruments(pairs);
    }

    @Get('spot/ticker')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Ticker spot (último preço, variação, volume)' })
    @ApiQuery({ name: 'instId', required: true, type: String })
    async getSpotTicker(@Query('instId') instId: string) {
        this.assertPairs([instId]);
        return await this.okxService.getSpotTicker(instId);
    }

    @Get('spot/orderbook')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Livro de ofertas (5 níveis por padrão)' })
    @ApiQuery({ name: 'instId', required: true, type: String })
    @ApiQuery({ name: 'depth', required: false, type: Number })
    async getSpotOrderBook(
        @Query('instId') instId: string,
        @Query('depth') depth?: string
    ) {
        this.assertPairs([instId]);
        const size = Math.min(Math.max(Number(depth) || 5, 1), 50);
        return await this.okxService.getSpotOrderBook(instId, size);
    }

    @Get('spot/trades')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Últimos negócios (trades) spot' })
    @ApiQuery({ name: 'instId', required: true, type: String })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getSpotTrades(
        @Query('instId') instId: string,
        @Query('limit') limit?: string
    ) {
        this.assertPairs([instId]);
        const size = Math.min(Math.max(Number(limit) || 20, 1), 100);
        return await this.okxService.getSpotTrades(instId, size);
    }

    @Get('spot/candles')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Candles spot para o gráfico' })
    @ApiQuery({ name: 'instId', required: true, type: String })
    @ApiQuery({ name: 'bar', required: false, type: String })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getSpotCandles(
        @Query('instId') instId: string,
        @Query('bar') bar?: string,
        @Query('limit') limit?: string
    ) {
        this.assertPairs([instId]);
        const size = Math.min(Math.max(Number(limit) || 60, 1), 300);
        return await this.okxService.getSpotCandles(instId, bar || '1H', size);
    }

    @Get('spot/balances')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Saldos spot do usuário' })
    async getSpotBalances(@Req() req: AuthRequest) {
        const customerId = req.user?.customerId;
        if (!customerId) {
            throw new BadRequestException('Cliente não identificado');
        }
        return await this.okxSpotService.getBalances(customerId);
    }

    @Post('spot/transfer-to-pro')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Transferir USDT da carteira para PRO' })
    async transferToPro(
        @Req() req: AuthRequest,
        @Body() body: { amount: number; walletId?: string },
    ) {
        const customerId = req.user?.customerId;
        if (!customerId) {
            throw new BadRequestException('Cliente não identificado');
        }
        return await this.okxSpotService.transferToPro(customerId, Number(body.amount), body.walletId);
    }

    @Post('spot/transfer-to-wallet')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Transferir USDT do PRO para carteira' })
    async transferToWallet(
        @Req() req: AuthRequest,
        @Body() body: { amount: number; walletId?: string },
    ) {
        const customerId = req.user?.customerId;
        if (!customerId) {
            throw new BadRequestException('Cliente não identificado');
        }
        return await this.okxSpotService.transferToWallet(customerId, Number(body.amount), body.walletId);
    }

    @Get('spot/transfers')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Histórico de transferências PRO' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'direction', required: false, type: String })
    async getSpotTransfers(
        @Req() req: AuthRequest,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('direction') direction?: string,
    ) {
        const customerId = req.user?.customerId;
        if (!customerId) {
            throw new BadRequestException('Cliente não identificado');
        }
        return await this.okxSpotService.getTransfers({
            customerId,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
            direction: direction as any,
        });
    }

    @Get('spot/orders')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Histórico de ordens PRO' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'instId', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, type: String })
    async getSpotOrders(
        @Req() req: AuthRequest,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('instId') instId?: string,
        @Query('status') status?: string,
    ) {
        const customerId = req.user?.customerId;
        if (!customerId) {
            throw new BadRequestException('Cliente não identificado');
        }
        return await this.okxSpotService.getOrders({
            customerId,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
            instId: instId || undefined,
            status: status as any,
        });
    }

    @Post('spot/cancel-order')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Cancelar ordem limite' })
    async cancelSpotOrder(
        @Req() req: AuthRequest,
        @Body() body: { orderId: string },
    ) {
        const customerId = req.user?.customerId;
        if (!customerId) {
            throw new BadRequestException('Cliente não identificado');
        }
        if (!body.orderId) {
            throw new BadRequestException('orderId é obrigatório');
        }
        return await this.okxSpotService.cancelOrder(customerId, body.orderId);
    }

    @Post('spot/order')
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({ summary: 'Enviar ordem spot (limit/market)' })
    async placeSpotOrder(@Req() req: AuthRequest, @Body() body: {
        instId: string;
        side: 'buy' | 'sell';
        ordType: 'limit' | 'market';
        sz: string | number;
        px?: string | number;
        tgtCcy?: 'base_ccy' | 'quote_ccy';
    }) {
        const customerId = req.user?.customerId;
        if (!customerId) {
            throw new BadRequestException('Cliente não identificado');
        }
        this.assertPairs([body.instId]);
        if (!body.instId || !body.side || !body.ordType || !body.sz) {
            throw new BadRequestException('Parâmetros inválidos');
        }
        const size = Number(body.sz);
        if (!Number.isFinite(size) || size <= 0) {
            throw new BadRequestException('Quantidade inválida');
        }
        if (body.ordType === 'limit' && !body.px) {
            throw new BadRequestException('Preço é obrigatório para ordem limite');
        }
        if (body.ordType === 'limit') {
            const price = Number(body.px);
            if (!Number.isFinite(price) || price <= 0) {
                throw new BadRequestException('Preço inválido');
            }
        }
        return await this.okxSpotService.placeOrder(customerId, {
            instId: body.instId,
            side: body.side,
            ordType: body.ordType,
            sz: body.sz,
            px: body.px,
            tgtCcy: body.tgtCcy,
        });
    }
}
