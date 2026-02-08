import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, SpotOrderStatus, SpotTransferDirection, WalletNetwork } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OkxService } from './okx.service';
import { SPOT_CURRENCIES } from '../spot.constants';

const MARKET_BUY_BUFFER = 1.01;
const PRO_FEE_RATE = (() => {
  const raw = Number(process.env.PRO_FEE_RATE ?? '0.0098');
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return raw;
})();
const SPOT_CURRENCY_SET = new Set(SPOT_CURRENCIES);
const NETWORK_HINTS: Record<WalletNetwork, string[]> = {
  SOLANA: ['SOLANA'],
  TRON: ['TRON', 'TRC20'],
  ETHEREUM: ['ERC20', 'ETH'],
  BITCOIN: ['BITCOIN', 'BTC'],
  POLYGON: ['POLYGON', 'MATIC'],
  BSC: ['BSC', 'BEP20'],
  AVALANCHE: ['AVALANCHE', 'AVAX'],
  ARBITRUM: ['ARBITRUM'],
  OPTIMISM: ['OPTIMISM'],
  BASE: ['BASE'],
};

@Injectable()
export class OkxSpotService {
  private readonly logger = new Logger(OkxSpotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly okxService: OkxService,
  ) {}

  private toDecimal(value: number) {
    if (!Number.isFinite(value)) {
      return new Decimal(0);
    }
    return new Decimal(value.toFixed(8));
  }

  private feeRateDecimal() {
    return new Decimal(PRO_FEE_RATE);
  }

  private feeForQuote(quoteAmount: Decimal) {
    if (quoteAmount.lte(0)) return new Decimal(0);
    return quoteAmount.mul(this.feeRateDecimal());
  }

  private normalizeCurrency(input?: string) {
    const currency = (input || 'USDT').toUpperCase();
    if (!SPOT_CURRENCY_SET.has(currency as any)) {
      throw new BadRequestException(`Moeda não suportada: ${currency}`);
    }
    return currency;
  }

  private isOkxWhitelistErrorMessage(message?: string) {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return (
      normalized.includes('verified addresses') ||
      normalized.includes('whitelist') ||
      normalized.includes('58207')
    );
  }

  private resolveNetworks(currency: string): WalletNetwork[] {
    switch (currency) {
      case 'USDT':
        return ['SOLANA', 'TRON'];
      case 'SOL':
        return ['SOLANA'];
      case 'TRX':
        return ['TRON'];
      case 'ETH':
        return ['ETHEREUM'];
      case 'BTC':
        return ['BITCOIN'];
      default:
        return [];
    }
  }

  private parseInstId(instId: string) {
    const [base, quote] = instId.split('-');
    if (!base || !quote) {
      throw new BadRequestException('Par inválido');
    }
    return { base, quote };
  }

  private async upsertBalance(
    tx: Prisma.TransactionClient,
    customerId: string,
    currency: string,
  ) {
    return tx.spotBalance.upsert({
      where: { customerId_currency: { customerId, currency } },
      update: {},
      create: {
        customerId,
        currency,
        available: new Decimal(0),
        locked: new Decimal(0),
      },
    });
  }

  private async ensureBalances(customerId: string, currencies: readonly string[]) {
    await this.prisma.$transaction(async (tx) => {
      for (const currency of currencies) {
        await this.upsertBalance(tx, customerId, currency);
      }
    });
  }

  async getBalances(customerId: string) {
    await this.ensureBalances(customerId, SPOT_CURRENCIES);

    const balances = await this.prisma.spotBalance.findMany({
      where: { customerId, currency: { in: [...SPOT_CURRENCIES] } },
      orderBy: { currency: 'asc' },
    });

    return balances.map((balance) => ({
      currency: balance.currency,
      available: Number(balance.available),
      locked: Number(balance.locked),
    }));
  }

  private async getWalletForTransfer(customerId: string, currency: string, walletId?: string) {
    if (walletId) {
      return this.prisma.wallet.findFirst({
        where: { id: walletId, customerId, currency, isActive: true },
      });
    }

    const networks = this.resolveNetworks(currency);
    for (const network of networks) {
      const main = await this.prisma.wallet.findFirst({
        where: { customerId, currency, network, isMain: true, isActive: true },
      });
      if (main) return main;
    }

    for (const network of networks) {
      const any = await this.prisma.wallet.findFirst({
        where: { customerId, currency, network, isActive: true },
      });
      if (any) return any;
    }

    return null;
  }

  private async resolveOkxChain(currency: string, network: WalletNetwork) {
    const chains = await this.okxService.getCurrencyChains(currency);
    const hints = NETWORK_HINTS[network] || [];
    const normalizedCurrency = currency.toUpperCase();

    const match = chains.find((item: any) => {
      const chain = String(item.chain || '').toUpperCase();
      if (!chain) return false;
      const networkMatch = hints.some((hint) => chain.includes(hint));
      if (!networkMatch) return false;
      return chain.includes(normalizedCurrency);
    }) || chains.find((item: any) => {
      const chain = String(item.chain || '').toUpperCase();
      const networkMatch = hints.some((hint) => chain.includes(hint));
      return networkMatch;
    });

    if (!match) {
      throw new BadRequestException(`Chain OKX não encontrada para ${currency} (${network})`);
    }

    return {
      chain: match.chain as string,
      minFee: match.minFee ?? match.minWdFee ?? match.wdFee ?? '0',
      minWithdrawal: match.minWd ?? match.minWithdrawal ?? null,
    };
  }

  async transferToPro(customerId: string, amount: number, currencyInput?: string, walletId?: string) {
    const currency = this.normalizeCurrency(currencyInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Valor inválido');
    }

    const wallet = await this.getWalletForTransfer(customerId, currency, walletId);
    if (!wallet) {
      throw new BadRequestException(`Wallet ${currency} não encontrada`);
    }

    const amountDecimal = this.toDecimal(amount);

    await this.prisma.$transaction(async (tx) => {
      const currentWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
      if (!currentWallet) {
        throw new BadRequestException('Wallet não encontrada');
      }
      if (new Decimal(currentWallet.balance).lt(amountDecimal)) {
        throw new BadRequestException('Saldo insuficiente na carteira');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amountDecimal },
          reserved: { increment: amountDecimal },
        },
      });

      await this.upsertBalance(tx, customerId, currency);
      await tx.spotBalance.update({
        where: { customerId_currency: { customerId, currency } },
        data: { available: { increment: amountDecimal } },
      });

      await tx.spotTransfer.create({
        data: {
          customerId,
          walletId: wallet.id,
          currency,
          amount: amountDecimal,
          direction: SpotTransferDirection.TO_PRO,
        },
      });
    });

    return { success: true };
  }

  async transferToWallet(customerId: string, amount: number, currencyInput?: string, walletId?: string) {
    const currency = this.normalizeCurrency(currencyInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Valor inválido');
    }

    const wallet = await this.getWalletForTransfer(customerId, currency, walletId);
    if (!wallet) {
      throw new BadRequestException(`Wallet ${currency} não encontrada`);
    }

    const amountDecimal = this.toDecimal(amount);

    const spot = await this.prisma.spotBalance.findUnique({
      where: { customerId_currency: { customerId, currency } },
    });
    if (!spot || new Decimal(spot.available).lt(amountDecimal)) {
      throw new BadRequestException('Saldo insuficiente no PRO');
    }

    const currentWallet = await this.prisma.wallet.findUnique({ where: { id: wallet.id } });
    if (!currentWallet) {
      throw new BadRequestException('Wallet não encontrada');
    }

    const reserved = new Decimal(currentWallet.reserved || 0);
    const releaseAmount = reserved.gte(amountDecimal) ? amountDecimal : reserved;
    const withdrawAmount = amountDecimal.sub(releaseAmount);

    let okxWithdraw: any = null;
    if (withdrawAmount.gt(0)) {
      try {
        if (!currentWallet.externalAddress) {
          throw new BadRequestException('Wallet sem endereço para saque');
        }

        const { chain, minFee } = await this.resolveOkxChain(currency, currentWallet.network);
        const fee = minFee || '0';
        const withdrawAmountStr = withdrawAmount.toFixed(8);

        await this.okxService.transferFromTradingToFunding(currency, withdrawAmountStr);
        okxWithdraw = await this.okxService.withdrawCrypto({
          currency,
          amount: withdrawAmountStr,
          toAddress: currentWallet.externalAddress,
          chain,
          fee: String(fee),
        });
      } catch (error: any) {
        const rawMessage = error?.message || `Erro ao sacar ${currency}`;
        const isWhitelistError = this.isOkxWhitelistErrorMessage(rawMessage);
        if (isWhitelistError) {
          await this.prisma.wallet.update({
            where: { id: currentWallet.id },
            data: { okxWhitelisted: false },
          }).catch(() => null);
        }
        const publicMessage = isWhitelistError
          ? 'Endereço não confirmado na whitelist da OKX. Autorize o endereço no app/web da OKX e tente novamente.'
          : rawMessage;
        this.logger.error(`Erro ao sacar ${currency}: ${publicMessage}`);
        throw new BadRequestException(publicMessage);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.spotBalance.update({
        where: { customerId_currency: { customerId, currency } },
        data: { available: { decrement: amountDecimal } },
      });

      if (releaseAmount.gt(0)) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: releaseAmount },
            reserved: { decrement: releaseAmount },
          },
        });
      }

      await tx.spotTransfer.create({
        data: {
          customerId,
          walletId: wallet.id,
          currency,
          amount: amountDecimal,
          direction: SpotTransferDirection.TO_WALLET,
        },
      });
    });

    return { success: true, okxWithdraw };
  }

  async placeOrder(
    customerId: string,
    payload: {
      instId: string;
      side: 'buy' | 'sell';
      ordType: 'limit' | 'market';
      sz: string | number;
      px?: string | number;
      tgtCcy?: 'base_ccy' | 'quote_ccy';
    },
  ) {
    const size = Number(payload.sz);
    if (!Number.isFinite(size) || size <= 0) {
      throw new BadRequestException('Quantidade inválida');
    }

    const { base, quote } = this.parseInstId(payload.instId);

    await this.ensureBalances(customerId, [base, quote]);

    const spendCurrency = payload.side === 'buy' ? quote : base;

    let required = 0;
    let price = 0;

    if (payload.ordType === 'limit') {
      price = Number(payload.px);
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('Preço inválido');
      }
      required = payload.side === 'buy' ? size * price * (1 + PRO_FEE_RATE) : size;
    } else {
      if (payload.side === 'buy') {
        const ticker = await this.okxService.getSpotTicker(payload.instId);
        price = ticker.last || 0;
        if (!Number.isFinite(price) || price <= 0) {
          throw new BadRequestException('Preço indisponível');
        }
        required = size * price * MARKET_BUY_BUFFER * (1 + PRO_FEE_RATE);
      } else {
        required = size;
      }
    }

    const requiredDecimal = this.toDecimal(required);

    const { order, lockedAmount } = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.spotBalance.findUnique({
        where: { customerId_currency: { customerId, currency: spendCurrency } },
      });

      if (!balance || new Decimal(balance.available).lt(requiredDecimal)) {
        throw new BadRequestException('Saldo insuficiente');
      }

      await tx.spotBalance.update({
        where: { customerId_currency: { customerId, currency: spendCurrency } },
        data: {
          available: { decrement: requiredDecimal },
          locked: { increment: requiredDecimal },
        },
      });

      const createdOrder = await tx.spotOrder.create({
        data: {
          customerId,
          instId: payload.instId,
          side: payload.side,
          ordType: payload.ordType,
          sz: this.toDecimal(size),
          px: payload.ordType === 'limit' ? this.toDecimal(price) : null,
          lockedCurrency: spendCurrency,
          lockedAmount: requiredDecimal,
          status: SpotOrderStatus.OPEN,
        },
      });

      return { order: createdOrder, lockedAmount: requiredDecimal };
    });

    try {
      const okxResponse = await this.okxService.placeSpotOrder(payload);
      const okxOrdId = okxResponse?.data?.[0]?.ordId || okxResponse?.data?.[0]?.sCode || null;

      await this.prisma.spotOrder.update({
        where: { id: order.id },
        data: { okxOrdId, status: SpotOrderStatus.OPEN },
      });

      if (payload.ordType === 'market') {
        await this.settleOrder(order.id);
      }

      return okxResponse;
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.spotBalance.update({
          where: { customerId_currency: { customerId, currency: spendCurrency } },
          data: {
            available: { increment: lockedAmount },
            locked: { decrement: lockedAmount },
          },
        });

        await tx.spotOrder.update({
          where: { id: order.id },
          data: { status: SpotOrderStatus.FAILED },
        });
      });
      throw error;
    }
  }

  async getTransfers(params: {
    customerId: string;
    page?: number;
    limit?: number;
    direction?: SpotTransferDirection;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.SpotTransferWhereInput = {
      customerId: params.customerId,
    };
    if (params.direction) {
      where.direction = params.direction;
    }

    const [data, total] = await Promise.all([
      this.prisma.spotTransfer.findMany({
        where,
        include: { wallet: { select: { network: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.spotTransfer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: data.map((item) => ({
        id: item.id,
        amount: Number(item.amount),
        currency: item.currency,
        direction: item.direction,
        network: item.wallet?.network || null,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async getOrders(params: {
    customerId: string;
    page?: number;
    limit?: number;
    instId?: string;
    status?: SpotOrderStatus;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.SpotOrderWhereInput = {
      customerId: params.customerId,
    };
    if (params.instId) {
      where.instId = params.instId;
    }
    if (params.status) {
      where.status = params.status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.spotOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.spotOrder.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: orders.map((order) => ({
        id: order.id,
        instId: order.instId,
        side: order.side,
        ordType: order.ordType,
        status: order.status,
        sz: Number(order.sz),
        px: order.px ? Number(order.px) : null,
        filledBase: Number(order.filledBase),
        filledQuote: Number(order.filledQuote),
        avgPx: order.avgPx ? Number(order.avgPx) : null,
        createdAt: order.createdAt,
      })),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async cancelOrder(customerId: string, orderId: string) {
    const order = await this.prisma.spotOrder.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== customerId) {
      throw new BadRequestException('Ordem não encontrada');
    }
    if (order.ordType !== 'limit') {
      throw new BadRequestException('Apenas ordens limite podem ser canceladas');
    }
    const activeStatuses: SpotOrderStatus[] = [SpotOrderStatus.OPEN, SpotOrderStatus.PARTIAL];
    if (!activeStatuses.includes(order.status)) {
      throw new BadRequestException('Ordem não está ativa');
    }
    if (!order.okxOrdId) {
      throw new BadRequestException('Ordem ainda não enviada');
    }

    await this.okxService.cancelSpotOrder(order.instId, order.okxOrdId);
    await this.settleOrder(order.id);
    return { success: true };
  }

  private computeFillTotals(
    fills: any[],
    side: 'buy' | 'sell',
    base: string,
    quote: string,
  ) {
    let baseTotal = 0;
    let quoteTotal = 0;

    for (const fill of fills) {
      const fillSz = Number(fill.fillSz || 0);
      const fillPx = Number(fill.fillPx || 0);
      const fee = Math.abs(Number(fill.fee || 0));
      const feeCcy = String(fill.feeCcy || '').toUpperCase();

      if (!Number.isFinite(fillSz) || !Number.isFinite(fillPx)) {
        continue;
      }

      if (side === 'buy') {
        let baseReceived = fillSz;
        let quoteSpent = fillSz * fillPx;
        if (feeCcy === base.toUpperCase()) {
          baseReceived -= fee;
        }
        if (feeCcy === quote.toUpperCase()) {
          quoteSpent += fee;
        }
        baseTotal += baseReceived;
        quoteTotal += quoteSpent;
      } else {
        let baseSpent = fillSz;
        let quoteReceived = fillSz * fillPx;
        if (feeCcy === base.toUpperCase()) {
          baseSpent += fee;
        }
        if (feeCcy === quote.toUpperCase()) {
          quoteReceived -= fee;
        }
        baseTotal += baseSpent;
        quoteTotal += quoteReceived;
      }
    }

    return { baseTotal, quoteTotal };
  }

  async settleOrder(orderId: string) {
    const order = await this.prisma.spotOrder.findUnique({ where: { id: orderId } });
    if (!order || !order.okxOrdId) return;

    const { base, quote } = this.parseInstId(order.instId);
    const fills = await this.okxService.getSpotFills(order.instId, order.okxOrdId);
    const totals = this.computeFillTotals(fills, order.side as 'buy' | 'sell', base, quote);

    const filledBase = new Decimal(totals.baseTotal.toFixed(8));
    const filledQuote = new Decimal(totals.quoteTotal.toFixed(8));

    const deltaBase = filledBase.sub(order.filledBase);
    const deltaQuote = filledQuote.sub(order.filledQuote);
    const deltaFee = this.feeForQuote(deltaQuote);

    await this.prisma.$transaction(async (tx) => {
      if (order.side === 'buy') {
        if (deltaBase.gt(0)) {
          await tx.spotBalance.update({
            where: { customerId_currency: { customerId: order.customerId, currency: base } },
            data: { available: { increment: deltaBase } },
          });
        }
        const lockedDelta = deltaQuote.add(deltaFee);
        if (lockedDelta.gt(0)) {
          await tx.spotBalance.update({
            where: { customerId_currency: { customerId: order.customerId, currency: quote } },
            data: { locked: { decrement: lockedDelta } },
          });
        }
      } else {
        if (deltaBase.gt(0)) {
          await tx.spotBalance.update({
            where: { customerId_currency: { customerId: order.customerId, currency: base } },
            data: { locked: { decrement: deltaBase } },
          });
        }
        const netQuote = deltaQuote.sub(deltaFee);
        if (netQuote.gt(0)) {
          await tx.spotBalance.update({
            where: { customerId_currency: { customerId: order.customerId, currency: quote } },
            data: { available: { increment: netQuote } },
          });
        }
      }

      const avgPx = filledBase.gt(0) ? filledQuote.div(filledBase) : null;

      await tx.spotOrder.update({
        where: { id: order.id },
        data: {
          filledBase,
          filledQuote,
          avgPx,
        },
      });
    });

    const status = await this.okxService.getSpotOrderStatus(order.instId, order.okxOrdId);
    const state = status?.state || '';

    if (state === 'canceled') {
      await this.releaseRemainingLocked(order.id, SpotOrderStatus.CANCELED);
    } else if (state === 'filled') {
      await this.releaseRemainingLocked(order.id, SpotOrderStatus.FILLED);
    } else if (state === 'partially_filled') {
      await this.prisma.spotOrder.update({
        where: { id: order.id },
        data: { status: SpotOrderStatus.PARTIAL },
      });
    }
  }

  private async releaseRemainingLocked(orderId: string, status: SpotOrderStatus) {
    const order = await this.prisma.spotOrder.findUnique({ where: { id: orderId } });
    if (!order) return;

    const { base, quote } = this.parseInstId(order.instId);
    const lockedTotal = new Decimal(order.lockedAmount);
    const spent =
      order.side === 'buy'
        ? new Decimal(order.filledQuote).mul(this.feeRateDecimal().add(1))
        : new Decimal(order.filledBase);
    const remaining = lockedTotal.sub(spent);

    await this.prisma.$transaction(async (tx) => {
      if (remaining.gt(0)) {
        const currency = order.side === 'buy' ? quote : base;
        await tx.spotBalance.update({
          where: { customerId_currency: { customerId: order.customerId, currency } },
          data: {
            available: { increment: remaining },
            locked: { decrement: remaining },
          },
        });
      }

      await tx.spotOrder.update({
        where: { id: order.id },
        data: { status },
      });
    });
  }

  @Cron('*/10 * * * * *')
  async reconcileOpenOrders() {
    const openOrders = await this.prisma.spotOrder.findMany({
      where: {
        status: { in: [SpotOrderStatus.OPEN, SpotOrderStatus.PARTIAL] },
        okxOrdId: { not: null },
      },
      take: 50,
    });

    for (const order of openOrders) {
      try {
        await this.settleOrder(order.id);
      } catch (error: any) {
        this.logger.error(`Erro ao reconciliar ordem ${order.id}: ${error.message}`);
      }
    }
  }
}
