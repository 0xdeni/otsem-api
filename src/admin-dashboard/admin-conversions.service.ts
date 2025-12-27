import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryConversionsDto } from './dto/query-conversions.dto';

@Injectable()
export class AdminConversionsService {
  private readonly logger = new Logger(AdminConversionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listConversions(query: QueryConversionsDto) {
    const where: any = {
      type: 'CONVERSION',
    };

    if (query.dateStart) {
      where.createdAt = { ...where.createdAt, gte: new Date(query.dateStart) };
    }
    if (query.dateEnd) {
      where.createdAt = { ...where.createdAt, lte: new Date(query.dateEnd) };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.customerId) {
      where.account = { customerId: query.customerId };
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        account: {
          include: {
            customer: {
              select: { id: true, name: true, email: true, affiliateId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const affiliateIds = [
      ...new Set(
        transactions
          .map((t) => t.account?.customer?.affiliateId)
          .filter(Boolean),
      ),
    ] as string[];

    const affiliates = await this.prisma.affiliate.findMany({
      where: { id: { in: affiliateIds } },
      select: { id: true, code: true, name: true },
    });
    const affiliateMap = new Map(affiliates.map((a) => [a.id, a]));

    const commissions = await this.prisma.affiliateCommission.findMany({
      where: {
        transactionId: { in: transactions.map((t) => t.id) },
      },
    });
    const commissionMap = new Map(commissions.map((c) => [c.transactionId, c]));

    let filteredTransactions = transactions;
    if (query.affiliateId) {
      filteredTransactions = transactions.filter(
        (t) => t.account?.customer?.affiliateId === query.affiliateId,
      );
    }

    const data = filteredTransactions.map((tx) => {
      const customer = tx.account?.customer;
      const affiliate = customer?.affiliateId
        ? affiliateMap.get(customer.affiliateId)
        : null;
      const commission = commissionMap.get(tx.id);

      const extData = (tx.externalData as any) || {};
      const spread = extData.spread || {};
      const okxBuyResult = extData.okxBuyResult || {};
      
      const brlPaid = Math.round(Number(tx.amount) * 100);
      const usdtAmount = extData.usdtAmount ? Number(extData.usdtAmount) : 0;
      const usdtCredited = Math.round(usdtAmount * 100);
      
      const spreadBrl = spread.spreadBrl ? Number(spread.spreadBrl) : 0;
      const spreadRate = spread.spreadRate ? Number(spread.spreadRate) : 1;
      const spreadPercent = spreadRate < 1 ? Math.round((1 - spreadRate) * 10000) / 100 : 0;
      
      const chargedBrl = spread.chargedBrl ? Number(spread.chargedBrl) : Number(tx.amount);
      const exchangedBrl = spread.exchangedBrl ? Number(spread.exchangedBrl) : chargedBrl;
      const exchangeRate = usdtAmount > 0 ? Math.round((exchangedBrl / usdtAmount) * 100) : 0;
      
      const profitBrl = Math.round(spreadBrl * 100);
      
      const okxOrderId = okxBuyResult.orderId || null;

      return {
        id: tx.id,
        createdAt: tx.createdAt,
        status: tx.status,
        customer: customer
          ? { id: customer.id, name: customer.name, email: customer.email }
          : null,
        brlPaid,
        usdtCredited,
        exchangeRateUsed: exchangeRate,
        spreadPercent,
        pixFee: 0,
        okxFee: 0,
        internalFee: 0,
        totalFeesBrl: 0,
        profitBrl,
        affiliate: affiliate
          ? { id: affiliate.id, code: affiliate.code, name: affiliate.name }
          : null,
        affiliateCommissionBrl: commission
          ? Math.round(Number(commission.commissionBrl) * 100)
          : 0,
        okxOrderId,
        sourceOfBRL: 'INTER',
      };
    });

    return { data };
  }

  async getConversionStats(query: QueryConversionsDto) {
    const where: any = {
      type: 'CONVERSION',
    };

    if (query.dateStart) {
      where.createdAt = { ...where.createdAt, gte: new Date(query.dateStart) };
    }
    if (query.dateEnd) {
      where.createdAt = { ...where.createdAt, lte: new Date(query.dateEnd) };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.customerId) {
      where.account = { customerId: query.customerId };
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        account: {
          include: {
            customer: { select: { affiliateId: true } },
          },
        },
      },
    });

    let filteredTransactions = transactions;
    if (query.affiliateId) {
      filteredTransactions = transactions.filter(
        (t) => t.account?.customer?.affiliateId === query.affiliateId,
      );
    }

    const commissions = await this.prisma.affiliateCommission.findMany({
      where: {
        transactionId: { in: filteredTransactions.map((t) => t.id) },
      },
    });

    let totalVolumeBrl = 0;
    let totalVolumeUsdt = 0;
    let totalProfit = 0;
    let rateSum = 0;
    let rateCount = 0;

    for (const tx of filteredTransactions) {
      const extData = (tx.externalData as any) || {};
      const spread = extData.spread || {};
      
      const brlPaid = Number(tx.amount);
      const usdtAmount = extData.usdtAmount ? Number(extData.usdtAmount) : 0;
      const spreadBrl = spread.spreadBrl ? Number(spread.spreadBrl) : 0;
      const exchangedBrl = spread.exchangedBrl ? Number(spread.exchangedBrl) : brlPaid;
      const exchangeRate = usdtAmount > 0 ? exchangedBrl / usdtAmount : 0;

      totalVolumeBrl += brlPaid;
      totalVolumeUsdt += usdtAmount;
      totalProfit += spreadBrl;

      if (exchangeRate > 0) {
        rateSum += exchangeRate;
        rateCount++;
      }
    }

    const totalCommissions = commissions.reduce(
      (sum, c) => sum + Number(c.commissionBrl),
      0,
    );
    const netProfit = totalProfit - totalCommissions;

    return {
      data: {
        totalCount: filteredTransactions.length,
        volumeBrl: Math.round(totalVolumeBrl * 100),
        volumeUsdt: Math.round(totalVolumeUsdt * 100),
        grossProfit: Math.round(totalProfit * 100),
        netProfit: Math.round(netProfit * 100),
        avgRate: rateCount > 0 ? Math.round((rateSum / rateCount) * 100) : 0,
        totalCommissions: Math.round(totalCommissions * 100),
      },
    };
  }
}
