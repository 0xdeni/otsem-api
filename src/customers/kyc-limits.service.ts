import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycLevel, CustomerType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface MonthlyUsage {
  customerId: string;
  customerType: CustomerType;
  kycLevel: KycLevel;
  monthlyLimit: number;
  usedThisMonth: number;
  availableThisMonth: number;
  isUnlimited: boolean;
  percentUsed: number;
}

@Injectable()
export class KycLimitsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedKycLevelConfigs();
  }

  private async seedKycLevelConfigs() {
    const configs = [
      { level: KycLevel.LEVEL_1, customerType: CustomerType.PF, monthlyLimit: 30000, description: 'PF Nível 1: até R$ 30.000/mês' },
      { level: KycLevel.LEVEL_2, customerType: CustomerType.PF, monthlyLimit: 100000, description: 'PF Nível 2: até R$ 100.000/mês' },
      { level: KycLevel.LEVEL_3, customerType: CustomerType.PF, monthlyLimit: 0, description: 'PF Nível 3: Ilimitado' },
      { level: KycLevel.LEVEL_1, customerType: CustomerType.PJ, monthlyLimit: 50000, description: 'PJ Nível 1: até R$ 50.000/mês' },
      { level: KycLevel.LEVEL_2, customerType: CustomerType.PJ, monthlyLimit: 200000, description: 'PJ Nível 2: até R$ 200.000/mês' },
      { level: KycLevel.LEVEL_3, customerType: CustomerType.PJ, monthlyLimit: 0, description: 'PJ Nível 3: Ilimitado' },
    ];

    for (const config of configs) {
      await this.prisma.kycLevelConfig.upsert({
        where: {
          level_customerType: {
            level: config.level,
            customerType: config.customerType,
          },
        },
        update: {
          monthlyLimit: config.monthlyLimit,
          description: config.description,
        },
        create: config,
      });
    }
  }

  async getMonthlyLimit(customerType: CustomerType, kycLevel: KycLevel): Promise<number> {
    const config = await this.prisma.kycLevelConfig.findUnique({
      where: {
        level_customerType: {
          level: kycLevel,
          customerType: customerType,
        },
      },
    });

    return config ? Number(config.monthlyLimit) : 0;
  }

  async getMonthlyUsage(customerId: string): Promise<MonthlyUsage> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { type: true, kycLevel: true },
    });

    if (!customer) {
      throw new BadRequestException('Cliente não encontrado');
    }

    const monthlyLimit = await this.getMonthlyLimit(customer.type, customer.kycLevel);
    const isUnlimited = monthlyLimit === 0;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const conversions = await this.prisma.conversion.aggregate({
      where: {
        customerId,
        status: { in: ['COMPLETED', 'USDT_BOUGHT', 'USDT_WITHDRAWN', 'USDT_RECEIVED', 'USDT_SOLD', 'PIX_SENT'] },
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
      _sum: {
        brlCharged: true,
      },
    });

    const account = await this.prisma.account.findFirst({ where: { customerId } });
    let pixOutTotal = 0;
    
    if (account) {
      const pixOuts = await this.prisma.transaction.aggregate({
        where: {
          accountId: account.id,
          type: 'PIX_OUT',
          status: 'COMPLETED',
          createdAt: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      });
      pixOutTotal = Math.abs(Number(pixOuts._sum.amount || 0));
    }

    const conversionsTotal = Number(conversions._sum.brlCharged || 0);
    const usedThisMonth = conversionsTotal + pixOutTotal;

    return {
      customerId,
      customerType: customer.type,
      kycLevel: customer.kycLevel,
      monthlyLimit,
      usedThisMonth,
      availableThisMonth: isUnlimited ? Infinity : Math.max(0, monthlyLimit - usedThisMonth),
      isUnlimited,
      percentUsed: isUnlimited ? 0 : (usedThisMonth / monthlyLimit) * 100,
    };
  }

  async validateTransactionLimit(customerId: string, amount: number): Promise<{ allowed: boolean; message?: string }> {
    const usage = await this.getMonthlyUsage(customerId);

    if (usage.isUnlimited) {
      return { allowed: true };
    }

    if (amount > usage.availableThisMonth) {
      return {
        allowed: false,
        message: `Limite mensal excedido. Disponível: R$ ${usage.availableThisMonth.toFixed(2)}. Solicitado: R$ ${amount.toFixed(2)}. Upgrade para Nível ${this.getNextLevel(usage.kycLevel)} para aumentar seu limite.`,
      };
    }

    return { allowed: true };
  }

  private getNextLevel(currentLevel: KycLevel): string {
    switch (currentLevel) {
      case KycLevel.LEVEL_1:
        return '2';
      case KycLevel.LEVEL_2:
        return '3';
      default:
        return '3';
    }
  }

  async upgradeKycLevel(customerId: string, newLevel: KycLevel): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { kycLevel: newLevel },
    });
  }

  async getAllConfigs() {
    return this.prisma.kycLevelConfig.findMany({
      orderBy: [{ customerType: 'asc' }, { level: 'asc' }],
    });
  }

  async updateConfig(level: KycLevel, customerType: CustomerType, monthlyLimit: number) {
    return this.prisma.kycLevelConfig.update({
      where: {
        level_customerType: { level, customerType },
      },
      data: { monthlyLimit },
    });
  }
}
