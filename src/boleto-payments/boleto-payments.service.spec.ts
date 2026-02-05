import { Test, TestingModule } from '@nestjs/testing';
import { BoletoPaymentsService } from './boleto-payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OkxService } from '../okx/services/okx.service';
import { SolanaService } from '../solana/solana.service';
import { TronService } from '../tron/tron.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('BoletoPaymentsService', () => {
  let service: BoletoPaymentsService;

  const mockPrisma = {
    wallet: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    boletoPayment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  const mockOkxService = {
    getBrlToUsdtRate: jest.fn(),
  };

  const mockSolanaService = {
    getSolBalance: jest.fn(),
  };

  const mockTronService = {
    getTrxBalance: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoletoPaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OkxService, useValue: mockOkxService },
        { provide: SolanaService, useValue: mockSolanaService },
        { provide: TronService, useValue: mockTronService },
      ],
    }).compile();

    service = module.get<BoletoPaymentsService>(BoletoPaymentsService);
  });

  describe('getQuote', () => {
    beforeEach(() => {
      mockOkxService.getBrlToUsdtRate.mockResolvedValue(5.5);
    });

    it('should throw BadRequestException for unsupported currency', async () => {
      await expect(service.getQuote(100, 'BTC')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for amount less than R$ 1', async () => {
      await expect(service.getQuote(0.5, 'USDT')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should calculate quote with 3% service fee for USDT', async () => {
      const result = await service.getQuote(100, 'USDT');

      expect(result.boletoAmount).toBe(100);
      expect(result.serviceFee).toBe(3); // 3% of 100
      expect(result.serviceFeePct).toBe(3);
      expect(result.totalBrl).toBe(103); // 100 + 3
      expect(result.cryptoCurrency).toBe('USDT');
      expect(result.exchangeRate).toBe(5.5);
      // cryptoAmount = 103 / 5.5 ≈ 18.72727272
      expect(result.cryptoAmount).toBeGreaterThan(0);
    });
  });

  describe('createBoletoPayment', () => {
    it('should throw BadRequestException for unsupported currency', async () => {
      await expect(
        service.createBoletoPayment('cust-1', '12345', 100, 'w-1', 'BTC'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for amount less than R$ 1', async () => {
      await expect(
        service.createBoletoPayment('cust-1', '12345', 0.5, 'w-1', 'USDT'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty barcode', async () => {
      await expect(
        service.createBoletoPayment('cust-1', '', 100, 'w-1', 'USDT'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when wallet not found', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue(null);

      await expect(
        service.createBoletoPayment(
          'cust-1',
          '12345678901234567890123456789012345678901234567',
          100,
          'w-1',
          'USDT',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when USDT balance is insufficient', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'w-1',
        balance: new Decimal(1),
        network: 'SOLANA',
        externalAddress: 'addr-1',
        isActive: true,
      });
      mockOkxService.getBrlToUsdtRate.mockResolvedValue(5.5);

      await expect(
        service.createBoletoPayment(
          'cust-1',
          '12345678901234567890123456789012345678901234567',
          100,
          'w-1',
          'USDT',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create boleto payment and debit USDT wallet', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'w-1',
        balance: new Decimal(100),
        network: 'SOLANA',
        externalAddress: 'addr-1',
        isActive: true,
      });
      mockOkxService.getBrlToUsdtRate.mockResolvedValue(5.5);
      mockPrisma.wallet.update.mockResolvedValue({});
      mockPrisma.boletoPayment.create.mockResolvedValue({
        id: 'bp-1',
        status: 'PENDING_APPROVAL',
      });

      const result = await service.createBoletoPayment(
        'cust-1',
        '12345678901234567890123456789012345678901234567',
        100,
        'w-1',
        'USDT',
      );

      expect(result.id).toBe('bp-1');
      expect(mockPrisma.wallet.update).toHaveBeenCalled();
      expect(mockPrisma.boletoPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING_APPROVAL',
            customerId: 'cust-1',
          }),
        }),
      );
    });
  });

  describe('cancelBoletoPayment', () => {
    it('should throw NotFoundException when payment not found', async () => {
      mockPrisma.boletoPayment.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelBoletoPayment('bp-1', 'cust-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is not PENDING_APPROVAL', async () => {
      mockPrisma.boletoPayment.findFirst.mockResolvedValue({
        id: 'bp-1',
        status: 'PAID',
        cryptoCurrency: 'USDT',
        cryptoAmount: new Decimal(10),
        walletId: 'w-1',
      });

      await expect(
        service.cancelBoletoPayment('bp-1', 'cust-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should cancel payment and refund USDT to wallet', async () => {
      mockPrisma.boletoPayment.findFirst.mockResolvedValue({
        id: 'bp-1',
        status: 'PENDING_APPROVAL',
        cryptoCurrency: 'USDT',
        cryptoAmount: new Decimal(18.73),
        walletId: 'w-1',
      });
      mockPrisma.wallet.update.mockResolvedValue({});
      mockPrisma.boletoPayment.update.mockResolvedValue({
        id: 'bp-1',
        status: 'CANCELLED',
      });

      const result = await service.cancelBoletoPayment('bp-1', 'cust-1');

      expect(result.status).toBe('CANCELLED');
      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: 'w-1' },
        data: {
          balance: { increment: new Decimal(18.73) },
        },
      });
    });
  });

  describe('adminMarkAsPaid', () => {
    it('should throw NotFoundException when payment not found', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue(null);

      await expect(
        service.adminMarkAsPaid('bp-1', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when status is not PENDING_APPROVAL or ADMIN_PAYING', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'PAID',
      });

      await expect(
        service.adminMarkAsPaid('bp-1', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark as paid from PENDING_APPROVAL status', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'PENDING_APPROVAL',
        customerId: 'cust-1',
      });
      mockPrisma.boletoPayment.update.mockResolvedValue({
        id: 'bp-1',
        status: 'PAID',
        paidByAdminId: 'admin-1',
      });

      const result = await service.adminMarkAsPaid('bp-1', 'admin-1', 'Paid via Inter');

      expect(result.status).toBe('PAID');
      expect(mockPrisma.boletoPayment.update).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
        data: expect.objectContaining({
          status: 'PAID',
          paidByAdminId: 'admin-1',
          adminNotes: 'Paid via Inter',
          paidByAdminAt: expect.any(Date),
        }),
        include: expect.anything(),
      });
    });

    it('should mark as paid from ADMIN_PAYING status', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'ADMIN_PAYING',
        customerId: 'cust-1',
      });
      mockPrisma.boletoPayment.update.mockResolvedValue({
        id: 'bp-1',
        status: 'PAID',
      });

      const result = await service.adminMarkAsPaid('bp-1', 'admin-1');

      expect(result.status).toBe('PAID');
    });
  });

  describe('adminMarkAsProcessing', () => {
    it('should throw NotFoundException when payment not found', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue(null);

      await expect(
        service.adminMarkAsProcessing('bp-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when not in PENDING_APPROVAL status', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'ADMIN_PAYING',
      });

      await expect(
        service.adminMarkAsProcessing('bp-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transition to ADMIN_PAYING from PENDING_APPROVAL', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'PENDING_APPROVAL',
      });
      mockPrisma.boletoPayment.update.mockResolvedValue({
        id: 'bp-1',
        status: 'ADMIN_PAYING',
      });

      const result = await service.adminMarkAsProcessing('bp-1');

      expect(mockPrisma.boletoPayment.update).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
        data: { status: 'ADMIN_PAYING' },
      });
    });
  });

  describe('adminRejectBoletoPayment', () => {
    it('should throw NotFoundException when payment not found', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue(null);

      await expect(
        service.adminRejectBoletoPayment('bp-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid status', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'PAID',
      });

      await expect(
        service.adminRejectBoletoPayment('bp-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject and refund USDT crypto', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'PENDING_APPROVAL',
        cryptoCurrency: 'USDT',
        cryptoAmount: new Decimal(18.73),
        walletId: 'w-1',
      });
      mockPrisma.wallet.update.mockResolvedValue({});
      mockPrisma.boletoPayment.update.mockResolvedValue({
        id: 'bp-1',
        status: 'REFUNDED',
      });

      const result = await service.adminRejectBoletoPayment(
        'bp-1',
        'Boleto inválido',
      );

      expect(result.status).toBe('REFUNDED');
      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: 'w-1' },
        data: { balance: { increment: new Decimal(18.73) } },
      });
      expect(mockPrisma.boletoPayment.update).toHaveBeenCalledWith({
        where: { id: 'bp-1' },
        data: {
          status: 'REFUNDED',
          errorMessage: 'Boleto inválido',
        },
      });
    });

    it('should reject without refunding non-USDT crypto', async () => {
      mockPrisma.boletoPayment.findUnique.mockResolvedValue({
        id: 'bp-1',
        status: 'ADMIN_PAYING',
        cryptoCurrency: 'SOL',
        cryptoAmount: new Decimal(0.5),
        walletId: 'w-1',
      });
      mockPrisma.boletoPayment.update.mockResolvedValue({
        id: 'bp-1',
        status: 'REFUNDED',
      });

      await service.adminRejectBoletoPayment('bp-1');

      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });
  });

  describe('adminGetStats', () => {
    it('should return aggregated stats', async () => {
      mockPrisma.boletoPayment.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(40); // paid
      mockPrisma.boletoPayment.aggregate
        .mockResolvedValueOnce({ _sum: { totalBrl: new Decimal(50000) } })
        .mockResolvedValueOnce({ _sum: { serviceFee: new Decimal(1500) } });

      const result = await service.adminGetStats();

      expect(result.totalCount).toBe(50);
      expect(result.pendingCount).toBe(5);
      expect(result.paidCount).toBe(40);
    });
  });

  describe('adminListBoletoPayments', () => {
    it('should return paginated list', async () => {
      mockPrisma.boletoPayment.findMany.mockResolvedValue([
        { id: 'bp-1', status: 'PENDING_APPROVAL' },
      ]);
      mockPrisma.boletoPayment.count.mockResolvedValue(1);

      const result = await service.adminListBoletoPayments({
        page: 1,
        limit: 20,
      });

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status and customerId', async () => {
      mockPrisma.boletoPayment.findMany.mockResolvedValue([]);
      mockPrisma.boletoPayment.count.mockResolvedValue(0);

      await service.adminListBoletoPayments({
        status: 'PENDING_APPROVAL',
        customerId: 'cust-1',
      });

      expect(mockPrisma.boletoPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING_APPROVAL',
            customerId: 'cust-1',
          },
        }),
      );
    });
  });
});
