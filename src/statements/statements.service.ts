// src/statements/statements.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, TransactionType, TransactionStatus } from '@prisma/client';
import { StatementQueryDto } from './dto/statement-query.dto';

export type ExternalBalanceRaw = {
  accountId?: string;
  balance?: number;
  availableBalance?: number;
  blockedAmount?: number;
  blockedBalance?: number;
  status?: string;
  pixKey?: string | null;
  updatedAt?: string;
};

export type ExternalBalance = {
  accountId?: string;
  balance: number;
  availableBalance: number;
  blockedAmount: number;
  blockedBalance: number; // alias para compatibilidade
  status?: string;
  pixKey?: string | null;
  updatedAt: string;
};

type BalanceLike = {
  accountId?: string;
  balance?: number;
  availableBalance?: number;
  blockedAmount?: number;
  blockedBalance?: number;
  status?: string;
  pixKey?: string | null;
  updatedAt?: string;
};

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(private readonly prisma: PrismaService) { }

  private async resolveAccountByAccountHolderId(accountHolderId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { externalClientId: accountHolderId },
      select: { id: true },
    });

    if (!customer) throw new BadRequestException('Cliente não encontrado');

    const account = await this.prisma.account.findUnique({
      where: { customerId: customer.id },
    });

    if (!account) throw new BadRequestException('Conta não encontrada');

    return account;
  }

  private isCredit(type: TransactionType): boolean {
    const creditTypes: TransactionType[] = [
      'PIX_IN',
      'TRANSFER_IN',
      'DEPOSIT',
      'REVERSAL', // se for reversão de débito
    ];
    return creditTypes.includes(type);
  }

  /**
   * Usado por: GET /statements/account-holders/:accountHolderId/balance
   */
  async getBalance(accountHolderId: string): Promise<ExternalBalance> {
    // use a implementação existente extraída para um método interno
    const raw = await this.getBalanceInternal(accountHolderId);
    return this.normalizeBalance(raw as BalanceLike);
  }

  // Mova aqui a chamada real ao provedor (BRX/Inter/DB). Mantém stub seguro se ainda não tiver.
  private async getBalanceInternal(accountHolderId: string): Promise<BalanceLike> {
    // ...existing code que você já tinha para buscar o saldo externo...
    return {
      accountId: accountHolderId,
      availableBalance: 0,
      blockedAmount: 0,
      status: 'inactive',
      pixKey: null,
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeBalance(data: BalanceLike) {
    const available = Number(data?.availableBalance ?? data?.balance ?? 0);
    const blocked = Number(data?.blockedAmount ?? data?.blockedBalance ?? 0);
    return {
      accountId: data?.accountId,
      balance: data?.balance ?? available + blocked,
      availableBalance: available,
      blockedAmount: blocked,
      blockedBalance: blocked, // alias compatível
      status: data?.status,
      pixKey: data?.pixKey ?? null,
      updatedAt: data?.updatedAt ?? new Date().toISOString(),
    };
  }

  /**
   * Usado por: GET /statements/account-holders/:accountHolderId
   */
  async getStatement(
    accountHolderId: string,
    page = 1,
    limit = 50,
    startDate?: string,
    endDate?: string,
  ) {
    const account = await this.resolveAccountByAccountHolderId(accountHolderId);

    const now = new Date();
    const from = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = endDate ? new Date(endDate) : now;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Datas inválidas');
    }

    // Saldo de abertura: saldo após a última transação ANTES do período
    const lastBefore = await this.prisma.transaction.findFirst({
      where: { accountId: account.id, createdAt: { lt: from } },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });
    const openingBalance = lastBefore?.balanceAfter ?? new Prisma.Decimal(0);

    // Total de transações no período (para paginação)
    const total = await this.prisma.transaction.count({
      where: {
        accountId: account.id,
        createdAt: { gte: from, lte: to },
      },
    });

    const skip = Math.max(0, (page - 1) * limit);

    // Transações no período (paginadas)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: account.id,
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'asc' }, // extrato cronológico
      skip,
      take: limit,
      select: {
        id: true,
        createdAt: true,
        type: true,
        status: true,
        amount: true,
        description: true,
        balanceBefore: true,
        balanceAfter: true,
        externalId: true,
        metadata: true,
      },
    });

    // Totais (do recorte retornado)
    let totalCredits = new Prisma.Decimal(0);
    let totalDebits = new Prisma.Decimal(0);
    for (const t of transactions) {
      if (this.isCredit(t.type)) {
        totalCredits = totalCredits.add(t.amount);
      } else {
        totalDebits = totalDebits.add(t.amount);
      }
    }

    const closingBalance =
      transactions.length > 0 ? transactions[transactions.length - 1].balanceAfter : openingBalance;

    const items = transactions.map((t) => ({
      id: t.id,
      date: t.createdAt,
      type: t.type,
      status: t.status,
      description: t.description,
      amount: Number(t.amount),
      direction: this.isCredit(t.type) ? 'C' : 'D',
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
      externalId: t.externalId,
      metadata: t.metadata ?? null,
    }));

    return {
      accountId: account.id,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      pagination: {
        page,
        limit,
        total,
        returned: items.length,
      },
      openingBalance: Number(openingBalance),
      totalCredits: Number(totalCredits),
      totalDebits: Number(totalDebits),
      closingBalance: Number(closingBalance),
      items,
    };
  }

  // Admin: ver extrato por customerId
  async getStatementByCustomerIdAdmin(customerId: string, query: StatementQueryDto) {
    return this.getCustomerStatement(customerId, query);
  }

  async getCustomerStatement(customerId: string, query: StatementQueryDto) {
    // Busca a account do customer
    const account = await this.prisma.account.findUnique({
      where: { customerId },
      select: { id: true, balance: true },
    });
    if (!account) throw new BadRequestException('Conta não encontrada');

    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;
    const limit = query.limit ?? 200;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Datas inválidas');
    }

    // Saldo de abertura
    const lastBefore = await this.prisma.transaction.findFirst({
      where: { accountId: account.id, createdAt: { lt: from } },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });
    const openingBalance = lastBefore?.balanceAfter ?? new Prisma.Decimal(0);

    // ✅ Validar e converter tipos
    const whereClause: Prisma.TransactionWhereInput = {
      accountId: account.id,
      createdAt: { gte: from, lte: to },
    };

    // ✅ Validar enum TransactionType
    if (query.type) {
      const validType = this.validateTransactionType(query.type);
      whereClause.type = validType;
    }

    // ✅ Validar enum TransactionStatus
    if (query.status) {
      const validStatus = this.validateTransactionStatus(query.status);
      whereClause.status = validStatus;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        type: true,
        status: true,
        amount: true,
        description: true,
        balanceBefore: true,
        balanceAfter: true,
        externalId: true,
        metadata: true,
      },
    });

    // Totais
    let totalCredits = new Prisma.Decimal(0);
    let totalDebits = new Prisma.Decimal(0);
    for (const t of transactions) {
      if (this.isCredit(t.type)) {
        totalCredits = totalCredits.add(t.amount);
      } else {
        totalDebits = totalDebits.add(t.amount);
      }
    }

    const closingBalance =
      transactions.length > 0 ? transactions[transactions.length - 1].balanceAfter : openingBalance;

    const items = transactions.map((t) => ({
      id: t.id,
      date: t.createdAt,
      type: t.type,
      status: t.status,
      description: t.description,
      amount: Number(t.amount),
      direction: this.isCredit(t.type) ? 'C' : 'D',
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
      externalId: t.externalId,
      metadata: t.metadata ?? null,
    }));

    return {
      accountId: account.id,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      openingBalance: Number(openingBalance),
      totalCredits: Number(totalCredits),
      totalDebits: Number(totalDebits),
      closingBalance: Number(closingBalance),
      count: items.length,
      items,
    };
  }

  // ==================== VALIDADORES ====================

  private validateTransactionType(type: string): TransactionType {
    const validTypes = Object.values(TransactionType);
    if (!validTypes.includes(type as TransactionType)) {
      throw new BadRequestException(
        `Tipo de transação inválido. Valores válidos: ${validTypes.join(', ')}`
      );
    }
    return type as TransactionType;
  }

  private validateTransactionStatus(status: string): TransactionStatus {
    const validStatuses = Object.values(TransactionStatus);
    if (!validStatuses.includes(status as TransactionStatus)) {
      throw new BadRequestException(
        `Status de transação inválido. Valores válidos: ${validStatuses.join(', ')}`
      );
    }
    return status as TransactionStatus;
  }
}
