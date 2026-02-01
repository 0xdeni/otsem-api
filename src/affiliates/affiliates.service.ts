import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TronService } from '../tron/tron.service';
import { OkxService } from '../okx/services/okx.service';

const DEFAULT_COMMISSION_RATE = 0.03; // 3% of OTSEM's spread (default for new affiliates)
const DEFAULT_AFFILIATE_CODE = '0X'; // Default affiliate for signups without a referral code
const MIN_SETTLEMENT_USDT = 1; // Minimum USDT to trigger auto-settlement

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(
    private prisma: PrismaService,
    private tronService: TronService,
    private okxService: OkxService,
  ) {}

  async createAffiliate(data: {
    name: string;
    email: string;
    phone?: string;
    code: string;
    commissionRate?: number;
    spreadRate?: number;
    payoutWalletAddress?: string;
    payoutWalletNetwork?: string;
  }) {
    const existing = await this.prisma.affiliate.findFirst({
      where: {
        OR: [{ email: data.email }, { code: data.code }],
      },
    });

    if (existing) {
      throw new ConflictException('Afiliado com este email ou código já existe');
    }

    return this.prisma.affiliate.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        code: data.code.toUpperCase(),
        commissionRate: data.commissionRate ?? DEFAULT_COMMISSION_RATE,
        spreadRate: data.spreadRate ?? 0,
        payoutWalletAddress: data.payoutWalletAddress,
        payoutWalletNetwork: data.payoutWalletNetwork,
      },
    });
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [affiliates, total] = await Promise.all([
      this.prisma.affiliate.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { referredCustomers: true, commissions: true },
          },
        },
      }),
      this.prisma.affiliate.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: affiliates.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        code: a.code,
        commissionRate: Number(a.commissionRate),
        spreadRate: Number(a.spreadRate),
        payoutWalletAddress: a.payoutWalletAddress,
        payoutWalletNetwork: a.payoutWalletNetwork,
        totalEarnings: Number(a.totalEarnings),
        pendingEarnings: Number(a.pendingEarnings),
        totalEarningsUsdt: Number(a.totalEarningsUsdt),
        pendingEarningsUsdt: Number(a.pendingEarningsUsdt),
        isActive: a.isActive,
        referredCustomersCount: a._count.referredCustomers,
        commissionsCount: a._count.commissions,
        createdAt: a.createdAt,
      })),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findById(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
      include: {
        referredCustomers: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
        _count: { select: { commissions: true } },
      },
    });

    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return affiliate;
  }

  async findByCode(code: string) {
    return this.prisma.affiliate.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  async updateAffiliate(id: string, data: Partial<{
    name: string;
    email: string;
    phone: string;
    commissionRate: number;
    spreadRate: number;
    payoutWalletAddress: string;
    payoutWalletNetwork: string;
    isActive: boolean;
  }>) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return this.prisma.affiliate.update({
      where: { id },
      data,
    });
  }

  async deleteAffiliate(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
      include: { _count: { select: { commissions: true, referredCustomers: true } } },
    });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    await this.prisma.$transaction([
      // Unlink all referred customers
      this.prisma.customer.updateMany({
        where: { affiliateId: id },
        data: { affiliateId: null },
      }),
      // Delete all commissions (removes RESTRICT constraint issue)
      this.prisma.affiliateCommission.deleteMany({
        where: { affiliateId: id },
      }),
      // Unlink conversions
      this.prisma.conversion.updateMany({
        where: { affiliateId: id },
        data: { affiliateId: null },
      }),
      // Delete the affiliate
      this.prisma.affiliate.delete({
        where: { id },
      }),
    ]);

    this.logger.log(
      `[Affiliate] Deleted affiliate ${affiliate.code} (${affiliate.name}). ` +
      `Unlinked ${affiliate._count.referredCustomers} customers, deleted ${affiliate._count.commissions} commissions.`,
    );

    return { deleted: true, code: affiliate.code, name: affiliate.name };
  }

  async toggleActive(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return this.prisma.affiliate.update({
      where: { id },
      data: { isActive: !affiliate.isActive },
    });
  }

  async linkCustomerToAffiliate(customerId: string, affiliateCode: string) {
    const affiliate = await this.findByCode(affiliateCode);
    if (!affiliate) {
      throw new NotFoundException('Código de afiliado inválido');
    }

    if (!affiliate.isActive) {
      throw new ConflictException('Este afiliado não está ativo');
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { affiliateId: affiliate.id },
    });
  }

  /**
   * Links a customer to a default affiliate or a specific referral code.
   * Called during registration.
   */
  async linkCustomerOnRegistration(customerId: string, affiliateCode?: string) {
    // If a specific code was provided, try it first
    if (affiliateCode) {
      const affiliate = await this.findByCode(affiliateCode);
      if (affiliate && affiliate.isActive) {
        await this.prisma.customer.update({
          where: { id: customerId },
          data: { affiliateId: affiliate.id },
        });
        this.logger.log(`[Affiliate] Customer ${customerId} linked to affiliate ${affiliate.code} (referral code)`);
        return;
      }
      this.logger.warn(`[Affiliate] Referral code "${affiliateCode}" invalid or inactive, falling back to default`);
    }

    // Fall back to default affiliate (0X)
    const defaultAffiliate = await this.findByCode(DEFAULT_AFFILIATE_CODE);
    if (defaultAffiliate && defaultAffiliate.isActive) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { affiliateId: defaultAffiliate.id },
      });
      this.logger.log(`[Affiliate] Customer ${customerId} linked to default affiliate ${defaultAffiliate.code}`);
    }
  }

  /**
   * Records a commission for an affiliate.
   * New model: commission = commissionRate * spreadBrl (10% of OTSEM's spread by default).
   * Stores both BRL and USDT values.
   */
  async recordCommission(data: {
    affiliateId: string;
    customerId: string;
    conversionId?: string;
    conversionType?: string;
    transactionId?: string;
    transactionAmount: number; // Total BRL amount of the transaction
    spreadBrl: number; // OTSEM's spread in BRL
    exchangeRate: number; // BRL per USDT at time of conversion
  }) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: data.affiliateId },
    });

    if (!affiliate) {
      this.logger.error(`[Affiliate] Affiliate ${data.affiliateId} not found, skipping commission`);
      return null;
    }

    const commissionRate = Number(affiliate.commissionRate) || DEFAULT_COMMISSION_RATE;
    const commissionBrl = data.spreadBrl * commissionRate;
    const commissionUsdt = data.exchangeRate > 0 ? commissionBrl / data.exchangeRate : 0;

    this.logger.log(
      `[Affiliate] Recording commission: R$ ${commissionBrl.toFixed(2)} / ${commissionUsdt.toFixed(6)} USDT ` +
      `(${(commissionRate * 100).toFixed(0)}% of R$ ${data.spreadBrl.toFixed(2)} spread) ` +
      `for affiliate ${affiliate.code} [${data.conversionType || 'N/A'}]`,
    );

    const commission = await this.prisma.affiliateCommission.create({
      data: {
        affiliateId: data.affiliateId,
        customerId: data.customerId,
        transactionId: data.transactionId,
        conversionId: data.conversionId,
        conversionType: data.conversionType,
        transactionAmount: data.transactionAmount,
        spreadBrl: data.spreadBrl,
        commissionRate,
        commissionBrl,
        commissionUsdt,
        exchangeRate: data.exchangeRate,
        // Legacy fields set to 0
        spreadTotal: 0,
        spreadBase: 0,
        spreadAffiliate: 0,
      },
    });

    await this.prisma.affiliate.update({
      where: { id: data.affiliateId },
      data: {
        pendingEarnings: { increment: commissionBrl },
        pendingEarningsUsdt: { increment: commissionUsdt },
      },
    });

    return commission;
  }

  /**
   * Attempts to settle pending USDT commissions for an affiliate.
   * Uses Tron hot wallet for TRON payouts or OKX withdrawal for SOLANA.
   * Returns the settlement result or null if not settled.
   */
  async settleCommissionUsdt(affiliateId: string): Promise<{
    settled: boolean;
    amountUsdt: number;
    txId?: string;
    reason?: string;
  }> {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
    });

    if (!affiliate) {
      return { settled: false, amountUsdt: 0, reason: 'Affiliate not found' };
    }

    const pendingUsdt = Number(affiliate.pendingEarningsUsdt);

    if (pendingUsdt < MIN_SETTLEMENT_USDT) {
      return {
        settled: false,
        amountUsdt: pendingUsdt,
        reason: `Below minimum settlement (${MIN_SETTLEMENT_USDT} USDT). Accumulated: ${pendingUsdt.toFixed(6)} USDT`,
      };
    }

    if (!affiliate.payoutWalletAddress || !affiliate.payoutWalletNetwork) {
      return {
        settled: false,
        amountUsdt: pendingUsdt,
        reason: 'No payout wallet configured',
      };
    }

    try {
      let txId: string;
      const amountToSend = Math.floor(pendingUsdt * 1_000_000) / 1_000_000; // Floor to 6 decimals

      if (affiliate.payoutWalletNetwork === 'TRON') {
        // Send from Tron hot wallet
        const result = await this.tronService.sendUsdt(affiliate.payoutWalletAddress, amountToSend);
        txId = result.txId;
      } else if (affiliate.payoutWalletNetwork === 'SOLANA') {
        // Use OKX withdrawal for Solana
        const fee = '1'; // Solana USDT withdrawal fee
        await this.okxService.transferFromTradingToFunding('USDT', amountToSend.toString());
        const result = await this.okxService.withdrawUsdtSimple(
          amountToSend.toFixed(6),
          affiliate.payoutWalletAddress,
          'Solana',
          fee,
        );
        txId = result?.wdId || 'okx-withdrawal';
      } else {
        return {
          settled: false,
          amountUsdt: pendingUsdt,
          reason: `Unsupported payout network: ${affiliate.payoutWalletNetwork}`,
        };
      }

      // Mark all PENDING commissions as PAID
      const pendingCommissions = await this.prisma.affiliateCommission.findMany({
        where: { affiliateId, status: 'PENDING' },
        select: { id: true, commissionBrl: true, commissionUsdt: true },
      });

      const totalBrl = pendingCommissions.reduce((s, c) => s + Number(c.commissionBrl), 0);
      const totalUsdt = pendingCommissions.reduce((s, c) => s + Number(c.commissionUsdt), 0);

      await this.prisma.$transaction([
        this.prisma.affiliateCommission.updateMany({
          where: {
            id: { in: pendingCommissions.map((c) => c.id) },
          },
          data: { status: 'PAID', paidAt: new Date(), settlementTxId: txId },
        }),
        this.prisma.affiliate.update({
          where: { id: affiliateId },
          data: {
            pendingEarnings: { decrement: totalBrl },
            totalEarnings: { increment: totalBrl },
            pendingEarningsUsdt: { decrement: totalUsdt },
            totalEarningsUsdt: { increment: totalUsdt },
          },
        }),
      ]);

      this.logger.log(
        `[Affiliate] Settled ${amountToSend.toFixed(6)} USDT to ${affiliate.code} ` +
        `(${affiliate.payoutWalletNetwork}: ${affiliate.payoutWalletAddress}), txId: ${txId}`,
      );

      return { settled: true, amountUsdt: amountToSend, txId };
    } catch (error: any) {
      this.logger.error(
        `[Affiliate] Settlement failed for ${affiliate.code}: ${error.message}`,
      );
      return {
        settled: false,
        amountUsdt: pendingUsdt,
        reason: `Settlement failed: ${error.message}`,
      };
    }
  }

  /**
   * Returns affiliate info for a customer (for commission calculation).
   * No longer adds to the spread — just provides the affiliate reference.
   */
  async getAffiliateForCustomer(customerId: string): Promise<{
    affiliate: { id: string; code: string; commissionRate: number } | null;
  }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { affiliate: true },
    });

    if (!customer?.affiliate || !customer.affiliate.isActive) {
      return { affiliate: null };
    }

    return {
      affiliate: {
        id: customer.affiliate.id,
        code: customer.affiliate.code,
        commissionRate: Number(customer.affiliate.commissionRate) || DEFAULT_COMMISSION_RATE,
      },
    };
  }

  /**
   * @deprecated Use getAffiliateForCustomer instead. Kept for backward compatibility.
   */
  async getAffiliateSpreadForCustomer(customerId: string): Promise<{
    affiliate: { id: string; code: string; spreadRate: number } | null;
    spreadAffiliate: number;
  }> {
    const result = await this.getAffiliateForCustomer(customerId);

    if (!result.affiliate) {
      return { affiliate: null, spreadAffiliate: 0 };
    }

    return {
      affiliate: {
        id: result.affiliate.id,
        code: result.affiliate.code,
        spreadRate: 0, // No longer adds to spread
      },
      spreadAffiliate: 0, // No longer adds to spread
    };
  }

  async getCommissions(affiliateId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [commissions, total] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where: { affiliateId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.affiliateCommission.count({ where: { affiliateId } }),
    ]);

    return {
      data: commissions.map((c) => ({
        id: c.id,
        customerId: c.customerId,
        transactionId: c.transactionId,
        conversionId: c.conversionId,
        conversionType: c.conversionType,
        transactionAmount: Number(c.transactionAmount),
        spreadBrl: Number(c.spreadBrl),
        commissionRate: Number(c.commissionRate),
        commissionBrl: Number(c.commissionBrl),
        commissionUsdt: Number(c.commissionUsdt),
        exchangeRate: Number(c.exchangeRate),
        status: c.status,
        paidAt: c.paidAt,
        settlementTxId: c.settlementTxId,
        createdAt: c.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async markCommissionsAsPaid(affiliateId: string, commissionIds: string[]) {
    const commissions = await this.prisma.affiliateCommission.findMany({
      where: {
        id: { in: commissionIds },
        affiliateId,
        status: 'PENDING',
      },
    });

    if (commissions.length === 0) {
      throw new NotFoundException('Nenhuma comissão pendente encontrada');
    }

    const totalPaidBrl = commissions.reduce(
      (sum, c) => sum + Number(c.commissionBrl),
      0,
    );
    const totalPaidUsdt = commissions.reduce(
      (sum, c) => sum + Number(c.commissionUsdt),
      0,
    );

    await this.prisma.$transaction([
      this.prisma.affiliateCommission.updateMany({
        where: { id: { in: commissionIds } },
        data: { status: 'PAID', paidAt: new Date() },
      }),
      this.prisma.affiliate.update({
        where: { id: affiliateId },
        data: {
          pendingEarnings: { decrement: totalPaidBrl },
          totalEarnings: { increment: totalPaidBrl },
          pendingEarningsUsdt: { decrement: totalPaidUsdt },
          totalEarningsUsdt: { increment: totalPaidUsdt },
        },
      }),
    ]);

    return { paidCount: commissions.length, totalPaidBrl, totalPaidUsdt };
  }

  async activateForCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, email: true, name: true, phone: true },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const existingAffiliate = await this.prisma.affiliate.findFirst({
      where: { email: customer.email },
    });

    if (existingAffiliate) {
      return {
        success: true,
        data: {
          referralCode: existingAffiliate.code,
          commissionRate: Number(existingAffiliate.commissionRate),
        },
      };
    }

    const code = await this.generateUniqueCode(customer.name);

    const affiliate = await this.prisma.affiliate.create({
      data: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        code,
        commissionRate: DEFAULT_COMMISSION_RATE,
        spreadRate: 0,
        isActive: true,
      },
    });

    return {
      success: true,
      data: {
        referralCode: affiliate.code,
        commissionRate: Number(affiliate.commissionRate),
      },
    };
  }

  private async generateUniqueCode(name: string): Promise<string> {
    const baseName = name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '')
      .substring(0, 6);

    const baseCode = baseName.length >= 3 ? baseName : 'REF' + baseName;

    for (let i = 0; i < 100; i++) {
      const suffix = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      const code = `${baseCode}${suffix}`;

      const exists = await this.prisma.affiliate.findUnique({
        where: { code },
      });

      if (!exists) {
        return code;
      }
    }

    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    return `${baseCode}${timestamp}`;
  }

  async getCustomerAffiliateData(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });

    if (!customer) {
      return { data: null };
    }

    const affiliate = await this.prisma.affiliate.findFirst({
      where: { email: customer.email },
    });

    if (!affiliate) {
      return { data: null };
    }

    const referralCount = await this.prisma.customer.count({
      where: { affiliateId: affiliate.id },
    });

    const activeReferrals = await this.prisma.customer.count({
      where: {
        affiliateId: affiliate.id,
        account: { balance: { gt: 0 } },
      },
    });

    const paidEarnings = Number(affiliate.totalEarnings) - Number(affiliate.pendingEarnings);

    return {
      data: {
        referralCode: affiliate.code,
        totalReferrals: referralCount,
        activeReferrals,
        totalEarnings: Number(affiliate.totalEarnings),
        pendingEarnings: Number(affiliate.pendingEarnings),
        paidEarnings: paidEarnings > 0 ? paidEarnings : 0,
        totalEarningsUsdt: Number(affiliate.totalEarningsUsdt),
        pendingEarningsUsdt: Number(affiliate.pendingEarningsUsdt),
        commissionRate: Number(affiliate.commissionRate),
      },
    };
  }

  async getCustomerReferrals(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });

    if (!customer) {
      return { data: [] };
    }

    const affiliate = await this.prisma.affiliate.findFirst({
      where: { email: customer.email },
    });

    if (!affiliate) {
      return { data: [] };
    }

    const referrals = await this.prisma.customer.findMany({
      where: { affiliateId: affiliate.id },
      include: {
        user: { select: { email: true } },
        account: { select: { balance: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const commissionsByCustomer = await this.prisma.affiliateCommission.groupBy({
      by: ['customerId'],
      where: { affiliateId: affiliate.id },
      _sum: { commissionBrl: true, transactionAmount: true, commissionUsdt: true },
    });

    const commissionMap = new Map<string, { totalVolume: number; commissionEarned: number; commissionEarnedUsdt: number }>(
      commissionsByCustomer.map((c: any) => [
        c.customerId,
        {
          totalVolume: Number(c._sum.transactionAmount || 0),
          commissionEarned: Number(c._sum.commissionBrl || 0),
          commissionEarnedUsdt: Number(c._sum.commissionUsdt || 0),
        },
      ]),
    );

    return {
      data: referrals.map((r: any) => {
        const stats = commissionMap.get(r.id) || { totalVolume: 0, commissionEarned: 0, commissionEarnedUsdt: 0 };
        return {
          id: r.id,
          name: r.name,
          email: r.user?.email || r.email,
          registeredAt: r.createdAt,
          totalVolume: stats.totalVolume,
          commissionEarned: stats.commissionEarned,
          commissionEarnedUsdt: stats.commissionEarnedUsdt,
          status: Number(r.account?.balance || 0) > 0 ? 'active' : 'inactive',
        };
      }),
    };
  }

  async getCustomerCommissions(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });

    if (!customer) {
      return { data: [] };
    }

    const affiliate = await this.prisma.affiliate.findFirst({
      where: { email: customer.email },
    });

    if (!affiliate) {
      return { data: [] };
    }

    const commissions = await this.prisma.affiliateCommission.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
    });

    const customerIds = [...new Set(commissions.map((c) => c.customerId))];
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c.name]));

    return {
      data: commissions.map((c) => ({
        id: c.id,
        referralId: c.customerId,
        referralName: customerMap.get(c.customerId) || null,
        amount: Number(c.commissionBrl),
        amountUsdt: Number(c.commissionUsdt),
        transactionAmount: Number(c.transactionAmount),
        conversionType: c.conversionType,
        status: c.status.toLowerCase(),
        createdAt: c.createdAt,
        paidAt: c.paidAt,
        settlementTxId: c.settlementTxId,
      })),
    };
  }
}
