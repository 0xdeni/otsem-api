import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { BankingGatewayService } from '../banking/banking-gateway.service';
import { OkxService } from '../okx/services/okx.service';
import { TronService } from '../tron/tron.service';
import { SolanaService } from '../solana/solana.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { KycLimitsService } from '../customers/kyc-limits.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { decryptPrivateKey, encryptPrivateKey } from './wallet-crypto.util';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

const ECPair = ECPairFactory(ecc);

describe('WalletService', () => {
  let service: WalletService;

  const mockPrisma = {
    wallet: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
    conversion: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockBankingGateway = {
    sendPix: jest.fn(),
  };

  const mockOkxService = {
    getBrlToUsdtRate: jest.fn(),
    buyAndCheckHistory: jest.fn(),
    transferFromTradingToFunding: jest.fn(),
    withdrawUsdtSimple: jest.fn(),
    sellAndCheckHistory: jest.fn(),
    transferUsdtToTrading: jest.fn(),
    getDepositAddress: jest.fn(),
    getRecentDeposits: jest.fn(),
  };

  const mockTronService = {
    createWallet: jest.fn(),
    getUsdtBalance: jest.fn(),
    isValidAddress: jest.fn(),
    sendUsdtWithKey: jest.fn(),
    getTrxBalance: jest.fn(),
    sendTrx: jest.fn(),
    sendTrxWithKey: jest.fn(),
  };

  const mockSolanaService = {
    isValidAddress: jest.fn(),
    getSolBalance: jest.fn(),
    sendSol: jest.fn(),
    getAssociatedTokenAddress: jest.fn(),
    checkAtaExists: jest.fn(),
  };

  const mockAffiliatesService = {
    getAffiliateForCustomer: jest.fn(),
    recordCommission: jest.fn(),
    settleCommissionUsdt: jest.fn(),
  };

  const mockKycLimitsService = {
    validateTransactionLimit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.WALLET_ENCRYPTION_KEY = 'test-wallet-encryption-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BankingGatewayService, useValue: mockBankingGateway },
        { provide: OkxService, useValue: mockOkxService },
        { provide: TronService, useValue: mockTronService },
        { provide: SolanaService, useValue: mockSolanaService },
        { provide: AffiliatesService, useValue: mockAffiliatesService },
        { provide: KycLimitsService, useValue: mockKycLimitsService },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  describe('createWallet', () => {
    it('should throw BadRequestException when wallet already exists', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'existing-wallet',
      });

      await expect(
        service.createWallet('cust-1', 'SOLANA' as any, 'some-address'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create wallet successfully', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue(null);
      const createdWallet = {
        id: 'wallet-1',
        customerId: 'cust-1',
        network: 'SOLANA',
        externalAddress: 'addr-1',
        currency: 'USDT',
        isMain: false,
        balance: 0,
      };
      mockPrisma.wallet.create.mockResolvedValue(createdWallet);

      const result = await service.createWallet(
        'cust-1',
        'SOLANA' as any,
        'addr-1',
      );

      expect(result).toEqual(createdWallet);
      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'cust-1',
          network: 'SOLANA',
          externalAddress: 'addr-1',
          currency: 'USDT',
          isMain: false,
        }),
      });
    });

    it('should unset other main wallets when isMain is true', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue(null);
      mockPrisma.wallet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.wallet.create.mockResolvedValue({ id: 'wallet-new' });

      await service.createWallet('cust-1', 'SOLANA' as any, 'addr-1', {
        isMain: true,
      });

      expect(mockPrisma.wallet.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', network: 'SOLANA', isMain: true },
        data: { isMain: false },
      });
    });

    it('should handle P2002 (unique constraint) error', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue(null);
      mockPrisma.wallet.create.mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint',
      });

      await expect(
        service.createWallet('cust-1', 'SOLANA' as any, 'addr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle P2003 (foreign key) error', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue(null);
      mockPrisma.wallet.create.mockRejectedValue({
        code: 'P2003',
        message: 'Foreign key constraint',
      });

      await expect(
        service.createWallet('nonexistent', 'SOLANA' as any, 'addr-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getWalletById', () => {
    it('should throw NotFoundException when wallet not found', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);

      await expect(service.getWalletById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when wallet does not belong to customer', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        customerId: 'other-customer',
      });

      await expect(
        service.getWalletById('wallet-1', 'cust-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return wallet when found and belongs to customer', async () => {
      const wallet = { id: 'wallet-1', customerId: 'cust-1' };
      mockPrisma.wallet.findUnique.mockResolvedValue(wallet);

      const result = await service.getWalletById('wallet-1', 'cust-1');

      expect(result).toEqual(wallet);
    });

    it('should return wallet without customer check when customerId not provided', async () => {
      const wallet = { id: 'wallet-1', customerId: 'any-customer' };
      mockPrisma.wallet.findUnique.mockResolvedValue(wallet);

      const result = await service.getWalletById('wallet-1');

      expect(result).toEqual(wallet);
    });
  });

  describe('getWalletsByCustomer', () => {
    it('should return wallets for customer', async () => {
      const wallets = [
        { id: 'w1', customerId: 'cust-1', network: 'SOLANA' },
        { id: 'w2', customerId: 'cust-1', network: 'TRON' },
      ];
      mockPrisma.wallet.findMany.mockResolvedValue(wallets);

      const result = await service.getWalletsByCustomer('cust-1');

      expect(result).toEqual(wallets);
    });

    it('should filter by network when provided', async () => {
      mockPrisma.wallet.findMany.mockResolvedValue([]);

      await service.getWalletsByCustomer('cust-1', 'SOLANA' as any);

      expect(mockPrisma.wallet.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', network: 'SOLANA' },
        orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('deleteWallet', () => {
    it('should throw BadRequestException when deleting main wallet', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        customerId: 'cust-1',
        isMain: true,
      });

      await expect(
        service.deleteWallet('wallet-1', 'cust-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete non-main wallet successfully', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        customerId: 'cust-1',
        isMain: false,
      });
      mockPrisma.wallet.delete.mockResolvedValue({ id: 'wallet-1' });

      const result = await service.deleteWallet('wallet-1', 'cust-1');

      expect(mockPrisma.wallet.delete).toHaveBeenCalledWith({
        where: { id: 'wallet-1' },
      });
    });
  });

  describe('setMainWallet', () => {
    it('should unset previous main and set new main wallet', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        customerId: 'cust-1',
        network: 'SOLANA',
      });
      mockPrisma.wallet.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.wallet.update.mockResolvedValue({
        id: 'wallet-1',
        isMain: true,
      });

      const result = await service.setMainWallet('wallet-1', 'cust-1');

      expect(mockPrisma.wallet.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', network: 'SOLANA', isMain: true },
        data: { isMain: false },
      });
      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet-1' },
        data: { isMain: true },
      });
    });
  });

  describe('importWallet', () => {
    it('should validate TRON address before importing', async () => {
      mockTronService.isValidAddress.mockResolvedValue(false);

      await expect(
        service.importWallet('cust-1', 'TRON' as any, 'invalid-addr'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate SOLANA address before importing', async () => {
      mockSolanaService.isValidAddress.mockResolvedValue(false);

      await expect(
        service.importWallet('cust-1', 'SOLANA' as any, 'invalid-addr'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should import wallet when address is valid', async () => {
      mockTronService.isValidAddress.mockResolvedValue(true);
      mockPrisma.wallet.findFirst.mockResolvedValue(null); // no existing main
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      mockPrisma.wallet.create.mockResolvedValue({
        id: 'wallet-imported',
        network: 'TRON',
      });

      const result = await service.importWallet(
        'cust-1',
        'TRON' as any,
        'valid-addr',
        'My Wallet',
      );

      expect(result).toBeDefined();
    });
  });

  describe('getUsdtQuote', () => {
    beforeEach(() => {
      mockPrisma.account.findFirst.mockResolvedValue({
        balance: 1000,
      });
      mockPrisma.customer.findUnique.mockResolvedValue({
        user: { spreadValue: null },
      });
      mockOkxService.getBrlToUsdtRate.mockResolvedValue(5.5);
    });

    it('should calculate USDT quote correctly with no spread', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'w1',
        externalAddress: 'addr-1',
        network: 'SOLANA',
        okxWhitelisted: true,
      });

      const result = await service.getUsdtQuote('cust-1', 100);

      expect(result.brlAmount).toBe(100);
      expect(result.exchangeRate).toBe(5.5);
      expect(result.balanceBrl).toBe(1000);
      expect(result.networkFeePaidBy).toBe('BUYER');
    });

    it('should return canProceed=false when balance is insufficient', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        balance: 5,
      });
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'w1',
        externalAddress: 'addr-1',
        network: 'SOLANA',
        okxWhitelisted: true,
      });

      const result = await service.getUsdtQuote('cust-1', 100);

      expect(result.canProceed).toBe(false);
    });

    it('should use TRON network fee when wallet is TRON', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'w1',
        externalAddress: 'addr-1',
        network: 'TRON',
        okxWhitelisted: true,
      });

      const result = await service.getUsdtQuote('cust-1', 100);

      expect(result.networkFeeUsdt).toBe(2.1);
    });

    it('should not block quote when wallet is not marked as whitelisted', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'w1',
        externalAddress: 'addr-1',
        network: 'SOLANA',
        okxWhitelisted: false,
      });

      const result = await service.getUsdtQuote('cust-1', 100);

      expect(result.canProceed).toBe(true);
      expect(result.wallet?.whitelisted).toBe(false);
    });
  });

  describe('buyUsdtWithBrl', () => {
    it('should throw BadRequestException when balance is insufficient', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        balance: 5,
      });

      await expect(
        service.buyUsdtWithBrl('cust-1', 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is below minimum', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        balance: 1000,
      });

      await expect(
        service.buyUsdtWithBrl('cust-1', 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when KYC limit exceeded', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        balance: 50000,
      });
      mockKycLimitsService.validateTransactionLimit.mockResolvedValue({
        allowed: false,
        message: 'Limit exceeded',
      });

      await expect(
        service.buyUsdtWithBrl('cust-1', 40000),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no wallet found', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({
        id: 'acc-1',
        balance: 1000,
      });
      mockKycLimitsService.validateTransactionLimit.mockResolvedValue({
        allowed: true,
      });
      mockPrisma.customer.findUnique.mockResolvedValue({
        user: { spreadValue: null },
        affiliateId: null,
      });
      mockAffiliatesService.getAffiliateForCustomer.mockResolvedValue({
        affiliate: null,
      });
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      mockPrisma.wallet.findFirst.mockResolvedValue(null);

      await expect(
        service.buyUsdtWithBrl('cust-1', 100),
      ).rejects.toThrow(BadRequestException);
    });

  });

  describe('sellUsdtForBrl', () => {
    it('should throw error when amount is less than 1', async () => {
      await expect(
        service.sellUsdtForBrl('cust-1', 0.5),
      ).rejects.toThrow('Quantidade mínima é 1 USDT');
    });

    it('should throw error when account not found', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.sellUsdtForBrl('cust-1', 10),
      ).rejects.toThrow('Conta não encontrada para o cliente');
    });
  });

  describe('setOkxWhitelisted', () => {
    it('should throw NotFoundException when wallet not found', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue(null);

      await expect(
        service.setOkxWhitelisted('w-1', 'cust-1', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update okxWhitelisted flag', async () => {
      mockPrisma.wallet.findFirst.mockResolvedValue({
        id: 'w-1',
        customerId: 'cust-1',
      });
      mockPrisma.wallet.update.mockResolvedValue({
        id: 'w-1',
        okxWhitelisted: true,
      });

      const result = await service.setOkxWhitelisted(
        'w-1',
        'cust-1',
        true,
      );

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: 'w-1' },
        data: { okxWhitelisted: true },
      });
    });
  });

  describe('getUsdtDepositAddress', () => {
    it('should return TRON deposit address', async () => {
      process.env.OKX_TRON_DEPOSIT_ADDRESS = 'TRON-DEPOSIT-ADDR';

      const result = await service.getUsdtDepositAddress('TRON');

      expect(result.network).toBe('TRON');
      expect(result.chain).toBe('TRC20');
      expect(result.address).toBe('TRON-DEPOSIT-ADDR');
    });

    it('should return SOLANA deposit address', async () => {
      process.env.OKX_SOLANA_DEPOSIT_ADDRESS = 'SOL-DEPOSIT-ADDR';

      const result = await service.getUsdtDepositAddress('SOLANA');

      expect(result.network).toBe('SOLANA');
      expect(result.chain).toBe('Solana');
      expect(result.address).toBe('SOL-DEPOSIT-ADDR');
    });

    it('should throw when TRON deposit address not configured', async () => {
      delete process.env.OKX_TRON_DEPOSIT_ADDRESS;

      await expect(
        service.getUsdtDepositAddress('TRON'),
      ).rejects.toThrow('Endereço de depósito TRON não configurado');
    });

    it('should throw when SOLANA deposit address not configured', async () => {
      delete process.env.OKX_SOLANA_DEPOSIT_ADDRESS;

      await expect(
        service.getUsdtDepositAddress('SOLANA'),
      ).rejects.toThrow('Endereço de depósito Solana não configurado');
    });
  });

  describe('getConversionStatusLabel (via getCustomerConversions)', () => {
    it('should return buy status labels', async () => {
      mockPrisma.conversion.findMany.mockResolvedValue([
        {
          id: 'c1',
          type: 'BUY',
          status: 'COMPLETED',
          network: 'SOLANA',
          walletAddress: 'addr',
          usdtPurchased: 100,
          brlCharged: 550,
          brlExchanged: 540,
          spreadBrl: 10,
          txHash: null,
          createdAt: new Date(),
          completedAt: new Date(),
          errorMessage: null,
        },
      ]);

      const result = await service.getCustomerConversions('cust-1');

      expect(result[0].statusLabel).toBe('Concluído - USDT enviado!');
    });

    it('should return sell status labels', async () => {
      mockPrisma.conversion.findMany.mockResolvedValue([
        {
          id: 'c2',
          type: 'SELL',
          status: 'PENDING',
          network: 'TRON',
          walletAddress: 'addr',
          usdtPurchased: 50,
          brlCharged: 0,
          brlExchanged: 275,
          spreadBrl: 5,
          txHash: 'tx123',
          createdAt: new Date(),
          completedAt: null,
          errorMessage: null,
        },
      ]);

      const result = await service.getCustomerConversions('cust-1');

      expect(result[0].statusLabel).toBe(
        'Aguardando confirmação do depósito',
      );
    });
  });

  describe('getConversionDetails', () => {
    it('should throw NotFoundException when conversion not found', async () => {
      mockPrisma.conversion.findFirst.mockResolvedValue(null);

      await expect(
        service.getConversionDetails('cust-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return conversion details', async () => {
      mockPrisma.conversion.findFirst.mockResolvedValue({
        id: 'c1',
        type: 'BUY',
        status: 'COMPLETED',
        network: 'SOLANA',
        usdtPurchased: 100,
        brlCharged: 550,
        brlExchanged: 540,
        spreadBrl: 10,
        exchangeRate: 5.4,
        txHash: null,
        walletAddress: 'addr-1',
        wallet: { externalAddress: 'addr-1', network: 'SOLANA', label: 'My Wallet' },
        createdAt: new Date(),
        completedAt: new Date(),
        errorMessage: null,
      });

      const result = await service.getConversionDetails('cust-1', 'c1');

      expect(result.id).toBe('c1');
      expect(result.type).toBe('BUY');
      expect(result.usdtAmount).toBe(100);
    });
  });

  describe('sendUsdt', () => {
    it('should throw BadRequestException when wallet has no private key', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: 'w-1',
        customerId: 'cust-1',
        encryptedPrivateKey: null,
        network: 'SOLANA',
      });

      await expect(
        service.sendUsdt('cust-1', 'w-1', 'to-addr', 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported network', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: 'w-1',
        customerId: 'cust-1',
        encryptedPrivateKey: 'some-key',
        network: 'ETHEREUM',
        externalAddress: 'addr',
      });

      await expect(
        service.sendUsdt('cust-1', 'w-1', 'to-addr', 10),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateWalletLabel', () => {
    it('should update wallet label', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: 'w-1',
        customerId: 'cust-1',
      });
      mockPrisma.wallet.update.mockResolvedValue({
        id: 'w-1',
        label: 'New Label',
      });

      await service.updateWalletLabel('w-1', 'cust-1', 'New Label');

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
        where: { id: 'w-1' },
        data: { label: 'New Label' },
      });
    });
  });

  describe('custody encryption hardening', () => {
    it('should encrypt Ethereum private key before storing', async () => {
      mockPrisma.wallet.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.wallet.create.mockImplementation(async ({ data }: any) => ({
        id: 'eth-wallet',
        ...data,
      }));

      const result = await service.createEthereumWallet('cust-1');

      const createCall = mockPrisma.wallet.create.mock.calls[0][0];
      const encryptedStoredKey = createCall.data.encryptedPrivateKey;

      expect(encryptedStoredKey).not.toBe(result.privateKey);
      expect(encryptedStoredKey).toContain(':');
      expect(decryptPrivateKey(encryptedStoredKey)).toBe(result.privateKey);
    });

    it('should encrypt Bitcoin private key before storing', async () => {
      mockPrisma.wallet.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.wallet.create.mockImplementation(async ({ data }: any) => ({
        id: 'btc-wallet',
        ...data,
      }));

      const result = await service.createBitcoinWallet('cust-1');

      const createCall = mockPrisma.wallet.create.mock.calls[0][0];
      const encryptedStoredKey = createCall.data.encryptedPrivateKey;

      expect(encryptedStoredKey).not.toBe(result.privateKey);
      expect(encryptedStoredKey).toContain(':');
      expect(decryptPrivateKey(encryptedStoredKey)).toBe(result.privateKey);
    });

    it('should decrypt key before TRX transfer', async () => {
      const decryptedKey = 'my-tron-private-key';
      const encryptedKey = encryptPrivateKey(decryptedKey);
      jest.spyOn(service, 'getWalletById').mockResolvedValue({
        id: 'wallet-trx',
        customerId: 'cust-1',
        network: 'TRON',
        currency: 'TRX',
        encryptedPrivateKey: encryptedKey,
      } as any);
      mockTronService.sendTrxWithKey.mockResolvedValue({
        txId: 'trx-123',
        success: true,
      });

      const result = await service.sendTronNative('wallet-trx', 'cust-1', 'TXxx', 1);

      expect(result).toEqual({ txId: 'trx-123', success: true });
      expect(mockTronService.sendTrxWithKey).toHaveBeenCalledWith(
        'TXxx',
        1,
        decryptedKey,
      );
    });

    it('should decrypt key before ETH transfer', async () => {
      const rawPrivateKey = '59c6995e998f97a5a0044966f0945382d7f8a5a1b7f795e6fcd5082b9795f2a6';
      const encryptedKey = encryptPrivateKey(rawPrivateKey);
      const providerMock = {
        getFeeData: jest.fn().mockResolvedValue({
          maxFeePerGas: 2n,
          maxPriorityFeePerGas: 1n,
          gasPrice: 2n,
        }),
        estimateGas: jest.fn().mockResolvedValue(21000n),
        getBalance: jest.fn().mockResolvedValue(ethers.parseEther('2')),
      };

      jest.spyOn(service, 'getWalletById').mockResolvedValue({
        id: 'wallet-eth',
        customerId: 'cust-1',
        network: 'ETHEREUM',
        currency: 'ETH',
        encryptedPrivateKey: encryptedKey,
      } as any);
      jest.spyOn(service as any, 'getEthProvider').mockReturnValue(providerMock as any);

      const sendTxSpy = jest
        .spyOn(ethers.Wallet.prototype, 'sendTransaction')
        .mockResolvedValue({ hash: '0xethhash' } as any);

      const result = await service.sendEthereum(
        'wallet-eth',
        'cust-1',
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        0.1,
      );

      expect(result).toEqual({ txId: '0xethhash', success: true, fee: expect.any(String) });
      expect(providerMock.getFeeData).toHaveBeenCalled();
      sendTxSpy.mockRestore();
    });

    it('should decrypt key before BTC transfer', async () => {
      const fromKeyPair = ECPair.makeRandom();
      const fromPayment = bitcoin.payments.p2wpkh({
        pubkey: fromKeyPair.publicKey,
        network: bitcoin.networks.bitcoin,
      });
      const toKeyPair = ECPair.makeRandom();
      const toPayment = bitcoin.payments.p2wpkh({
        pubkey: toKeyPair.publicKey,
        network: bitcoin.networks.bitcoin,
      });

      if (!fromPayment.address || !toPayment.address) {
        throw new Error('Failed to build BTC test addresses');
      }

      const encryptedWif = encryptPrivateKey(fromKeyPair.toWIF());
      jest.spyOn(service, 'getWalletById').mockResolvedValue({
        id: 'wallet-btc',
        customerId: 'cust-1',
        network: 'BITCOIN',
        currency: 'BTC',
        externalAddress: fromPayment.address,
        encryptedPrivateKey: encryptedWif,
      } as any);

      const fetchMock = jest.spyOn(global, 'fetch' as any).mockImplementation(async (input: any, init?: any) => {
        const url = String(input);
        if (url.includes('/utxo')) {
          return {
            ok: true,
            json: async () => [
              { txid: 'f'.repeat(64), vout: 0, value: 100000 },
            ],
          } as any;
        }
        if (url.includes('/fee-estimates')) {
          return {
            ok: true,
            json: async () => ({ '2': 5 }),
          } as any;
        }
        if (url.endsWith('/tx') && init?.method === 'POST') {
          return {
            ok: true,
            text: async () => 'btc-tx-id',
          } as any;
        }
        return {
          ok: false,
          text: async () => 'unexpected',
        } as any;
      });

      const result = await service.sendBitcoin(
        'wallet-btc',
        'cust-1',
        toPayment.address,
        0.0005,
      );

      expect(result).toEqual({ txId: 'btc-tx-id', success: true, fee: expect.any(String) });
      fetchMock.mockRestore();
    });
  });
});
