import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OkxService } from '../okx/services/okx.service';
import { SolanaService } from '../solana/solana.service';
import { TronService } from '../tron/tron.service';
import { Decimal } from '@prisma/client/runtime/library';
import { BoletoPaymentStatus } from '@prisma/client';

const SERVICE_FEE_RATE = 0.03; // 3%
const SUPPORTED_CURRENCIES = ['USDT', 'SOL', 'TRX'];

@Injectable()
export class BoletoPaymentsService {
  private readonly logger = new Logger(BoletoPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly okxService: OkxService,
    private readonly solanaService: SolanaService,
    private readonly tronService: TronService,
  ) {}

  /**
   * Obtém a cotação de quanto crypto é necessário para pagar um boleto.
   */
  async getQuote(boletoAmount: number, cryptoCurrency: string) {
    if (!SUPPORTED_CURRENCIES.includes(cryptoCurrency)) {
      throw new BadRequestException(
        `Moeda não suportada. Moedas aceitas: ${SUPPORTED_CURRENCIES.join(', ')}`,
      );
    }

    if (boletoAmount < 1) {
      throw new BadRequestException('O valor do boleto deve ser no mínimo R$ 1,00');
    }

    const serviceFee = boletoAmount * SERVICE_FEE_RATE;
    const totalBrl = boletoAmount + serviceFee;

    const exchangeRate = await this.getCryptoToBrlRate(cryptoCurrency);
    const cryptoAmount = totalBrl / exchangeRate;

    return {
      boletoAmount,
      serviceFee: Math.round(serviceFee * 100) / 100,
      serviceFeePct: SERVICE_FEE_RATE * 100,
      totalBrl: Math.round(totalBrl * 100) / 100,
      cryptoCurrency,
      exchangeRate: Math.round(exchangeRate * 10000) / 10000,
      cryptoAmount: Math.round(cryptoAmount * 100000000) / 100000000,
    };
  }

  /**
   * Cria uma solicitação de pagamento de boleto com crypto.
   * Debita o crypto da wallet do cliente e cria o registro para o admin pagar.
   */
  async createBoletoPayment(
    customerId: string,
    barcode: string,
    boletoAmount: number,
    walletId: string,
    cryptoCurrency: string,
    description?: string,
  ) {
    if (!SUPPORTED_CURRENCIES.includes(cryptoCurrency)) {
      throw new BadRequestException(
        `Moeda não suportada. Moedas aceitas: ${SUPPORTED_CURRENCIES.join(', ')}`,
      );
    }

    if (boletoAmount < 1) {
      throw new BadRequestException('O valor do boleto deve ser no mínimo R$ 1,00');
    }

    if (!barcode || barcode.trim().length === 0) {
      throw new BadRequestException('O código de barras do boleto é obrigatório');
    }

    // Buscar a wallet e validar propriedade
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, customerId, isActive: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet não encontrada ou não pertence ao cliente');
    }

    // Calcular valores
    const serviceFee = boletoAmount * SERVICE_FEE_RATE;
    const totalBrl = boletoAmount + serviceFee;
    const exchangeRate = await this.getCryptoToBrlRate(cryptoCurrency);
    const cryptoAmountNeeded = totalBrl / exchangeRate;

    // Verificar saldo disponível
    const availableBalance = await this.getWalletCryptoBalance(
      wallet,
      cryptoCurrency,
    );

    if (availableBalance < cryptoAmountNeeded) {
      throw new BadRequestException(
        `Saldo insuficiente. Necessário: ${cryptoAmountNeeded.toFixed(8)} ${cryptoCurrency}, ` +
          `disponível: ${availableBalance.toFixed(8)} ${cryptoCurrency}`,
      );
    }

    // Debitar saldo da wallet (para USDT, debita do DB; para SOL/TRX, registra o valor)
    if (cryptoCurrency === 'USDT') {
      await this.prisma.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            decrement: new Decimal(cryptoAmountNeeded.toFixed(8)),
          },
        },
      });
    }

    // Criar o registro do pagamento de boleto
    const boletoPayment = await this.prisma.boletoPayment.create({
      data: {
        customerId,
        barcode: barcode.trim(),
        description,
        boletoAmount: new Decimal(boletoAmount.toFixed(2)),
        serviceFee: new Decimal(serviceFee.toFixed(2)),
        totalBrl: new Decimal(totalBrl.toFixed(2)),
        cryptoAmount: new Decimal(cryptoAmountNeeded.toFixed(8)),
        cryptoCurrency,
        network: wallet.network,
        walletId,
        exchangeRate: new Decimal(exchangeRate.toFixed(4)),
        status: BoletoPaymentStatus.PENDING_APPROVAL,
      },
      include: {
        wallet: {
          select: {
            id: true,
            network: true,
            externalAddress: true,
            label: true,
          },
        },
      },
    });

    this.logger.log(
      `[BOLETO] Pagamento criado: ${boletoPayment.id} | ` +
        `Cliente: ${customerId} | Boleto: R$ ${boletoAmount} | ` +
        `Crypto: ${cryptoAmountNeeded.toFixed(8)} ${cryptoCurrency} | ` +
        `Taxa: R$ ${serviceFee.toFixed(2)}`,
    );

    return boletoPayment;
  }

  /**
   * Lista pagamentos de boleto do cliente.
   */
  async getCustomerBoletoPayments(
    customerId: string,
    status?: string,
  ) {
    const where: any = { customerId };
    if (status) {
      where.status = status;
    }

    return this.prisma.boletoPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: {
          select: {
            id: true,
            network: true,
            externalAddress: true,
            label: true,
          },
        },
      },
    });
  }

  /**
   * Detalhe de um pagamento de boleto do cliente.
   */
  async getBoletoPaymentById(id: string, customerId: string) {
    const payment = await this.prisma.boletoPayment.findFirst({
      where: { id, customerId },
      include: {
        wallet: {
          select: {
            id: true,
            network: true,
            externalAddress: true,
            label: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento de boleto não encontrado');
    }

    return payment;
  }

  /**
   * Cancela um pagamento de boleto (apenas se PENDING_APPROVAL).
   * Devolve o crypto ao saldo da wallet.
   */
  async cancelBoletoPayment(id: string, customerId: string) {
    const payment = await this.prisma.boletoPayment.findFirst({
      where: { id, customerId },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento de boleto não encontrado');
    }

    if (payment.status !== BoletoPaymentStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Apenas pagamentos com status PENDING_APPROVAL podem ser cancelados',
      );
    }

    // Devolver crypto ao saldo da wallet (para USDT)
    if (payment.cryptoCurrency === 'USDT') {
      await this.prisma.wallet.update({
        where: { id: payment.walletId },
        data: {
          balance: {
            increment: payment.cryptoAmount,
          },
        },
      });
    }

    const updated = await this.prisma.boletoPayment.update({
      where: { id },
      data: { status: BoletoPaymentStatus.CANCELLED },
    });

    this.logger.log(
      `[BOLETO] Pagamento cancelado: ${id} | ` +
        `Crypto devolvido: ${payment.cryptoAmount} ${payment.cryptoCurrency}`,
    );

    return updated;
  }

  // ==================== ADMIN METHODS ====================

  /**
   * Lista todos os pagamentos de boleto (admin).
   */
  async adminListBoletoPayments(query: {
    status?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, customerId, page = 1, limit = 20 } = query;
    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customerId = customerId;
    }

    const [data, total] = await Promise.all([
      this.prisma.boletoPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              cpf: true,
              cnpj: true,
            },
          },
          wallet: {
            select: {
              id: true,
              network: true,
              externalAddress: true,
              label: true,
            },
          },
        },
      }),
      this.prisma.boletoPayment.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin marca boleto como pago.
   */
  async adminMarkAsPaid(
    boletoPaymentId: string,
    adminUserId: string,
    adminNotes?: string,
  ) {
    const payment = await this.prisma.boletoPayment.findUnique({
      where: { id: boletoPaymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento de boleto não encontrado');
    }

    if (
      payment.status !== BoletoPaymentStatus.PENDING_APPROVAL &&
      payment.status !== BoletoPaymentStatus.ADMIN_PAYING
    ) {
      throw new BadRequestException(
        `Não é possível marcar como pago. Status atual: ${payment.status}`,
      );
    }

    const updated = await this.prisma.boletoPayment.update({
      where: { id: boletoPaymentId },
      data: {
        status: BoletoPaymentStatus.PAID,
        paidByAdminAt: new Date(),
        paidByAdminId: adminUserId,
        adminNotes,
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log(
      `[BOLETO] Pagamento confirmado pelo admin: ${boletoPaymentId} | ` +
        `Admin: ${adminUserId} | Cliente: ${payment.customerId}`,
    );

    return updated;
  }

  /**
   * Admin marca boleto como "em processamento" (está pagando).
   */
  async adminMarkAsProcessing(boletoPaymentId: string) {
    const payment = await this.prisma.boletoPayment.findUnique({
      where: { id: boletoPaymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento de boleto não encontrado');
    }

    if (payment.status !== BoletoPaymentStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Não é possível iniciar processamento. Status atual: ${payment.status}`,
      );
    }

    return this.prisma.boletoPayment.update({
      where: { id: boletoPaymentId },
      data: { status: BoletoPaymentStatus.ADMIN_PAYING },
    });
  }

  /**
   * Admin rejeita/falha um pagamento de boleto. Devolve crypto ao cliente.
   */
  async adminRejectBoletoPayment(
    boletoPaymentId: string,
    reason?: string,
  ) {
    const payment = await this.prisma.boletoPayment.findUnique({
      where: { id: boletoPaymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento de boleto não encontrado');
    }

    if (
      payment.status !== BoletoPaymentStatus.PENDING_APPROVAL &&
      payment.status !== BoletoPaymentStatus.ADMIN_PAYING
    ) {
      throw new BadRequestException(
        `Não é possível rejeitar. Status atual: ${payment.status}`,
      );
    }

    // Devolver crypto ao saldo da wallet (para USDT)
    if (payment.cryptoCurrency === 'USDT') {
      await this.prisma.wallet.update({
        where: { id: payment.walletId },
        data: {
          balance: {
            increment: payment.cryptoAmount,
          },
        },
      });
    }

    const updated = await this.prisma.boletoPayment.update({
      where: { id: boletoPaymentId },
      data: {
        status: BoletoPaymentStatus.REFUNDED,
        errorMessage: reason || 'Rejeitado pelo administrador',
      },
    });

    this.logger.log(
      `[BOLETO] Pagamento rejeitado: ${boletoPaymentId} | ` +
        `Motivo: ${reason || 'N/A'} | ` +
        `Crypto devolvido: ${payment.cryptoAmount} ${payment.cryptoCurrency}`,
    );

    return updated;
  }

  /**
   * Estatísticas de pagamentos de boleto (admin dashboard).
   */
  async adminGetStats() {
    const [
      totalCount,
      pendingCount,
      paidCount,
      totalBrlPaid,
      totalFeesCollected,
    ] = await Promise.all([
      this.prisma.boletoPayment.count(),
      this.prisma.boletoPayment.count({
        where: {
          status: {
            in: [
              BoletoPaymentStatus.PENDING_APPROVAL,
              BoletoPaymentStatus.ADMIN_PAYING,
            ],
          },
        },
      }),
      this.prisma.boletoPayment.count({
        where: { status: BoletoPaymentStatus.PAID },
      }),
      this.prisma.boletoPayment.aggregate({
        where: { status: BoletoPaymentStatus.PAID },
        _sum: { totalBrl: true },
      }),
      this.prisma.boletoPayment.aggregate({
        where: { status: BoletoPaymentStatus.PAID },
        _sum: { serviceFee: true },
      }),
    ]);

    return {
      totalCount,
      pendingCount,
      paidCount,
      totalBrlPaid: totalBrlPaid._sum.totalBrl || 0,
      totalFeesCollected: totalFeesCollected._sum.serviceFee || 0,
    };
  }

  // ==================== HELPERS ====================

  /**
   * Obtém a taxa de conversão crypto -> BRL.
   */
  private async getCryptoToBrlRate(currency: string): Promise<number> {
    const usdtBrlRate = await this.okxService.getBrlToUsdtRate();

    switch (currency) {
      case 'USDT':
        return usdtBrlRate;
      case 'SOL': {
        const solUsdtRate = await this.getOkxTickerPrice('SOL-USDT');
        return solUsdtRate * usdtBrlRate;
      }
      case 'TRX': {
        const trxUsdtRate = await this.getOkxTickerPrice('TRX-USDT');
        return trxUsdtRate * usdtBrlRate;
      }
      default:
        throw new BadRequestException(`Moeda não suportada: ${currency}`);
    }
  }

  /**
   * Obtém o preço de um par na OKX via ticker.
   */
  private async getOkxTickerPrice(instId: string): Promise<number> {
    try {
      const axios = (await import('axios')).default;
      const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';
      const response = await axios.get(
        `${apiUrl}/api/v5/market/ticker?instId=${instId}`,
      );
      const ticker = response.data?.data?.[0];
      if (ticker?.last) {
        return parseFloat(ticker.last);
      }
      throw new Error(`Ticker ${instId} não retornou preço`);
    } catch (error: any) {
      this.logger.error(
        `Erro ao obter ticker ${instId}: ${error.message}`,
      );
      throw new BadRequestException(
        `Não foi possível obter cotação para ${instId}`,
      );
    }
  }

  /**
   * Obtém o saldo disponível de crypto na wallet.
   */
  private async getWalletCryptoBalance(
    wallet: { id: string; balance: Decimal; network: string; externalAddress: string | null },
    currency: string,
  ): Promise<number> {
    switch (currency) {
      case 'USDT':
        return wallet.balance.toNumber();

      case 'SOL':
        if (wallet.network !== 'SOLANA') {
          throw new BadRequestException(
            'Para pagar com SOL, selecione uma wallet na rede Solana',
          );
        }
        if (!wallet.externalAddress) {
          throw new BadRequestException('Wallet sem endereço externo');
        }
        return this.solanaService.getSolBalance(wallet.externalAddress);

      case 'TRX':
        if (wallet.network !== 'TRON') {
          throw new BadRequestException(
            'Para pagar com TRX, selecione uma wallet na rede Tron',
          );
        }
        if (!wallet.externalAddress) {
          throw new BadRequestException('Wallet sem endereço externo');
        }
        return this.tronService.getTrxBalance(wallet.externalAddress);

      default:
        throw new BadRequestException(`Moeda não suportada: ${currency}`);
    }
  }
}
