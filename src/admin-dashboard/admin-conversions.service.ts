import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryConversionsDto } from './dto/query-conversions.dto';

@Injectable()
export class AdminConversionsService {
  private readonly logger = new Logger(AdminConversionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listConversions(query: QueryConversionsDto) {
    const where: any = {};

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
      where.customerId = query.customerId;
    }
    if (query.affiliateId) {
      where.affiliateId = query.affiliateId;
    }

    const conversions = await this.prisma.conversion.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, email: true, affiliateId: true },
        },
        wallet: {
          select: { id: true, network: true, externalAddress: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const affiliateIds = [
      ...new Set(conversions.map((c) => c.affiliateId).filter(Boolean)),
    ] as string[];

    const affiliates = await this.prisma.affiliate.findMany({
      where: { id: { in: affiliateIds } },
      select: { id: true, code: true, name: true },
    });
    const affiliateMap = new Map(affiliates.map((a) => [a.id, a]));

    const data = conversions.map((conv) => {
      const affiliate = conv.affiliateId
        ? affiliateMap.get(conv.affiliateId)
        : null;

      return {
        id: conv.id,
        createdAt: conv.createdAt,
        status: conv.status,
        customer: conv.customer
          ? { id: conv.customer.id, name: conv.customer.name, email: conv.customer.email }
          : null,
        brlPaid: Math.round(Number(conv.brlCharged) * 100),
        brlCharged: Math.round(Number(conv.brlCharged) * 100),
        brlExchanged: Math.round(Number(conv.brlExchanged) * 100),
        usdtCredited: Math.round(Number(conv.usdtWithdrawn) * 100),
        usdtPurchased: Math.round(Number(conv.usdtPurchased) * 100),
        spreadApplied: Math.round(Number(conv.spreadPercent) * 10000) / 100,
        spreadRate: 1 - Number(conv.spreadPercent),
        exchangeRateBrlUsdt: Math.round(Number(conv.exchangeRate) * 100),
        okxWithdrawFeeBrl: Math.round(Number(conv.okxWithdrawFee) * Number(conv.exchangeRate) * 100),
        okxTradingFeeBrl: Math.round(Number(conv.okxTradingFee) * 100),
        totalOkxFeesBrl: Math.round(Number(conv.totalOkxFees) * 100),
        grossProfitBrl: Math.round(Number(conv.grossProfit) * 100),
        affiliateCommissionBrl: Math.round(Number(conv.affiliateCommission || 0) * 100),
        netProfitBrl: Math.round(Number(conv.netProfit) * 100),
        affiliate: affiliate
          ? { id: affiliate.id, code: affiliate.code, name: affiliate.name }
          : null,
        okxOrderId: conv.okxOrderId,
        okxWithdrawId: conv.okxWithdrawId,
        network: conv.network,
        walletAddress: conv.walletAddress,
        pixEndToEnd: conv.pixEndToEnd,
        sourceOfBRL: 'INTER',
      };
    });

    return { data };
  }

  async getConversionStats(query: QueryConversionsDto) {
    const where: any = {};

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
      where.customerId = query.customerId;
    }
    if (query.affiliateId) {
      where.affiliateId = query.affiliateId;
    }

    const conversions = await this.prisma.conversion.findMany({
      where,
      select: {
        brlCharged: true,
        brlExchanged: true,
        usdtPurchased: true,
        usdtWithdrawn: true,
        spreadBrl: true,
        totalOkxFees: true,
        affiliateCommission: true,
        netProfit: true,
        exchangeRate: true,
      },
    });

    let totalVolumeBrl = 0;
    let totalVolumeUsdt = 0;
    let totalGrossProfit = 0;
    let totalOkxFees = 0;
    let totalCommissions = 0;
    let totalNetProfit = 0;
    let rateSum = 0;
    let rateCount = 0;

    for (const conv of conversions) {
      totalVolumeBrl += Number(conv.brlCharged);
      totalVolumeUsdt += Number(conv.usdtWithdrawn);
      totalGrossProfit += Number(conv.spreadBrl);
      totalOkxFees += Number(conv.totalOkxFees);
      totalCommissions += Number(conv.affiliateCommission || 0);
      totalNetProfit += Number(conv.netProfit);

      const rate = Number(conv.exchangeRate);
      if (rate > 0) {
        rateSum += rate;
        rateCount++;
      }
    }

    return {
      data: {
        totalCount: conversions.length,
        volumeBrl: Math.round(totalVolumeBrl * 100),
        volumeUsdt: Math.round(totalVolumeUsdt * 100),
        grossProfit: Math.round(totalGrossProfit * 100),
        totalOkxFees: Math.round(totalOkxFees * 100),
        totalCommissions: Math.round(totalCommissions * 100),
        netProfit: Math.round(totalNetProfit * 100),
        avgRate: rateCount > 0 ? Math.round((rateSum / rateCount) * 100) : 0,
      },
    };
  }
}
