import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('TransactionsService', () => {
  let service: TransactionsService;

  // Helper to create a mock prisma transaction callback runner
  const createMockTx = (overrides: Record<string, any> = {}) => ({
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
    ...overrides,
  });

  const mockPrisma = {
    $transaction: jest.fn(),
    transaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('processPixDeposit', () => {
    it('should throw BadRequestException when pix key not found', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.processPixDeposit('invalid-key', 100, {}, 'ext-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when account is inactive', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        pixKey: 'pix-1',
        status: 'inactive',
        customer: { name: 'Test' },
      });
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.processPixDeposit('pix-1', 100, {}, 'ext-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing transaction when already processed (idempotent)', async () => {
      const existingTx = { id: 'tx-existing', externalId: 'ext-1' };
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        status: 'active',
        balance: new Prisma.Decimal(100),
        customer: { name: 'Test' },
      });
      mockTx.transaction.findUnique.mockResolvedValue(existingTx);
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      const result = await service.processPixDeposit(
        'pix-1',
        100,
        {},
        'ext-1',
      );

      expect(result).toEqual(existingTx);
      expect(mockTx.transaction.create).not.toHaveBeenCalled();
    });

    it('should create transaction and update balance on new deposit', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        status: 'active',
        balance: new Prisma.Decimal(500),
        customer: { name: 'Test User' },
      });
      mockTx.transaction.findUnique.mockResolvedValue(null);
      mockTx.transaction.create.mockResolvedValue({
        id: 'tx-new',
        amount: 100,
      });
      mockTx.account.update.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      const result = await service.processPixDeposit(
        'pix-1',
        100,
        { nome: 'Payer' },
        'ext-new',
      );

      expect(result.id).toBe('tx-new');
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'acc-1',
          type: 'PIX_IN',
          amount: 100,
          status: 'COMPLETED',
        }),
      });
      expect(mockTx.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { balance: new Prisma.Decimal(500).add(100) },
      });
    });
  });

  describe('processPixWithdraw', () => {
    it('should throw BadRequestException when account not found', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.processPixWithdraw('cust-1', 100, 'pix-dest'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when balance is insufficient', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        status: 'active',
        balance: new Prisma.Decimal(50),
        blockedAmount: new Prisma.Decimal(0),
      });
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.processPixWithdraw('cust-1', 100, 'pix-dest'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should consider blocked amount when checking balance', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        status: 'active',
        balance: new Prisma.Decimal(200),
        blockedAmount: new Prisma.Decimal(150),
      });
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.processPixWithdraw('cust-1', 100, 'pix-dest'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create withdraw transaction with PROCESSING status', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        status: 'active',
        balance: new Prisma.Decimal(500),
        blockedAmount: new Prisma.Decimal(0),
      });
      mockTx.transaction.create.mockResolvedValue({
        id: 'tx-withdraw',
        type: 'PIX_OUT',
      });
      mockTx.account.update.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      const result = await service.processPixWithdraw(
        'cust-1',
        100,
        'pix-dest',
      );

      expect(result.type).toBe('PIX_OUT');
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PIX_OUT',
          status: 'PROCESSING',
        }),
      });
    });
  });

  describe('processTransfer', () => {
    it('should throw BadRequestException when source account not found', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.processTransfer('cust-1', 'dest-pix', 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when destination pix key not found', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique
        .mockResolvedValueOnce({
          id: 'acc-1',
          balance: new Prisma.Decimal(500),
          blockedAmount: new Prisma.Decimal(0),
        })
        .mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.processTransfer('cust-1', 'nonexistent-pix', 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when transferring to self', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique
        .mockResolvedValueOnce({
          id: 'acc-1',
          balance: new Prisma.Decimal(500),
          blockedAmount: new Prisma.Decimal(0),
        })
        .mockResolvedValueOnce({ id: 'acc-1' });
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.processTransfer('cust-1', 'my-pix', 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create two transactions (out and in) on successful transfer', async () => {
      const mockTx = createMockTx();
      mockTx.account.findUnique
        .mockResolvedValueOnce({
          id: 'acc-from',
          balance: new Prisma.Decimal(500),
          blockedAmount: new Prisma.Decimal(0),
        })
        .mockResolvedValueOnce({
          id: 'acc-to',
          balance: new Prisma.Decimal(200),
        });
      mockTx.transaction.create
        .mockResolvedValueOnce({ id: 'tx-out', type: 'TRANSFER_OUT' })
        .mockResolvedValueOnce({ id: 'tx-in', type: 'TRANSFER_IN' });
      mockTx.account.update.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      const result = await service.processTransfer(
        'cust-from',
        'dest-pix',
        100,
      );

      expect(result.txOut.type).toBe('TRANSFER_OUT');
      expect(result.txIn.type).toBe('TRANSFER_IN');
      expect(mockTx.account.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('findByAccount', () => {
    it('should return paginated transactions', async () => {
      const transactions = [
        { id: 'tx-1', type: 'PIX_IN', amount: 100 },
        { id: 'tx-2', type: 'PIX_OUT', amount: 50 },
      ];
      mockPrisma.transaction.findMany.mockResolvedValue(transactions);
      mockPrisma.transaction.count.mockResolvedValue(15);

      const result = await service.findByAccount('acc-1', 1, 10);

      expect(result.data).toEqual(transactions);
      expect(result.total).toBe(15);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
    });

    it('should calculate pagination correctly for last page', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(15);

      const result = await service.findByAccount('acc-1', 2, 10);

      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status', async () => {
      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-1',
        status: 'COMPLETED',
      });

      await service.updateStatus('tx-1', 'COMPLETED');

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should not set completedAt for non-COMPLETED status', async () => {
      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-1',
        status: 'PROCESSING',
      });

      await service.updateStatus('tx-1', 'PROCESSING');

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: 'PROCESSING' },
      });
    });
  });

  describe('reverseTransaction', () => {
    it('should throw BadRequestException when transaction not found', async () => {
      const mockTx = createMockTx();
      mockTx.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.reverseTransaction('nonexistent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when transaction already reversed', async () => {
      const mockTx = createMockTx();
      mockTx.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        status: 'REVERSED',
        account: { balance: new Prisma.Decimal(500) },
      });
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(service.reverseTransaction('tx-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create reverse transaction and update balance for PIX_IN', async () => {
      const mockTx = createMockTx();
      mockTx.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        type: 'PIX_IN',
        amount: new Prisma.Decimal(100),
        accountId: 'acc-1',
        status: 'COMPLETED',
        description: 'Pix recebido',
        account: { id: 'acc-1', balance: new Prisma.Decimal(500) },
      });
      mockTx.transaction.create.mockResolvedValue({
        id: 'tx-reverse',
        type: 'PIX_OUT',
      });
      mockTx.transaction.update.mockResolvedValue({});
      mockTx.account.update.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

      const result = await service.reverseTransaction('tx-1', 'Refund');

      expect(result.type).toBe('PIX_OUT');
      expect(mockTx.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          balance: new Prisma.Decimal(500).sub(new Prisma.Decimal(100)),
        },
      });
    });
  });

  describe('getReceipt', () => {
    it('should throw NotFoundException when transaction not found', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.getReceipt('nonexistent', 'cust-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when customer does not own transaction', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        type: 'PIX_IN',
        account: {
          customerId: 'other-customer',
          customer: { id: 'other-customer', name: 'Other', cpf: '12345678901', cnpj: null, type: 'PF' },
        },
      });

      await expect(
        service.getReceipt('tx-1', 'cust-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for non-PIX transactions', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        type: 'TRANSFER_IN',
        account: {
          customerId: 'cust-1',
          customer: { id: 'cust-1', name: 'Test', cpf: '12345678901', cnpj: null, type: 'PF' },
        },
      });

      await expect(
        service.getReceipt('tx-1', 'cust-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return PIX_IN receipt with correct title', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        type: 'PIX_IN',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(100),
        createdAt: new Date('2024-01-15'),
        completedAt: new Date('2024-01-15'),
        endToEnd: 'E2E123',
        txid: 'TXI123',
        description: 'Pix recebido',
        payerName: 'Payer Name',
        payerTaxNumber: '12345678901',
        bankProvider: 'INTER',
        payerMessage: null,
        pixKey: 'pix-key-1',
        account: {
          customerId: 'cust-1',
          pixKey: 'pix-key-1',
          customer: {
            id: 'cust-1',
            name: 'Test Customer',
            cpf: '98765432100',
            cnpj: null,
            type: 'PF',
          },
        },
      });

      const result = await service.getReceipt('tx-1', 'cust-1');

      expect(result.title).toBe('Comprovante de Depósito PIX');
      expect(result.type).toBe('PIX_IN');
      expect(result.amount).toBe(100);
      expect(result.payer.name).toBe('Payer Name');
      expect(result.receiver.name).toBe('Test Customer');
    });
  });

  describe('maskTaxNumber (via getReceipt)', () => {
    it('should mask CPF correctly', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        type: 'PIX_IN',
        status: 'COMPLETED',
        amount: new Prisma.Decimal(100),
        createdAt: new Date(),
        completedAt: null,
        endToEnd: null,
        txid: null,
        description: null,
        payerName: 'Test',
        payerTaxNumber: '12345678901', // CPF
        bankProvider: null,
        payerMessage: null,
        pixKey: null,
        account: {
          customerId: 'cust-1',
          pixKey: null,
          customer: { id: 'cust-1', name: 'Customer', cpf: '98765432100', cnpj: null, type: 'PF' },
        },
      });

      const result = await service.getReceipt('tx-1', 'cust-1');

      // CPF mask: ***456789**
      expect(result.payer.taxNumber).toBe('***456789**');
    });
  });
});
