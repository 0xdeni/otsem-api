import { Injectable, BadRequestException, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { Keypair, Connection, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { PrismaService } from '../prisma/prisma.service';
import { encryptPrivateKey, decryptPrivateKey } from './wallet-crypto.util';

const USDT_MINT_SOLANA = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
import { BankingGatewayService } from '../banking/banking-gateway.service';
import { PixKeyType } from '../inter/dto/send-pix.dto';
import { OkxService } from '../okx/services/okx.service';
import { TronService } from '../tron/tron.service';
import { SolanaService } from '../solana/solana.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { KycLimitsService } from '../customers/kyc-limits.service';
import { Wallet, WalletNetwork, TransactionType } from '@prisma/client';

const SOL_FEE_FOR_USDT_TRANSFER = 0.005;
const TRX_FEE_FOR_USDT_TRANSFER = 15;
const ECPair = ECPairFactory(ecc);

const NETWORK_CURRENCIES: Record<WalletNetwork, string[]> = {
  SOLANA: ['USDT', 'SOL'],
  TRON: ['USDT', 'TRX'],
  ETHEREUM: ['ETH'],
  BITCOIN: ['BTC'],
  POLYGON: [],
  BSC: [],
  AVALANCHE: [],
  ARBITRUM: [],
  OPTIMISM: [],
  BASE: [],
};

const DEFAULT_CURRENCY_BY_NETWORK: Partial<Record<WalletNetwork, string>> = {
  SOLANA: 'USDT',
  TRON: 'USDT',
  ETHEREUM: 'ETH',
  BITCOIN: 'BTC',
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankingGateway: BankingGatewayService,
    private readonly okxService: OkxService,
    private readonly tronService: TronService,
    private readonly solanaService: SolanaService,
    @Inject(forwardRef(() => AffiliatesService))
    private readonly affiliatesService: AffiliatesService,
    @Inject(forwardRef(() => KycLimitsService))
    private readonly kycLimitsService: KycLimitsService,
  ) { }

  private normalizeCurrency(currency: string | undefined, network: WalletNetwork) {
    const fallback = DEFAULT_CURRENCY_BY_NETWORK[network] || 'USDT';
    return (currency || fallback).toUpperCase();
  }

  private assertSupportedCurrency(network: WalletNetwork, currency: string) {
    const supported = NETWORK_CURRENCIES[network] || [];
    if (!supported.includes(currency)) {
      throw new BadRequestException(
        `Moeda inválida para ${network}. Suportadas: ${supported.join(', ') || 'nenhuma'}`,
      );
    }
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

  private async markWalletAsNotWhitelisted(walletId?: string | null) {
    if (!walletId) return;
    try {
      await this.prisma.wallet.update({
        where: { id: walletId },
        data: { okxWhitelisted: false },
      });
    } catch (error: any) {
      this.logger.warn(
        `[BUY] Não foi possível atualizar okxWhitelisted=false para wallet ${walletId}: ${error?.message}`,
      );
    }
  }

  private getEthProvider() {
    const rpcUrl =
      process.env.ALCHEMY_ETH_RPC_URL ||
      process.env.ETH_RPC_URL ||
      process.env.ALCHEMY_RPC_URL ||
      '';
    if (!rpcUrl) {
      throw new BadRequestException('ETH_RPC_URL não configurado');
    }
    return new ethers.JsonRpcProvider(rpcUrl);
  }

  getTronService() {
    return this.tronService;
  }

  async createWallet(
    customerId: string,
    network: WalletNetwork,
    externalAddress: string,
    options?: { currency?: string; label?: string; isMain?: boolean },
  ) {
    const currency = this.normalizeCurrency(options?.currency, network);
    this.assertSupportedCurrency(network, currency);

    const existing = await this.prisma.wallet.findFirst({
      where: { customerId, network, externalAddress, currency },
    });
    if (existing) {
      throw new BadRequestException('Wallet com este endereço já existe nesta rede');
    }

    if (options?.isMain) {
      await this.prisma.wallet.updateMany({
        where: { customerId, network, isMain: true },
        data: { isMain: false },
      });
    }

    try {
      return await this.prisma.wallet.create({
        data: {
          customerId,
          network,
          externalAddress,
          currency,
          label: options?.label,
          isMain: options?.isMain ?? false,
          balance: 0,
        },
      });
    } catch (err: any) {
      this.logger.error(`Erro ao criar wallet: ${err.message}`);
      if (err.code === 'P2002') {
        throw new BadRequestException('Wallet com este endereço já existe nesta rede');
      }
      if (err.code === 'P2003') {
        throw new BadRequestException('Cliente não encontrado');
      }
      throw new BadRequestException('Erro ao criar wallet. Verifique os dados e tente novamente.');
    }
  }

  async createSolanaWallet(customerId: string, label?: string, currencyInput?: string) {
    const currency = this.normalizeCurrency(currencyInput, 'SOLANA');
    this.assertSupportedCurrency('SOLANA', currency);

    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = Buffer.from(keypair.secretKey).toString('hex');

    const existingMain = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'SOLANA', isMain: true },
    });

    const existing = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'SOLANA', externalAddress: publicKey, currency },
    });
    if (existing) {
      throw new BadRequestException('Wallet com este endereço já existe nesta rede');
    }

    if (!existingMain) {
      await this.prisma.wallet.updateMany({
        where: { customerId, network: 'SOLANA', isMain: true },
        data: { isMain: false },
      });
    }

    const wallet = await this.prisma.wallet.create({
      data: {
        customerId,
        network: 'SOLANA',
        externalAddress: publicKey,
        encryptedPrivateKey: encryptPrivateKey(secretKey),
        currency,
        label: label || `Solana ${currency} Wallet`,
        isMain: !existingMain,
        balance: 0,
      },
    });

    return { publicKey, wallet };
  }

  async createSolanaWalletForCustomer(customerId: string) {
    return this.createSolanaWallet(customerId);
  }

  async createTronWallet(customerId: string, label?: string, currencyInput?: string) {
    const currency = this.normalizeCurrency(currencyInput, 'TRON');
    this.assertSupportedCurrency('TRON', currency);

    const { address, privateKey } = await this.tronService.createWallet();

    const existingMain = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'TRON', isMain: true },
    });

    const existing = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'TRON', externalAddress: address, currency },
    });
    if (existing) {
      throw new BadRequestException('Wallet com este endereço já existe nesta rede');
    }

    if (!existingMain) {
      await this.prisma.wallet.updateMany({
        where: { customerId, network: 'TRON', isMain: true },
        data: { isMain: false },
      });
    }

    const wallet = await this.prisma.wallet.create({
      data: {
        customerId,
        network: 'TRON',
        externalAddress: address,
        encryptedPrivateKey: encryptPrivateKey(privateKey),
        currency,
        label: label || `Tron ${currency} Wallet`,
        isMain: !existingMain,
        balance: 0,
      },
    });

    return { address, wallet };
  }

  async createEthereumWallet(customerId: string, label?: string) {
    const currency = this.normalizeCurrency('ETH', 'ETHEREUM');
    this.assertSupportedCurrency('ETHEREUM', currency);

    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const privateKey = wallet.privateKey.replace(/^0x/, '');

    const existingMain = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'ETHEREUM', isMain: true },
    });

    const existing = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'ETHEREUM', externalAddress: address, currency },
    });
    if (existing) {
      throw new BadRequestException('Wallet com este endereço já existe nesta rede');
    }

    const created = await this.prisma.wallet.create({
      data: {
        customerId,
        network: 'ETHEREUM',
        externalAddress: address,
        encryptedPrivateKey: encryptPrivateKey(privateKey),
        currency,
        label: label || 'Ethereum Wallet',
        isMain: !existingMain,
        balance: 0,
      },
    });

    return { address, privateKey, wallet: created };
  }

  async createBitcoinWallet(customerId: string, label?: string) {
    const currency = this.normalizeCurrency('BTC', 'BITCOIN');
    this.assertSupportedCurrency('BITCOIN', currency);

    const keyPair = ECPair.makeRandom();
    const payment = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.bitcoin,
    });
    if (!payment.address) {
      throw new BadRequestException('Falha ao gerar endereço Bitcoin');
    }

    const address = payment.address;
    const privateKey = keyPair.toWIF();

    const existingMain = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'BITCOIN', isMain: true },
    });

    const existing = await this.prisma.wallet.findFirst({
      where: { customerId, network: 'BITCOIN', externalAddress: address, currency },
    });
    if (existing) {
      throw new BadRequestException('Wallet com este endereço já existe nesta rede');
    }

    const created = await this.prisma.wallet.create({
      data: {
        customerId,
        network: 'BITCOIN',
        externalAddress: address,
        encryptedPrivateKey: encryptPrivateKey(privateKey),
        currency,
        label: label || 'Bitcoin Wallet',
        isMain: !existingMain,
        balance: 0,
      },
    });

    return { address, privateKey, wallet: created };
  }

  async importWallet(
    customerId: string,
    network: WalletNetwork,
    externalAddress: string,
    label?: string,
    currencyInput?: string,
  ) {
    const currency = this.normalizeCurrency(currencyInput, network);
    this.assertSupportedCurrency(network, currency);

    // Validate address format for the specified network
    try {
      if (network === 'TRON') {
        const isValid = await this.tronService.isValidAddress(externalAddress);
        if (!isValid) {
          throw new BadRequestException('Endereço Tron inválido');
        }
      } else if (network === 'SOLANA') {
        const isValid = await this.solanaService.isValidAddress(externalAddress);
        if (!isValid) {
          throw new BadRequestException('Endereço Solana inválido');
        }
      } else if (network === 'ETHEREUM') {
        if (!ethers.isAddress(externalAddress)) {
          throw new BadRequestException('Endereço Ethereum inválido');
        }
      } else if (network === 'BITCOIN') {
        try {
          bitcoin.address.toOutputScript(externalAddress, bitcoin.networks.bitcoin);
        } catch {
          throw new BadRequestException('Endereço Bitcoin inválido');
        }
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Erro ao validar endereço ${network}: ${err}`);
      throw new BadRequestException(`Não foi possível validar o endereço para a rede ${network}`);
    }

    const existingMain = await this.prisma.wallet.findFirst({
      where: { customerId, network, isMain: true },
    });

    return this.createWallet(customerId, network, externalAddress, {
      currency,
      label: label || `${network} ${currency} Wallet`,
      isMain: !existingMain,
    });
  }

  async getWalletsByCustomer(customerId: string, network?: WalletNetwork) {
    const where: any = { customerId };
    if (network) where.network = network;
    return this.prisma.wallet.findMany({
      where,
      orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getWalletById(walletId: string, customerId?: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet não encontrada');
    if (customerId && wallet.customerId !== customerId) {
      throw new BadRequestException('Wallet não pertence a este customer');
    }
    return wallet;
  }

  async setMainWallet(walletId: string, customerId: string) {
    const wallet = await this.getWalletById(walletId, customerId);

    await this.prisma.wallet.updateMany({
      where: { customerId, network: wallet.network, isMain: true },
      data: { isMain: false },
    });

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { isMain: true },
    });
  }

  async updateWalletLabel(walletId: string, customerId: string, label: string) {
    await this.getWalletById(walletId, customerId);
    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { label },
    });
  }

  async deleteWallet(walletId: string, customerId: string) {
    const wallet = await this.getWalletById(walletId, customerId);
    if (wallet.isMain) {
      throw new BadRequestException('Não é possível deletar a wallet principal');
    }
    return this.prisma.wallet.delete({ where: { id: walletId } });
  }

  async getMainWallet(customerId: string, network: WalletNetwork) {
    return this.prisma.wallet.findFirst({
      where: { customerId, network, isMain: true },
    });
  }

  async getSolanaUsdtBalance(address: string, customerId?: string): Promise<string> {
    try {
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      let owner: PublicKey;
      try {
        owner = new PublicKey(address);
      } catch {
        throw new Error('Endereço Solana inválido');
      }

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      let saldo = 0;
      for (const acc of tokenAccounts.value) {
        const info = acc.account.data.parsed.info;
        if (info.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') {
          saldo += Number(info.tokenAmount.amount);
        }
      }
      const onChain = saldo / 1e6;

      if (customerId) {
        const wallet = await this.prisma.wallet.findFirst({
          where: { customerId, externalAddress: address, network: 'SOLANA' },
        });
        const reserved = wallet?.reserved ? Number(wallet.reserved) : 0;
        const available = Math.max(onChain - reserved, 0);
        await this.prisma.wallet.updateMany({
          where: { customerId, externalAddress: address, network: 'SOLANA' },
          data: { balance: available },
        });
        return available.toString();
      }

      return onChain.toString();
    } catch (err: any) {
      if (err.message === 'Endereço Solana inválido') throw err;
      console.error('Erro ao consultar saldo USDT:', err);
      return '0';
    }
  }

  async getTronUsdtBalance(address: string, customerId?: string): Promise<string> {
    try {
      const balance = await this.tronService.getUsdtBalance(address);
      const onChain = Number(balance);

      if (customerId) {
        const wallet = await this.prisma.wallet.findFirst({
          where: { customerId, externalAddress: address, network: 'TRON' },
        });
        const reserved = wallet?.reserved ? Number(wallet.reserved) : 0;
        const available = Math.max(onChain - reserved, 0);
        await this.prisma.wallet.updateMany({
          where: { customerId, externalAddress: address, network: 'TRON' },
          data: { balance: available },
        });
        return available.toString();
      }

      return onChain.toString();
    } catch (err: any) {
      this.logger.error(`Erro ao consultar saldo USDT Tron: ${err.message}`);
      return '0';
    }
  }

  private async getEthereumBalance(address: string): Promise<number> {
    try {
      const provider = this.getEthProvider();
      const balance = await provider.getBalance(address);
      return Number(ethers.formatEther(balance));
    } catch (err: any) {
      this.logger.error(`Erro ao consultar saldo ETH: ${err.message}`);
      return 0;
    }
  }

  private async getBitcoinBalance(address: string): Promise<number> {
    try {
      const response = await fetch(`https://blockstream.info/api/address/${address}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json() as {
        chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
        mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
      };
      const funded =
        (data.chain_stats?.funded_txo_sum || 0) + (data.mempool_stats?.funded_txo_sum || 0);
      const spent =
        (data.chain_stats?.spent_txo_sum || 0) + (data.mempool_stats?.spent_txo_sum || 0);
      const sats = funded - spent;
      return sats / 1e8;
    } catch (err: any) {
      this.logger.error(`Erro ao consultar saldo BTC: ${err.message}`);
      return 0;
    }
  }

  private async getWalletOnChainBalance(wallet: Wallet): Promise<number> {
    if (!wallet.externalAddress) return 0;

    if (wallet.network === 'SOLANA') {
      if (wallet.currency === 'USDT') {
        return Number(await this.getSolanaUsdtBalance(wallet.externalAddress));
      }
      if (wallet.currency === 'SOL') {
        return this.solanaService.getSolBalance(wallet.externalAddress);
      }
    }

    if (wallet.network === 'TRON') {
      if (wallet.currency === 'USDT') {
        return Number(await this.getTronUsdtBalance(wallet.externalAddress));
      }
      if (wallet.currency === 'TRX') {
        return this.tronService.getTrxBalance(wallet.externalAddress);
      }
    }

    if (wallet.network === 'ETHEREUM' && wallet.currency === 'ETH') {
      return this.getEthereumBalance(wallet.externalAddress);
    }

    if (wallet.network === 'BITCOIN' && wallet.currency === 'BTC') {
      return this.getBitcoinBalance(wallet.externalAddress);
    }

    return 0;
  }

  async sendUsdt(
    customerId: string,
    walletId: string,
    toAddress: string,
    amount: number,
  ): Promise<{ txId: string; success: boolean; network: string }> {
    const wallet = await this.getWalletById(walletId, customerId);

    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException('Wallet não possui chave privada (não é custodial). Envie diretamente pela carteira externa.');
    }

    if (wallet.currency !== 'USDT') {
      throw new BadRequestException('Esta carteira não é USDT');
    }

    const result = await this.sendCrypto(customerId, walletId, toAddress, amount);
    return { txId: result.txId, success: result.success, network: result.network };
  }

  async sendCrypto(
    customerId: string,
    walletId: string,
    toAddress: string,
    amount: number,
  ): Promise<{ txId: string; success: boolean; network: string; currency: string; fee?: string }> {
    const wallet = await this.getWalletById(walletId, customerId);

    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException('Wallet não possui chave privada (não é custodial). Envie diretamente pela carteira externa.');
    }

    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Saldo insuficiente na carteira');
    }

    let result: { txId: string; success: boolean; fee?: string };

    if (wallet.network === 'SOLANA' && wallet.currency === 'USDT') {
      result = await this.sendSolanaUsdt(walletId, customerId, toAddress, amount);
    } else if (wallet.network === 'SOLANA' && wallet.currency === 'SOL') {
      result = await this.sendSolanaNative(walletId, customerId, toAddress, amount);
    } else if (wallet.network === 'TRON' && wallet.currency === 'USDT') {
      result = await this.sendTronUsdt(walletId, customerId, toAddress, amount);
    } else if (wallet.network === 'TRON' && wallet.currency === 'TRX') {
      result = await this.sendTronNative(walletId, customerId, toAddress, amount);
    } else if (wallet.network === 'ETHEREUM' && wallet.currency === 'ETH') {
      result = await this.sendEthereum(walletId, customerId, toAddress, amount);
    } else if (wallet.network === 'BITCOIN' && wallet.currency === 'BTC') {
      result = await this.sendBitcoin(walletId, customerId, toAddress, amount);
    } else {
      throw new BadRequestException(`Rede/moeda não suportada: ${wallet.network} ${wallet.currency}`);
    }

    await this.syncWalletBalance(walletId, customerId);

    return { ...result, network: wallet.network, currency: wallet.currency };
  }

  async sendSolanaUsdt(
    walletId: string,
    customerId: string,
    toAddress: string,
    amount: number,
  ): Promise<{ txId: string; success: boolean }> {
    const wallet = await this.getWalletById(walletId, customerId);
    
    if (wallet.network !== 'SOLANA') {
      throw new BadRequestException('Wallet não é Solana');
    }
    
    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException('Wallet não possui chave privada (não é custodial)');
    }
    
    if (!wallet.externalAddress) {
      throw new BadRequestException('Wallet não possui endereço');
    }

    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    
    const decryptedKey = decryptPrivateKey(wallet.encryptedPrivateKey);
    const secretKeyBytes = Buffer.from(decryptedKey, 'hex');
    const senderKeypair = Keypair.fromSecretKey(secretKeyBytes);
    
    const senderPubkey = new PublicKey(wallet.externalAddress);
    const recipientPubkey = new PublicKey(toAddress);
    
    const senderAta = await splToken.getAssociatedTokenAddress(
      USDT_MINT_SOLANA,
      senderPubkey,
    );
    
    const recipientAta = await splToken.getAssociatedTokenAddress(
      USDT_MINT_SOLANA,
      recipientPubkey,
    );
    
    const senderAccountInfo = await connection.getTokenAccountBalance(senderAta);
    const senderBalance = Number(senderAccountInfo.value.amount) / 1e6;
    
    if (senderBalance < amount) {
      throw new BadRequestException(`Saldo insuficiente: ${senderBalance} USDT disponível, ${amount} USDT necessário`);
    }
    
    const amountInMicroUnits = Math.floor(amount * 1e6);
    
    const transferInstruction = splToken.createTransferInstruction(
      senderAta,
      recipientAta,
      senderPubkey,
      amountInMicroUnits,
    );
    
    const transaction = new Transaction().add(transferInstruction);
    
    const txId = await sendAndConfirmTransaction(connection, transaction, [senderKeypair]);
    
    this.logger.log(`✅ USDT SPL enviado: ${amount} para ${toAddress}, txId: ${txId}`);
    
    return { txId, success: true };
  }

  async sendSolanaNative(
    walletId: string,
    customerId: string,
    toAddress: string,
    amount: number,
  ): Promise<{ txId: string; success: boolean; fee?: string }> {
    const wallet = await this.getWalletById(walletId, customerId);

    if (wallet.network !== 'SOLANA' || wallet.currency !== 'SOL') {
      throw new BadRequestException('Wallet não é Solana (SOL)');
    }

    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException('Wallet não possui chave privada (não é custodial)');
    }

    if (!wallet.externalAddress) {
      throw new BadRequestException('Wallet não possui endereço');
    }

    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

    const decryptedKey = decryptPrivateKey(wallet.encryptedPrivateKey);
    const secretKeyBytes = Buffer.from(decryptedKey, 'hex');
    const senderKeypair = Keypair.fromSecretKey(secretKeyBytes);

    const senderPubkey = new PublicKey(wallet.externalAddress);
    const recipientPubkey = new PublicKey(toAddress);

    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderPubkey,
        toPubkey: recipientPubkey,
        lamports,
      }),
    );

    transaction.feePayer = senderPubkey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const feeResponse = await connection.getFeeForMessage(transaction.compileMessage());
    const feeLamports = feeResponse.value;
    if (feeLamports === null) {
      throw new BadRequestException('Não foi possível estimar a taxa de rede no momento');
    }
    const balanceLamports = await connection.getBalance(senderPubkey);

    if (balanceLamports < lamports + feeLamports) {
      throw new BadRequestException('Saldo insuficiente para valor + taxa de rede');
    }

    const txId = await sendAndConfirmTransaction(connection, transaction, [senderKeypair]);

    this.logger.log(`✅ SOL enviado: ${amount} para ${toAddress}, txId: ${txId}`);

    return { txId, success: true, fee: (feeLamports / LAMPORTS_PER_SOL).toString() };
  }

  async sendTronUsdt(
    walletId: string,
    customerId: string,
    toAddress: string,
    amount: number,
  ): Promise<{ txId: string; success: boolean }> {
    const wallet = await this.getWalletById(walletId, customerId);
    
    if (wallet.network !== 'TRON') {
      throw new BadRequestException('Wallet não é Tron');
    }
    
    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException('Wallet não possui chave privada (não é custodial)');
    }

    return this.tronService.sendUsdtWithKey(toAddress, amount, decryptPrivateKey(wallet.encryptedPrivateKey));
  }

  async sendTronNative(
    walletId: string,
    customerId: string,
    toAddress: string,
    amount: number,
  ): Promise<{ txId: string; success: boolean; fee?: string }> {
    const wallet = await this.getWalletById(walletId, customerId);

    if (wallet.network !== 'TRON' || wallet.currency !== 'TRX') {
      throw new BadRequestException('Wallet não é Tron (TRX)');
    }

    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException('Wallet não possui chave privada (não é custodial)');
    }

    return this.tronService.sendTrxWithKey(toAddress, amount, decryptPrivateKey(wallet.encryptedPrivateKey));
  }

  async sendEthereum(
    walletId: string,
    customerId: string,
    toAddress: string,
    amount: number,
  ): Promise<{ txId: string; success: boolean; fee?: string }> {
    const wallet = await this.getWalletById(walletId, customerId);

    if (wallet.network !== 'ETHEREUM' || wallet.currency !== 'ETH') {
      throw new BadRequestException('Wallet não é Ethereum (ETH)');
    }

    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException('Wallet não possui chave privada (não é custodial)');
    }

    if (!ethers.isAddress(toAddress)) {
      throw new BadRequestException('Endereço Ethereum inválido');
    }

    const provider = this.getEthProvider();
    const decryptedKey = decryptPrivateKey(wallet.encryptedPrivateKey);
    const privateKey = decryptedKey.startsWith('0x')
      ? decryptedKey
      : `0x${decryptedKey}`;
    const signer = new ethers.Wallet(privateKey, provider);

    const value = ethers.parseEther(amount.toString());
    const feeData = await provider.getFeeData();
    const gasLimit = await provider.estimateGas({ to: toAddress, value });
    const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;

    const fee = gasLimit * maxFeePerGas;
    const balance = await provider.getBalance(signer.address);

    if (balance < value + fee) {
      throw new BadRequestException('Saldo insuficiente para valor + taxa de rede');
    }

    const tx = await signer.sendTransaction({
      to: toAddress,
      value,
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    return { txId: tx.hash, success: true, fee: ethers.formatEther(fee) };
  }

  async sendBitcoin(
    walletId: string,
    customerId: string,
    toAddress: string,
    amount: number,
  ): Promise<{ txId: string; success: boolean; fee?: string }> {
    const wallet = await this.getWalletById(walletId, customerId);

    if (wallet.network !== 'BITCOIN' || wallet.currency !== 'BTC') {
      throw new BadRequestException('Wallet não é Bitcoin (BTC)');
    }

    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException('Wallet não possui chave privada (não é custodial)');
    }

    try {
      bitcoin.address.toOutputScript(toAddress, bitcoin.networks.bitcoin);
    } catch {
      throw new BadRequestException('Endereço Bitcoin inválido');
    }

    const fromAddress = wallet.externalAddress;
    if (!fromAddress) {
      throw new BadRequestException('Wallet não possui endereço');
    }

    const utxoRes = await fetch(`https://blockstream.info/api/address/${fromAddress}/utxo`);
    if (!utxoRes.ok) {
      throw new BadRequestException('Falha ao buscar UTXOs');
    }
    const utxos = await utxoRes.json() as { txid: string; vout: number; value: number }[];
    if (!utxos.length) {
      throw new BadRequestException('Sem UTXOs disponíveis');
    }

    const feeRes = await fetch('https://blockstream.info/api/fee-estimates');
    const feeEstimates = feeRes.ok ? await feeRes.json() as Record<string, number> : { '2': 5 };
    const satPerVbyte = feeEstimates['2'] || feeEstimates['1'] || 5;

    const amountSats = Math.floor(amount * 1e8);
    let selected: { txid: string; vout: number; value: number }[] = [];
    let total = 0;

    for (const utxo of utxos) {
      selected.push(utxo);
      total += utxo.value;

      const inputCount = selected.length;
      const outputCount = 2; // recipient + change
      const vbytes = 10 + inputCount * 68 + outputCount * 31;
      const fee = Math.ceil(vbytes * satPerVbyte);

      if (total >= amountSats + fee) break;
    }

    const inputCount = selected.length;
    const outputCount = 2;
    const vbytes = 10 + inputCount * 68 + outputCount * 31;
    const fee = Math.ceil(vbytes * satPerVbyte);

    if (total < amountSats + fee) {
      throw new BadRequestException('Saldo insuficiente para valor + taxa de rede');
    }

    const change = total - amountSats - fee;
    const decryptedWif = decryptPrivateKey(wallet.encryptedPrivateKey);
    const keyPair = ECPair.fromWIF(decryptedWif, bitcoin.networks.bitcoin);
    const payment = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: bitcoin.networks.bitcoin });

    if (!payment.output) {
      throw new BadRequestException('Falha ao gerar script de assinatura');
    }

    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
    for (const utxo of selected) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: payment.output,
          value: utxo.value,
        },
      });
    }

    psbt.addOutput({ address: toAddress, value: amountSats });
    if (change > 0) {
      psbt.addOutput({ address: fromAddress, value: change });
    }

    psbt.signAllInputs(keyPair);
    psbt.finalizeAllInputs();

    const txHex = psbt.extractTransaction().toHex();
    const broadcastRes = await fetch('https://blockstream.info/api/tx', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: txHex,
    });

    if (!broadcastRes.ok) {
      const errorText = await broadcastRes.text();
      throw new BadRequestException(`Falha ao enviar BTC: ${errorText}`);
    }

    const txId = await broadcastRes.text();
    return { txId, success: true, fee: (fee / 1e8).toString() };
  }

  async syncWalletBalance(walletId: string, customerId: string): Promise<{ balance: string; wallet: any }> {
    const wallet = await this.getWalletById(walletId, customerId);

    const onChain = await this.getWalletOnChainBalance(wallet);
    const reserved = wallet.reserved ? Number(wallet.reserved) : 0;
    const available = Math.max(onChain - reserved, 0);

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { balance: available },
    });

    const updatedWallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    return { balance: available.toString(), wallet: updatedWallet };
  }

  async updateWalletBalance(walletId: string, customerId: string, balance: string): Promise<any> {
    const wallet = await this.getWalletById(walletId, customerId);
    return this.prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance },
    });
  }

  async syncAllWalletBalances(customerId: string): Promise<any[]> {
    const wallets = await this.prisma.wallet.findMany({ where: { customerId } });
    const results: any[] = [];

    for (const wallet of wallets) {
      try {
        const onChain = await this.getWalletOnChainBalance(wallet);
        const reserved = wallet.reserved ? Number(wallet.reserved) : 0;
        const available = Math.max(onChain - reserved, 0);
        await this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: available },
        });
        results.push({
          id: wallet.id,
          network: wallet.network,
          currency: wallet.currency,
          address: wallet.externalAddress,
          balance: available.toString(),
        });
      } catch (err: any) {
        results.push({
          id: wallet.id,
          network: wallet.network,
          currency: wallet.currency,
          address: wallet.externalAddress,
          balance: wallet.balance,
          error: err.message,
        });
      }
    }

    return results;
  }

  async getAllUsdtWalletsForCustomer(customerId: string) {
    return this.prisma.wallet.findMany({
      where: { customerId, currency: 'USDT' },
      orderBy: [{ network: 'asc' }, { isMain: 'desc' }],
    });
  }

  async getUsdtQuote(customerId: string, brlAmount: number, walletId?: string) {
    const account = await this.prisma.account.findFirst({ where: { customerId } });
    const balance = account ? Number(account.balance) : 0;

    let wallet: any = null;
    if (walletId) {
      wallet = await this.prisma.wallet.findFirst({
        where: { id: walletId, customerId, currency: 'USDT' },
      });
    } else {
      wallet = await this.prisma.wallet.findFirst({
        where: { customerId, currency: 'USDT', isMain: true },
      });
      if (!wallet) {
        wallet = await this.prisma.wallet.findFirst({
          where: { customerId, currency: 'USDT' },
        });
      }
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { user: { select: { spreadValue: true } } },
    });

    // Spread calculation: only base spread, no affiliate addition
    const userSpreadMultiplier = customer?.user?.spreadValue ? Number(customer.user.spreadValue) : 1;
    const baseSpreadRate = Number.isFinite(userSpreadMultiplier) && userSpreadMultiplier > 0 ? userSpreadMultiplier : 1;
    const baseSpreadPercent = 1 - baseSpreadRate;
    const spreadRate = 1 - baseSpreadPercent;

    const brlExchanged = Number((brlAmount * spreadRate).toFixed(2));
    const spreadBrl = Number((brlAmount - brlExchanged).toFixed(2));

    const okxRate = await this.okxService.getBrlToUsdtRate();
    const exchangeRate = okxRate || 5.5;
    const usdtEstimate = Number((brlExchanged / exchangeRate).toFixed(2));

    const network = wallet?.network || 'SOLANA';
    const networkFee = network === 'TRON' ? 2.1 : 1.0;
    const usdtNet = Number((usdtEstimate - networkFee).toFixed(2)); // Buyer pays network fee

    const minBrl = 10;

    return {
      brlAmount,
      brlExchanged,
      spreadPercent: Math.round(baseSpreadPercent * 10000) / 100,
      spreadBrl,
      exchangeRate,
      usdtEstimate,
      network,
      networkFeeUsdt: networkFee,
      networkFeeBrl: Number((networkFee * exchangeRate).toFixed(2)),
      networkFeePaidBy: 'BUYER',
      usdtNet,
      wallet: wallet ? {
        id: wallet.id,
        address: wallet.externalAddress,
        network: wallet.network,
        whitelisted: wallet.okxWhitelisted,
      } : null,
      balanceBrl: balance,
      canProceed: balance >= brlAmount && brlAmount >= 10 && usdtNet > 0 && !!wallet,
      minBrlRecommended: minBrl,
      message: usdtNet <= 0
        ? `Valor mínimo: R$ ${minBrl}`
        : !wallet
          ? 'Cadastre uma carteira USDT para prosseguir com a compra.'
          : wallet.okxWhitelisted === false
            ? `Você receberá ${usdtNet.toFixed(2)} USDT (taxa de rede: ${networkFee} USDT). Atenção: endereço ainda não confirmado na whitelist da OKX.`
            : `Você receberá ${usdtNet.toFixed(2)} USDT (taxa de rede: ${networkFee} USDT)`,
    };
  }

  async buyUsdtWithBrl(customerId: string, brlAmount: number, walletId?: string) {
    const account = await this.prisma.account.findFirst({ where: { customerId } });
    if (!account || Number(account.balance) < brlAmount || brlAmount < 10) {
      throw new BadRequestException('Saldo insuficiente em BRL (mínimo R$10)');
    }

    // Validar limite mensal KYC
    const limitCheck = await this.kycLimitsService.validateTransactionLimit(customerId, brlAmount);
    if (!limitCheck.allowed) {
      throw new BadRequestException(limitCheck.message);
    }

    // Obter spread base do User.spreadValue (sem spread adicional do afiliado)
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { user: { select: { spreadValue: true } }, affiliateId: true },
    });

    const userSpreadMultiplier = customer?.user?.spreadValue ? Number(customer.user.spreadValue) : 1;
    const baseSpreadRate = Number.isFinite(userSpreadMultiplier) && userSpreadMultiplier > 0 ? userSpreadMultiplier : 1;
    const baseSpreadPercent = 1 - baseSpreadRate;

    // No affiliate spread addition — affiliate gets 10% of OTSEM's spread instead
    const totalSpreadPercent = baseSpreadPercent;
    const spreadRate = 1 - totalSpreadPercent;

    const brlToExchange = Number((brlAmount * spreadRate).toFixed(2));
    const spreadAmount = Number((brlAmount - brlToExchange).toFixed(2));

    // Get affiliate info for commission recording
    const affiliateInfo = await this.affiliatesService.getAffiliateForCustomer(customerId);

    this.logger.log(`[Conversion] Spread: base=${baseSpreadPercent.toFixed(4)}, total=${totalSpreadPercent.toFixed(4)}, rate=${spreadRate.toFixed(4)}, affiliate=${affiliateInfo.affiliate?.code || 'none'}`);

    // Determinar carteira de destino antes de iniciar
    let wallet;
    if (walletId) {
      wallet = await this.getWalletById(walletId, customerId);
    } else {
      wallet = await this.getMainWallet(customerId, 'SOLANA');
      if (!wallet) {
        wallet = await this.getMainWallet(customerId, 'TRON');
      }
    }

    if (!wallet || !wallet.externalAddress) {
      throw new BadRequestException('Carteira (Solana ou Tron) não encontrada para o cliente');
    }

    // Criar Conversion com status PENDING para tracking em tempo real
    const conversion = await this.prisma.conversion.create({
      data: {
        customerId,
        accountId: account.id,
        type: 'BUY',
        brlCharged: brlAmount,
        brlExchanged: brlToExchange,
        spreadPercent: totalSpreadPercent,
        spreadBrl: spreadAmount,
        network: wallet.network,
        walletAddress: wallet.externalAddress,
        walletId: wallet.id,
        affiliateId: affiliateInfo.affiliate?.id || null,
        status: 'PENDING',
      },
    });
    this.logger.log(`[BUY] Conversion ${conversion.id} criada com status PENDING`);

    let pixResult: any = null;
    let okxBuyResult: any = null;
    let withdrawResult: any = null;

    try {
      // 1) PIX para conta OKX - atualizar status
      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: { status: 'PIX_SENT' },
      });

      pixResult = await this.bankingGateway.sendPix(customerId, {
        valor: brlAmount,
        chaveDestino: '50459025000126',
        tipoChave: PixKeyType.CHAVE,
        descricao: customerId,
      });

      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: { pixEndToEnd: pixResult?.endToEndId, pixTxid: pixResult?.txid },
      });

      // 2) Compra USDT na OKX
      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: { status: 'USDT_BOUGHT' },
      });

      await new Promise((resolve) => setTimeout(resolve, 5000));
      okxBuyResult = await this.okxService.buyAndCheckHistory(brlToExchange);

      // Calcular quantidade de USDT comprada a partir dos fills
      let usdtAmount = 0;
      if (okxBuyResult.detalhes && okxBuyResult.detalhes.length > 0) {
        usdtAmount = okxBuyResult.detalhes.reduce((sum: number, fill: any) => {
          return sum + parseFloat(fill.fillSz || '0');
        }, 0);
      }
      if (usdtAmount <= 0) {
        throw new Error('Não foi possível determinar a quantidade de USDT comprada');
      }

      const exchangeRate = usdtAmount > 0 ? brlToExchange / usdtAmount : 0;
      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          usdtPurchased: usdtAmount,
          exchangeRate,
          okxOrderId: okxBuyResult?.orderId || null,
        },
      });

      // 3) Registrar transação CONVERSION
      const balanceBefore = account.balance;
      await this.prisma.transaction.create({
        data: {
          accountId: account.id,
          type: TransactionType.CONVERSION,
          subType: 'BUY',
          status: 'COMPLETED',
          amount: brlAmount,
          balanceBefore,
          balanceAfter: balanceBefore,
          description: `Conversão BRL→USDT: R$ ${brlAmount.toFixed(2)} → ${usdtAmount.toFixed(2)} USDT`,
          externalId: conversion.id,
          endToEnd: pixResult?.endToEndId,
          externalData: {
            pixEndToEnd: pixResult?.endToEndId,
            okxBuyResult,
            usdtAmount,
            walletAddress: wallet.externalAddress,
            network: wallet.network,
            spread: { chargedBrl: brlAmount, exchangedBrl: brlToExchange, spreadBrl: spreadAmount, spreadRate },
          },
          completedAt: new Date(),
        },
      });

      // Persist spread + etapas em Payment/Transaction (se houver endToEnd)
      if (pixResult?.endToEndId) {
        const payment = await this.prisma.payment.findUnique({ where: { endToEnd: pixResult.endToEndId } });
        if (payment) {
          const bankPayload = (payment.bankPayload as any) || {};
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              bankPayload: {
                ...bankPayload,
                spread: {
                  chargedBrl: brlAmount,
                  exchangedBrl: brlToExchange,
                  spreadBrl: spreadAmount,
                  spreadRate,
                },
                okxBuyResult,
                conversionId: conversion.id,
              },
            },
          });
        }

        const tx = await this.prisma.transaction.findFirst({ where: { externalId: pixResult.endToEndId } });
        if (tx) {
          const metadata = (tx.metadata as any) || {};
          await this.prisma.transaction.update({
            where: { id: tx.id },
            data: {
              metadata: {
                ...metadata,
                spread: {
                  chargedBrl: brlAmount,
                  exchangedBrl: brlToExchange,
                  spreadBrl: spreadAmount,
                  spreadRate,
                },
                okxBuyResult,
                conversionId: conversion.id,
              },
            },
          });
        }
      }

      // 4) Atualizar status para USDT_WITHDRAWN antes do saque
      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: { status: 'USDT_WITHDRAWN' },
      });

      // Buyer pays network fee — deducted from USDT received
      const isTron = wallet.network === 'TRON';
      const networkFee = isTron ? 2.1 : 1;
      const usdtToWithdraw = usdtAmount - networkFee; // Buyer pays network fee

      if (usdtToWithdraw <= 0) {
        throw new Error(`USDT comprado (${usdtAmount}) insuficiente para cobrir taxa de rede (${networkFee})`);
      }

      // 4a) Transferir da conta trading para funding (valor exato comprado)
      this.logger.log(`[OKX] Transferindo ${usdtAmount.toFixed(2)} USDT de trading para funding`);
      await this.okxService.transferFromTradingToFunding('USDT', usdtAmount.toFixed(2));

      // 4b) OKX → Cliente (USDT menos taxa de rede)
      const network = isTron ? 'TRC20' : 'Solana';
      this.logger.log(`[${network}] Sacando ${usdtToWithdraw.toFixed(2)} USDT para: ${wallet.externalAddress} (taxa ${networkFee} paga pelo comprador)`);

      withdrawResult = await this.okxService.withdrawUsdtSimple(
        usdtToWithdraw.toFixed(2),
        wallet.externalAddress,
        network,
        networkFee.toString(),
      );

      // 5) Registrar comissão do afiliado (10% do spread da OTSEM)
      let affiliateCommission = null;
      if (affiliateInfo.affiliate && spreadAmount > 0) {
        affiliateCommission = await this.affiliatesService.recordCommission({
          affiliateId: affiliateInfo.affiliate.id,
          customerId,
          conversionId: conversion.id,
          conversionType: 'BUY',
          transactionId: conversion.id,
          transactionAmount: brlAmount,
          spreadBrl: spreadAmount,
          exchangeRate,
        });

        if (affiliateCommission) {
          this.logger.log(`[Affiliate] Commission recorded: R$ ${Number(affiliateCommission.commissionBrl).toFixed(2)} / ${Number(affiliateCommission.commissionUsdt).toFixed(6)} USDT for ${affiliateInfo.affiliate.code}`);

          // Try auto-settlement
          const settlement = await this.affiliatesService.settleCommissionUsdt(affiliateInfo.affiliate.id);
          if (settlement.settled) {
            this.logger.log(`[Affiliate] Auto-settled ${settlement.amountUsdt.toFixed(6)} USDT, txId: ${settlement.txId}`);
          } else {
            this.logger.log(`[Affiliate] Settlement deferred: ${settlement.reason}`);
          }
        }
      }

      // 6) Calcular fees e atualizar Conversion para COMPLETED
      const okxWithdrawFeeUsdt = networkFee;
      const okxTradingFee = brlToExchange * 0.001;
      const affiliateCommissionBrl = affiliateCommission ? Number(affiliateCommission.commissionBrl) : 0;
      const grossProfit = spreadAmount;
      const netProfit = grossProfit - okxTradingFee - affiliateCommissionBrl;

      const conversionTx = await this.prisma.transaction.findFirst({
        where: { externalId: conversion.id },
      });

      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: {
          transactionId: conversionTx?.id,
          usdtWithdrawn: usdtToWithdraw,
          okxWithdrawId: withdrawResult?.wdId || null,
          affiliateCommission: affiliateCommissionBrl,
          okxWithdrawFee: okxWithdrawFeeUsdt,
          okxTradingFee,
          totalOkxFees: okxTradingFee,
          grossProfit,
          netProfit,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      this.logger.log(`[BUY] Conversion ${conversion.id} COMPLETED: R$ ${brlAmount} → ${usdtToWithdraw.toFixed(2)} USDT (sent to customer)`);

      return {
        conversionId: conversion.id,
        status: 'COMPLETED',
        message: 'Compra e transferência de USDT concluída',
        usdtBought: usdtAmount,
        usdtWithdrawn: usdtToWithdraw,
        networkFee,
        networkFeePaidBy: 'BUYER',
        spread: {
          chargedBrl: brlAmount,
          exchangedBrl: brlToExchange,
          spreadBrl: spreadAmount,
          spreadRate,
          base: baseSpreadPercent,
          total: totalSpreadPercent,
        },
        affiliateCommission: affiliateCommission ? {
          affiliateCode: affiliateInfo.affiliate?.code,
          commissionBrl: Number(affiliateCommission.commissionBrl),
          commissionUsdt: Number(affiliateCommission.commissionUsdt),
        } : null,
        wallet: { id: wallet.id, network: wallet.network, address: wallet.externalAddress },
      };
    } catch (error: any) {
      // Atualizar Conversion para FAILED
      const axiosMsg = error?.response?.data?.msg || error?.response?.data?.message;
      const rawMessage = axiosMsg || (error instanceof Error ? error.message : 'Erro na compra/transferência USDT');
      const isWhitelistError = this.isOkxWhitelistErrorMessage(rawMessage);
      if (isWhitelistError) {
        await this.markWalletAsNotWhitelisted(wallet?.id);
      }
      const publicMessage = isWhitelistError
        ? 'Endereço não confirmado na whitelist da OKX. Autorize o endereço no app/web da OKX e tente novamente.'
        : rawMessage;
      await this.prisma.conversion.update({
        where: { id: conversion.id },
        data: { status: 'FAILED', errorMessage: publicMessage },
      });
      this.logger.error(`[BUY] Conversion ${conversion.id} FAILED: ${publicMessage}`, error?.stack || error);

      throw new BadRequestException(`Erro na compra USDT: ${publicMessage}`);
    }
  }

  /**
   * Vende USDT e credita BRL na conta do cliente
   * 
   * Fluxo:
   * 1. Verifica saldo USDT disponível na OKX
   * 2. Vende USDT na OKX, recebe BRL
   * 3. Aplica spread reverso (cliente recebe menos)
   * 4. Credita BRL na conta do cliente
   */
  async sellUsdtForBrl(customerId: string, usdtAmount: number) {
    if (usdtAmount < 1) {
      throw new Error('Quantidade mínima é 1 USDT');
    }

    const account = await this.prisma.account.findFirst({ where: { customerId } });
    if (!account) {
      throw new Error('Conta não encontrada para o cliente');
    }

    // Spread configurável por usuário (default: 1.0 = sem spread)
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { user: { select: { spreadValue: true } } },
    });
    const spreadRateRaw = customer?.user?.spreadValue ? Number(customer.user.spreadValue) : 1;
    const spreadRate = Number.isFinite(spreadRateRaw) && spreadRateRaw > 0 ? spreadRateRaw : 1;

    let okxSellResult: any = null;

    try {
      // 1) Transferir USDT da conta funding para trading
      await this.okxService.transferUsdtToTrading(usdtAmount);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 2) Vender USDT na OKX e verificar BRL recebido
      okxSellResult = await this.okxService.sellAndCheckHistory(usdtAmount);

      const brlFromExchange = okxSellResult.brlReceived;
      if (brlFromExchange <= 0) {
        throw new Error('Não foi possível determinar o valor em BRL recebido');
      }

      // 3) Aplicar spread (cliente recebe menos)
      const brlToCredit = Number((brlFromExchange * spreadRate).toFixed(2));
      const spreadAmount = Number((brlFromExchange - brlToCredit).toFixed(2));

      // 4) Creditar BRL na conta do cliente
      const balanceBefore = Number(account.balance);
      const balanceAfter = balanceBefore + brlToCredit;

      await this.prisma.account.update({
        where: { id: account.id },
        data: { balance: balanceAfter.toFixed(2) },
      });

      // 5) Registrar transação CONVERSION (USDT→BRL)
      await this.prisma.transaction.create({
        data: {
          accountId: account.id,
          type: TransactionType.CONVERSION,
          status: 'COMPLETED',
          amount: brlToCredit,
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
          description: `Conversão USDT→BRL: ${usdtAmount.toFixed(2)} USDT → R$ ${brlToCredit.toFixed(2)}`,
          externalId: `CONV-SELL-${Date.now()}`,
          externalData: {
            direction: 'USDT_TO_BRL',
            usdtSold: usdtAmount,
            brlFromExchange,
            brlCredited: brlToCredit,
            okxSellResult,
            spread: { 
              exchangedBrl: brlFromExchange, 
              creditedBrl: brlToCredit, 
              spreadBrl: spreadAmount, 
              spreadRate 
            },
          },
          completedAt: new Date(),
        },
      });

      return {
        message: 'Venda de USDT concluída',
        usdtSold: usdtAmount,
        brlFromExchange,
        brlCredited: brlToCredit,
        spread: {
          exchangedBrl: brlFromExchange,
          creditedBrl: brlToCredit,
          spreadBrl: spreadAmount,
          spreadRate,
        },
        okxSellResult,
        newBalance: balanceAfter.toFixed(2),
      };
    } catch (error) {
      throw error;
    }
  }

  async setOkxWhitelisted(walletId: string, customerId: string, whitelisted: boolean) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, customerId },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet não encontrada');
    }

    return this.prisma.wallet.update({
      where: { id: walletId },
      data: { okxWhitelisted: whitelisted },
    });
  }

  /**
   * Retorna endereço de depósito USDT para o cliente enviar
   */
  async getUsdtDepositAddress(network: 'SOLANA' | 'TRON') {
    const tronDepositAddress = process.env.OKX_TRON_DEPOSIT_ADDRESS;

    if (network === 'TRON') {
      if (!tronDepositAddress) {
        throw new Error('Endereço de depósito TRON não configurado');
      }
      return {
        network,
        chain: 'TRC20',
        address: tronDepositAddress,
        memo: null,
        instructions: 'Envie USDT TRC20 para este endereço. Após confirmação, o valor será convertido e creditado em BRL.',
      };
    }

    const solanaDepositAddress = process.env.OKX_SOLANA_DEPOSIT_ADDRESS;
    if (!solanaDepositAddress) {
      throw new Error('Endereço de depósito Solana não configurado');
    }
    return {
      network,
      chain: 'Solana',
      address: solanaDepositAddress,
      memo: null,
      instructions: 'Envie USDT SPL para este endereço. Após confirmação, o valor será convertido e creditado em BRL.',
    };
  }

  /**
   * Cotação para venda USDT → PIX BRL
   */
  async quoteSellUsdt(customerId: string, usdtAmount: number, network: 'SOLANA' | 'TRON') {
    if (usdtAmount < 1) {
      throw new BadRequestException('Quantidade mínima é 1 USDT');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { 
        user: { select: { spreadValue: true } },
        pixKeys: { where: { status: 'ACTIVE' }, take: 1 },
      },
    });

    const spreadRateRaw = customer?.user?.spreadValue ? Number(customer.user.spreadValue) : 1;
    const spreadRate = Number.isFinite(spreadRateRaw) && spreadRateRaw > 0 ? spreadRateRaw : 1;
    const spreadPercent = (1 - spreadRate) * 100;

    const okxRate = await this.okxService.getBrlToUsdtRate();
    const exchangeRate = okxRate || 5.5;

    const brlFromExchange = usdtAmount * exchangeRate;
    const spreadBrl = brlFromExchange * (1 - spreadRate);
    const brlToReceive = brlFromExchange * spreadRate;
    const okxTradingFee = brlFromExchange * 0.001;
    const netProfit = spreadBrl - okxTradingFee;

    const mainPixKey = customer?.pixKeys?.[0];

    return {
      usdtAmount,
      network,
      exchangeRate,
      brlFromExchange: Math.round(brlFromExchange * 100) / 100,
      spreadPercent: Math.round(spreadPercent * 100) / 100,
      spreadBrl: Math.round(spreadBrl * 100) / 100,
      brlToReceive: Math.round(brlToReceive * 100) / 100,
      okxTradingFee: Math.round(okxTradingFee * 100) / 100,
      pixKey: mainPixKey ? { key: mainPixKey.keyValue, type: mainPixKey.keyType } : null,
      canProceed: !!mainPixKey,
      message: mainPixKey 
        ? `Você receberá R$ ${brlToReceive.toFixed(2)} via PIX`
        : 'Configure uma chave PIX principal primeiro',
    };
  }

  /**
   * Inicia venda USDT → BRL
   * Cliente envia USDT diretamente para endereço OKX, sistema monitora e processa
   */
  async initiateSellUsdtToBrl(
    customerId: string,
    usdtAmount: number,
    network: 'SOLANA' | 'TRON',
  ) {
    if (usdtAmount < 10) {
      throw new BadRequestException('Quantidade mínima é 10 USDT');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const account = await this.prisma.account.findFirst({ where: { customerId } });
    if (!account) {
      throw new BadRequestException('Conta não encontrada');
    }

    const okxNetwork = network === 'TRON' ? 'TRC20' : 'Solana';
    const depositAddress = await this.okxService.getDepositAddress(okxNetwork);

    const quote = await this.quoteSellUsdt(customerId, usdtAmount, network);

    const conversion = await this.prisma.conversion.create({
      data: {
        customerId,
        accountId: account.id,
        type: 'SELL',
        brlCharged: 0,
        brlExchanged: quote.brlFromExchange,
        spreadPercent: quote.spreadPercent / 100,
        spreadBrl: quote.spreadBrl,
        usdtPurchased: usdtAmount,
        usdtWithdrawn: 0,
        exchangeRate: quote.exchangeRate,
        network,
        walletAddress: depositAddress.address,
        okxWithdrawFee: 0,
        okxTradingFee: quote.okxTradingFee,
        totalOkxFees: quote.okxTradingFee,
        grossProfit: quote.spreadBrl,
        netProfit: quote.spreadBrl - quote.okxTradingFee,
        status: 'PENDING',
      },
    });

    this.logger.log(`[SELL] Venda iniciada: ${usdtAmount} USDT → aguardando depósito em ${depositAddress.address}`);

    return {
      conversionId: conversion.id,
      status: 'PENDING',
      usdtAmount,
      network,
      depositAddress: depositAddress.address,
      quote: {
        brlToReceive: quote.brlToReceive,
        exchangeRate: quote.exchangeRate,
        spreadPercent: quote.spreadPercent,
      },
      message: `Envie ${usdtAmount} USDT para o endereço acima. Após confirmação, o BRL será creditado na sua conta OTSEM.`,
    };
  }

  /**
   * Processa venda pendente após depósito USDT confirmado
   * (Chamado pelo job de monitoramento ou manualmente pelo admin)
   */
  async processSellConversion(conversionId: string) {
    const conversion = await this.prisma.conversion.findUnique({
      where: { id: conversionId },
      include: { customer: true, account: true },
    });

    if (!conversion) {
      throw new NotFoundException('Conversão não encontrada');
    }

    if (conversion.type !== 'SELL') {
      throw new BadRequestException('Esta conversão não é do tipo SELL');
    }

    if (conversion.status !== 'PENDING' && conversion.status !== 'USDT_RECEIVED') {
      throw new BadRequestException(`Status inválido: ${conversion.status}. Esperado: PENDING ou USDT_RECEIVED`);
    }

    this.logger.log(`[SELL] Processando venda ${conversionId}: ${conversion.usdtPurchased} USDT`);

    const usdtAmount = Number(conversion.usdtPurchased);

    try {
      await this.prisma.conversion.update({
        where: { id: conversionId },
        data: { status: 'USDT_SOLD' },
      });

      await this.okxService.transferUsdtToTrading(usdtAmount);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const okxSellResult = await this.okxService.sellAndCheckHistory(usdtAmount);
      const brlFromExchange = okxSellResult.brlReceived;

      if (brlFromExchange <= 0) {
        throw new Error('Não foi possível determinar o valor em BRL recebido');
      }

      const spreadRate = 1 - Number(conversion.spreadPercent);
      const brlToSend = Number((brlFromExchange * spreadRate).toFixed(2));
      const spreadBrl = Number((brlFromExchange - brlToSend).toFixed(2));
      const okxTradingFee = brlFromExchange * 0.001;
      const netProfit = spreadBrl - okxTradingFee;

      const currentBalance = Number(conversion.account.balance);
      const newBalance = currentBalance + brlToSend;

      const creditTx = await this.prisma.transaction.create({
        data: {
          accountId: conversion.accountId,
          type: TransactionType.CONVERSION,
          amount: brlToSend,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          status: 'COMPLETED',
          description: `Venda USDT: ${usdtAmount} USDT → R$ ${brlToSend.toFixed(2)}`,
          metadata: {
            conversionId,
            usdtAmount,
            conversionType: 'SELL',
            exchangeRate: Number(conversion.exchangeRate),
          },
        },
      });

      await this.prisma.account.update({
        where: { id: conversion.accountId },
        data: { balance: newBalance },
      });

      await this.prisma.conversion.update({
        where: { id: conversionId },
        data: {
          transactionId: creditTx.id,
          brlExchanged: brlFromExchange,
          brlCharged: brlToSend,
          spreadBrl,
          okxOrderId: okxSellResult.ordId,
          okxTradingFee,
          totalOkxFees: okxTradingFee,
          grossProfit: spreadBrl,
          netProfit,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      this.logger.log(`[SELL] Venda concluída: ${usdtAmount} USDT → R$ ${brlToSend} creditado na conta`);

      return {
        message: 'Venda concluída com sucesso',
        conversionId,
        usdtSold: usdtAmount,
        brlFromExchange,
        brlCredited: brlToSend,
        newBalance,
        spreadBrl,
        netProfit,
        transactionId: creditTx.id,
      };
    } catch (error) {
      await this.prisma.conversion.update({
        where: { id: conversionId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
        },
      });
      throw error;
    }
  }

  /**
   * Lista depósitos pendentes na OKX para reconciliação
   */
  async checkPendingSellDeposits() {
    const pendingSells = await this.prisma.conversion.findMany({
      where: { type: 'SELL', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    const recentDeposits = await this.okxService.getRecentDeposits();

    const matched: any[] = [];

    for (const sell of pendingSells) {
      const matchingDeposit = recentDeposits.find((d: any) => {
        const depositAmount = parseFloat(d.amt || '0');
        const expectedAmount = Number(sell.usdtPurchased);
        return Math.abs(depositAmount - expectedAmount) < 0.01 && d.state === '2';
      });

      if (matchingDeposit) {
        await this.prisma.conversion.update({
          where: { id: sell.id },
          data: {
            status: 'USDT_RECEIVED',
            okxDepositId: matchingDeposit.depId,
          },
        });

        matched.push({
          conversionId: sell.id,
          depositId: matchingDeposit.depId,
          amount: matchingDeposit.amt,
        });

        this.logger.log(`[SELL] Depósito identificado: ${matchingDeposit.amt} USDT para conversão ${sell.id}`);
      }
    }

    return { pendingCount: pendingSells.length, matchedCount: matched.length, matched };
  }

  /**
   * Retorna dados para o frontend construir e assinar a transação USDT
   * Client-side signing: a chave privada nunca sai do dispositivo do usuário
   */
  async getSellTransactionData(
    customerId: string,
    walletId: string,
    usdtAmount: number,
    network: 'SOLANA' | 'TRON',
  ) {
    if (usdtAmount < 10) {
      throw new BadRequestException('Quantidade mínima é 10 USDT');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, customerId },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    if (wallet.network !== network) {
      throw new BadRequestException(`Carteira é da rede ${wallet.network}, não ${network}`);
    }

    if (!wallet.externalAddress) {
      throw new BadRequestException('Carteira não possui endereço externo');
    }

    const depositAddress = await this.getUsdtDepositAddress(network);
    const quote = await this.quoteSellUsdt(customerId, usdtAmount, network);

    const txData: any = {
      network,
      fromAddress: wallet.externalAddress,
      toAddress: depositAddress.address,
      usdtAmount,
      usdtAmountRaw: Math.floor(usdtAmount * 1_000_000),
      quote: {
        brlToReceive: quote.brlToReceive,
        exchangeRate: quote.exchangeRate,
        spreadPercent: quote.spreadPercent,
      },
    };

    if (network === 'SOLANA') {
      const [fromAta, toAta, toAtaExists] = await Promise.all([
        this.solanaService.getAssociatedTokenAddress(wallet.externalAddress),
        this.solanaService.getAssociatedTokenAddress(depositAddress.address),
        this.solanaService.checkAtaExists(depositAddress.address),
      ]);
      
      txData.tokenMint = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
      txData.tokenProgram = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      txData.associatedTokenProgram = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
      txData.decimals = 6;
      txData.fromAta = fromAta;
      txData.toAta = toAta;
      txData.toAtaExists = toAtaExists;
      txData.instructions = [
        'Use @solana/spl-token para criar transferência SPL Token',
        'Fonte: fromAta, Destino: toAta',
        toAtaExists 
          ? 'ATA destino já existe, use transfer() diretamente'
          : 'ATA destino NÃO existe, use getOrCreateAssociatedTokenAccount() antes de transfer()',
      ];
    } else {
      txData.contractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      txData.decimals = 6;
      txData.instructions = [
        'Use TronWeb para chamar contract.transfer(toAddress, amount)',
        'Configure tronWeb com sua private key',
        'O método .send() retorna o txHash',
      ];
    }

    return txData;
  }

  /**
   * Processa venda após o frontend assinar e submeter a transação
   * Recebe apenas o txHash para rastreamento
   */
  async submitSignedSellTransaction(
    customerId: string,
    walletId: string,
    usdtAmount: number,
    network: 'SOLANA' | 'TRON',
    txHash: string,
  ) {
    if (!txHash) {
      throw new BadRequestException('txHash é obrigatório');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, customerId },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    if (!wallet.externalAddress) {
      throw new BadRequestException('Carteira sem endereço externo');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const account = await this.prisma.account.findFirst({ where: { customerId } });
    if (!account) {
      throw new BadRequestException('Conta não encontrada');
    }

    const quote = await this.quoteSellUsdt(customerId, usdtAmount, network);

    const conversion = await this.prisma.conversion.create({
      data: {
        customerId,
        accountId: account.id,
        type: 'SELL',
        brlCharged: 0,
        brlExchanged: quote.brlFromExchange,
        spreadPercent: quote.spreadPercent / 100,
        spreadBrl: quote.spreadBrl,
        usdtPurchased: usdtAmount,
        usdtWithdrawn: 0,
        exchangeRate: quote.exchangeRate,
        network,
        walletAddress: wallet.externalAddress,
        walletId: wallet.id,
        okxWithdrawFee: 0,
        okxTradingFee: quote.okxTradingFee,
        totalOkxFees: quote.okxTradingFee,
        grossProfit: quote.spreadBrl,
        netProfit: quote.spreadBrl - quote.okxTradingFee,
        status: 'PENDING',
        txHash,
      },
    });

    this.logger.log(`[SELL] Transação submetida: ${usdtAmount} USDT, txHash: ${txHash}`);

    return {
      conversionId: conversion.id,
      status: 'PENDING',
      txHash,
      usdtAmount,
      network,
      quote: {
        brlToReceive: quote.brlToReceive,
        exchangeRate: quote.exchangeRate,
        spreadPercent: quote.spreadPercent,
      },
      message: 'Transação registrada. Após confirmação na blockchain e depósito na OKX, o BRL será creditado.',
      nextStep: 'Aguarde confirmação. Use GET /wallet/pending-sell-deposits para verificar status.',
    };
  }

  async getGaslessSellTransactionData(
    customerId: string,
    walletId: string,
    usdtAmount: number,
    network: 'SOLANA' | 'TRON',
  ) {
    if (usdtAmount < 10) {
      throw new BadRequestException('Quantidade mínima é 10 USDT');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, customerId },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    if (wallet.network !== network) {
      throw new BadRequestException(`Carteira é da rede ${wallet.network}, não ${network}`);
    }

    if (!wallet.externalAddress) {
      throw new BadRequestException('Carteira não possui endereço externo');
    }

    const feeAmount = network === 'SOLANA' ? SOL_FEE_FOR_USDT_TRANSFER : TRX_FEE_FOR_USDT_TRANSFER;
    const feeCurrency = network === 'SOLANA' ? 'SOL' : 'TRX';

    let feeTxHash: string | null = null;
    let feeUsd = 0;

    if (network === 'SOLANA') {
      const currentSolBalance = await this.solanaService.getSolBalance(wallet.externalAddress);
      
      if (currentSolBalance < feeAmount) {
        this.logger.log(`[GASLESS] Enviando ${feeAmount} SOL para ${wallet.externalAddress}`);
        try {
          const result = await this.solanaService.sendSol(wallet.externalAddress, feeAmount);
          feeTxHash = result.txId;
          this.logger.log(`[GASLESS] SOL enviado com sucesso: ${feeTxHash}`);
        } catch (error: any) {
          this.logger.error(`[GASLESS] Erro ao enviar SOL: ${error.message}`);
          throw new BadRequestException(`Falha ao enviar taxa de rede: ${error.message}`);
        }
      } else {
        this.logger.log(`[GASLESS] Carteira já tem ${currentSolBalance} SOL, não precisa enviar mais`);
      }
      
      const solPrice = 200;
      feeUsd = feeAmount * solPrice;
    } else {
      const currentTrxBalance = await this.tronService.getTrxBalance(wallet.externalAddress);
      
      if (currentTrxBalance < feeAmount) {
        this.logger.log(`[GASLESS] Enviando ${feeAmount} TRX para ${wallet.externalAddress}`);
        try {
          const result = await this.tronService.sendTrx(wallet.externalAddress, feeAmount);
          feeTxHash = result.txId;
          this.logger.log(`[GASLESS] TRX enviado com sucesso: ${feeTxHash}`);
        } catch (error: any) {
          this.logger.error(`[GASLESS] Erro ao enviar TRX: ${error.message}`);
          throw new BadRequestException(`Falha ao enviar taxa de rede: ${error.message}`);
        }
      } else {
        this.logger.log(`[GASLESS] Carteira já tem ${currentTrxBalance} TRX, não precisa enviar mais`);
      }
      
      const trxPrice = 0.25;
      feeUsd = feeAmount * trxPrice;
    }

    const depositAddress = await this.getUsdtDepositAddress(network);
    const quote = await this.quoteSellUsdt(customerId, usdtAmount, network);

    const networkFeeBrl = feeUsd * quote.exchangeRate;

    const txData: any = {
      network,
      fromAddress: wallet.externalAddress,
      toAddress: depositAddress.address,
      usdtAmount,
      usdtAmountRaw: Math.floor(usdtAmount * 1_000_000),
      gasless: {
        feeSent: feeTxHash ? true : false,
        feeTxHash,
        feeAmount,
        feeCurrency,
        feeUsd,
        feeBrl: networkFeeBrl,
      },
      quote: {
        brlToReceive: quote.brlToReceive - networkFeeBrl,
        brlToReceiveBeforeFee: quote.brlToReceive,
        networkFeeBrl,
        exchangeRate: quote.exchangeRate,
        spreadPercent: quote.spreadPercent,
      },
    };

    if (network === 'SOLANA') {
      const [fromAta, toAta, toAtaExists] = await Promise.all([
        this.solanaService.getAssociatedTokenAddress(wallet.externalAddress),
        this.solanaService.getAssociatedTokenAddress(depositAddress.address),
        this.solanaService.checkAtaExists(depositAddress.address),
      ]);
      
      txData.tokenMint = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
      txData.tokenProgram = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      txData.associatedTokenProgram = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
      txData.decimals = 6;
      txData.fromAta = fromAta;
      txData.toAta = toAta;
      txData.toAtaExists = toAtaExists;
      txData.instructions = [
        'Use @solana/spl-token para criar transferência SPL Token',
        'Fonte: fromAta, Destino: toAta',
        toAtaExists 
          ? 'ATA destino já existe, use transfer() diretamente'
          : 'ATA destino NÃO existe, use getOrCreateAssociatedTokenAccount() antes de transfer()',
      ];
    } else {
      txData.contractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      txData.decimals = 6;
      txData.instructions = [
        'Use TronWeb para criar transferência TRC20',
        'contract.methods.transfer(toAddress, amount).send()',
        'Assine com sua privateKey configurada no TronWeb',
      ];
    }

    return txData;
  }

  async getCustomerConversions(customerId: string, type?: 'BUY' | 'SELL', status?: string) {
    const where: any = { customerId };
    if (type) where.type = type;
    if (status) where.status = status;

    const conversions = await this.prisma.conversion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        network: true,
        walletAddress: true,
        usdtPurchased: true,
        brlCharged: true,
        brlExchanged: true,
        spreadBrl: true,
        txHash: true,
        createdAt: true,
        completedAt: true,
        errorMessage: true,
      },
    });

    return conversions.map(c => ({
      ...c,
      usdtAmount: c.usdtPurchased ? parseFloat(c.usdtPurchased.toString()) : null,
      brlAmount: c.brlExchanged ? parseFloat(c.brlExchanged.toString()) : (c.brlCharged ? parseFloat(c.brlCharged.toString()) : null),
      spreadBrl: c.spreadBrl ? parseFloat(c.spreadBrl.toString()) : null,
      statusLabel: this.getConversionStatusLabel(c.status, c.type),
    }));
  }

  private getConversionStatusLabel(status: string, type?: string): string {
    // Labels específicos por tipo de conversão
    if (type === 'BUY') {
      const buyLabels: Record<string, string> = {
        'PENDING': 'Iniciando compra...',
        'PIX_SENT': 'Enviando BRL para exchange...',
        'USDT_BOUGHT': 'USDT comprado, preparando envio...',
        'USDT_WITHDRAWN': 'Enviando USDT para sua carteira...',
        'COMPLETED': 'Concluído - USDT enviado!',
        'FAILED': 'Falhou',
      };
      return buyLabels[status] || status;
    }
    
    // Labels para SELL
    const sellLabels: Record<string, string> = {
      'PENDING': 'Aguardando confirmação do depósito',
      'USDT_RECEIVED': 'USDT recebido, vendendo...',
      'USDT_SOLD': 'USDT vendido, creditando saldo...',
      'COMPLETED': 'Concluído - BRL creditado!',
      'FAILED': 'Falhou',
    };
    return sellLabels[status] || status;
  }

  /**
   * Venda custodial: usa a chave privada armazenada para enviar USDT ao endereço OKX
   * e cria a conversão automaticamente. Não exige assinatura externa.
   */
  async sellUsdtCustodial(
    customerId: string,
    walletId: string,
    usdtAmount: number,
    network: 'SOLANA' | 'TRON',
  ) {
    if (usdtAmount < 5) {
      throw new BadRequestException('Quantidade mínima é 5 USDT');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, customerId },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    if (!wallet.encryptedPrivateKey) {
      throw new BadRequestException(
        'Wallet não possui chave privada (não é custodial). Use o fluxo de assinatura externa.',
      );
    }

    if (wallet.network !== network) {
      throw new BadRequestException(`Carteira é da rede ${wallet.network}, não ${network}`);
    }

    if (!wallet.externalAddress) {
      throw new BadRequestException('Carteira não possui endereço');
    }

    if (Number(wallet.balance) < usdtAmount) {
      // Sync balance before failing
      await this.syncWalletBalance(walletId, customerId);
      const refreshed = await this.prisma.wallet.findUnique({ where: { id: walletId } });
      if (Number(refreshed?.balance) < usdtAmount) {
        throw new BadRequestException('Saldo insuficiente na carteira');
      }
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const account = await this.prisma.account.findFirst({ where: { customerId } });
    if (!account) {
      throw new BadRequestException('Conta não encontrada');
    }

    // Get OKX deposit address
    let depositAddress: { address: string };
    try {
      depositAddress = await this.getUsdtDepositAddress(network);
    } catch (error: any) {
      throw new BadRequestException(`Endereço de depósito ${network} não configurado`);
    }

    const quote = await this.quoteSellUsdt(customerId, usdtAmount, network);

    // Ensure wallet has enough gas for the transaction
    try {
      if (network === 'SOLANA') {
        const solBalance = await this.solanaService.getSolBalance(wallet.externalAddress);
        if (solBalance < SOL_FEE_FOR_USDT_TRANSFER) {
          this.logger.log(`[SELL-CUSTODIAL] Enviando ${SOL_FEE_FOR_USDT_TRANSFER} SOL para ${wallet.externalAddress}`);
          await this.solanaService.sendSol(wallet.externalAddress, SOL_FEE_FOR_USDT_TRANSFER);
        }
      } else {
        const trxBalance = await this.tronService.getTrxBalance(wallet.externalAddress);
        if (trxBalance < TRX_FEE_FOR_USDT_TRANSFER) {
          this.logger.log(`[SELL-CUSTODIAL] Enviando ${TRX_FEE_FOR_USDT_TRANSFER} TRX para ${wallet.externalAddress}`);
          await this.tronService.sendTrx(wallet.externalAddress, TRX_FEE_FOR_USDT_TRANSFER);
        }
      }
    } catch (error: any) {
      this.logger.error(`[SELL-CUSTODIAL] Erro ao enviar taxa de rede: ${error.message}`);
      throw new BadRequestException(`Falha ao enviar taxa de rede: ${error.message}`);
    }

    // Wait for gas transaction to confirm before sending USDT
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Send USDT from custodial wallet to OKX deposit address using stored private key
    let sendResult: { txId: string; success: boolean };

    try {
      if (network === 'SOLANA') {
        sendResult = await this.sendSolanaUsdt(walletId, customerId, depositAddress.address, usdtAmount);
      } else {
        sendResult = await this.sendTronUsdt(walletId, customerId, depositAddress.address, usdtAmount);
      }
    } catch (error: any) {
      this.logger.error(`[SELL-CUSTODIAL] Erro ao enviar USDT: ${error.message}`);
      const msg = error?.response?.message || error?.message || 'Erro ao enviar USDT';
      throw new BadRequestException(msg);
    }

    // Sync balance after send
    await this.syncWalletBalance(walletId, customerId).catch(() => {});

    // Create conversion record with txHash
    const conversion = await this.prisma.conversion.create({
      data: {
        customerId,
        accountId: account.id,
        type: 'SELL',
        brlCharged: 0,
        brlExchanged: quote.brlFromExchange,
        spreadPercent: quote.spreadPercent / 100,
        spreadBrl: quote.spreadBrl,
        usdtPurchased: usdtAmount,
        usdtWithdrawn: 0,
        exchangeRate: quote.exchangeRate,
        network,
        walletAddress: wallet.externalAddress,
        walletId: wallet.id,
        okxWithdrawFee: 0,
        okxTradingFee: quote.okxTradingFee,
        totalOkxFees: quote.okxTradingFee,
        grossProfit: quote.spreadBrl,
        netProfit: quote.spreadBrl - quote.okxTradingFee,
        status: 'PENDING',
        txHash: sendResult.txId,
      },
    });

    this.logger.log(
      `[SELL-CUSTODIAL] USDT enviado da wallet ${walletId} para OKX: ${usdtAmount} USDT, txHash: ${sendResult.txId}`,
    );

    return {
      conversionId: conversion.id,
      status: 'PENDING',
      txHash: sendResult.txId,
      usdtAmount,
      network,
      quote: {
        brlToReceive: quote.brlToReceive,
        exchangeRate: quote.exchangeRate,
        spreadPercent: quote.spreadPercent,
      },
      message: 'USDT enviado automaticamente para a exchange. Após confirmação na blockchain, o BRL será creditado na sua conta.',
    };
  }

  async getConversionDetails(customerId: string, conversionId: string) {
    const conversion = await this.prisma.conversion.findFirst({
      where: { id: conversionId, customerId },
      include: {
        wallet: { select: { externalAddress: true, network: true, label: true } },
      },
    });

    if (!conversion) {
      throw new NotFoundException('Conversão não encontrada');
    }

    return {
      id: conversion.id,
      type: conversion.type,
      status: conversion.status,
      statusLabel: this.getConversionStatusLabel(conversion.status, conversion.type),
      network: conversion.network,
      usdtAmount: conversion.usdtPurchased ? parseFloat(conversion.usdtPurchased.toString()) : null,
      brlCharged: conversion.brlCharged ? parseFloat(conversion.brlCharged.toString()) : null,
      brlExchanged: conversion.brlExchanged ? parseFloat(conversion.brlExchanged.toString()) : null,
      spreadBrl: conversion.spreadBrl ? parseFloat(conversion.spreadBrl.toString()) : null,
      exchangeRate: conversion.exchangeRate ? parseFloat(conversion.exchangeRate.toString()) : null,
      txHash: conversion.txHash,
      walletAddress: conversion.walletAddress || conversion.wallet?.externalAddress,
      createdAt: conversion.createdAt,
      completedAt: conversion.completedAt,
      errorMessage: conversion.errorMessage,
    };
  }
}
