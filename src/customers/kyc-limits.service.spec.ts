import { Test, TestingModule } from '@nestjs/testing';
import { KycLimitsService } from './kyc-limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('KycLimitsService', () => {
  let service: KycLimitsService;

  const mockPrisma = {
    kycLevelConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversion: {
      aggregate: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    transaction: {
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycLimitsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<KycLimitsService>(KycLimitsService);
  });

  describe('getMonthlyLimit', () => {
    it('should return monthly limit from config', async () => {
      mockPrisma.kycLevelConfig.findUnique.mockResolvedValue({
        monthlyLimit: 30000,
      });

      const limit = await service.getMonthlyLimit('PF' as any, 'LEVEL_1' as any);

      expect(limit).toBe(30000);
    });

    it('should return 0 when config not found', async () => {
      mockPrisma.kycLevelConfig.findUnique.mockResolvedValue(null);

      const limit = await service.getMonthlyLimit('PF' as any, 'LEVEL_1' as any);

      expect(limit).toBe(0);
    });
  });

  describe('getMonthlyUsage', () => {
    it('should throw BadRequestException when customer not found', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.getMonthlyUsage('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should calculate monthly usage from conversions and pix outs', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        type: 'PF',
        kycLevel: 'LEVEL_1',
      });
      mockPrisma.kycLevelConfig.findUnique.mockResolvedValue({
        monthlyLimit: 30000,
      });
      mockPrisma.conversion.aggregate.mockResolvedValue({
        _sum: { brlCharged: 5000 },
      });
      mockPrisma.account.findFirst.mockResolvedValue({ id: 'acc-1' });
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: -2000 },
      });

      const result = await service.getMonthlyUsage('cust-1');

      expect(result.customerId).toBe('cust-1');
      expect(result.monthlyLimit).toBe(30000);
      expect(result.usedThisMonth).toBe(7000); // 5000 conversions + 2000 pix out
      expect(result.availableThisMonth).toBe(23000);
      expect(result.isUnlimited).toBe(false);
    });

    it('should return unlimited for LEVEL_3', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        type: 'PF',
        kycLevel: 'LEVEL_3',
      });
      mockPrisma.kycLevelConfig.findUnique.mockResolvedValue({
        monthlyLimit: 0,
      });
      mockPrisma.conversion.aggregate.mockResolvedValue({
        _sum: { brlCharged: 0 },
      });
      mockPrisma.account.findFirst.mockResolvedValue(null);

      const result = await service.getMonthlyUsage('cust-1');

      expect(result.isUnlimited).toBe(true);
      expect(result.availableThisMonth).toBe(Infinity);
      expect(result.percentUsed).toBe(0);
    });
  });

  describe('validateTransactionLimit', () => {
    it('should allow transaction when unlimited', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        type: 'PF',
        kycLevel: 'LEVEL_3',
      });
      mockPrisma.kycLevelConfig.findUnique.mockResolvedValue({
        monthlyLimit: 0,
      });
      mockPrisma.conversion.aggregate.mockResolvedValue({
        _sum: { brlCharged: 0 },
      });
      mockPrisma.account.findFirst.mockResolvedValue(null);

      const result = await service.validateTransactionLimit(
        'cust-1',
        999999,
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny transaction when limit exceeded', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        type: 'PF',
        kycLevel: 'LEVEL_1',
      });
      mockPrisma.kycLevelConfig.findUnique.mockResolvedValue({
        monthlyLimit: 30000,
      });
      mockPrisma.conversion.aggregate.mockResolvedValue({
        _sum: { brlCharged: 25000 },
      });
      mockPrisma.account.findFirst.mockResolvedValue({ id: 'acc-1' });
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });

      const result = await service.validateTransactionLimit('cust-1', 10000);

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Limite mensal excedido');
      expect(result.message).toContain('Nível 2');
    });

    it('should allow transaction within limits', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        type: 'PF',
        kycLevel: 'LEVEL_1',
      });
      mockPrisma.kycLevelConfig.findUnique.mockResolvedValue({
        monthlyLimit: 30000,
      });
      mockPrisma.conversion.aggregate.mockResolvedValue({
        _sum: { brlCharged: 10000 },
      });
      mockPrisma.account.findFirst.mockResolvedValue({ id: 'acc-1' });
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });

      const result = await service.validateTransactionLimit('cust-1', 5000);

      expect(result.allowed).toBe(true);
    });
  });

  describe('upgradeKycLevel', () => {
    it('should update customer KYC level', async () => {
      mockPrisma.customer.update.mockResolvedValue({});

      await service.upgradeKycLevel('cust-1', 'LEVEL_2' as any);

      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { kycLevel: 'LEVEL_2' },
      });
    });
  });

  describe('getAllConfigs', () => {
    it('should return all KYC level configs sorted', async () => {
      const configs = [
        { level: 'LEVEL_1', customerType: 'PF', monthlyLimit: 30000 },
        { level: 'LEVEL_1', customerType: 'PJ', monthlyLimit: 50000 },
      ];
      mockPrisma.kycLevelConfig.findMany.mockResolvedValue(configs);

      const result = await service.getAllConfigs();

      expect(result).toEqual(configs);
    });
  });

  describe('updateConfig', () => {
    it('should update the monthly limit for a config', async () => {
      mockPrisma.kycLevelConfig.update.mockResolvedValue({
        level: 'LEVEL_1',
        customerType: 'PF',
        monthlyLimit: 50000,
      });

      const result = await service.updateConfig(
        'LEVEL_1' as any,
        'PF' as any,
        50000,
      );

      expect(mockPrisma.kycLevelConfig.update).toHaveBeenCalledWith({
        where: {
          level_customerType: { level: 'LEVEL_1', customerType: 'PF' },
        },
        data: { monthlyLimit: 50000 },
      });
    });
  });
});
