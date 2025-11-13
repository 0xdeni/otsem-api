// src/brx-webhooks/brx-webhooks.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { Request } from 'express';

/* 🧩 Funções auxiliares para normalizar tipos */
const toNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? undefined : n;
  }
  return undefined;
};

const toDate = (v: unknown): string | undefined => {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
};

/* 🧠 Schemas flexíveis (aceitam variações da BRX) */
const baseIdSchema = z.object({
  EndToEnd: z.string().min(3).optional(),
  EndToEndId: z.string().min(3).optional(),
  EndToEndIdentifier: z.string().min(3).optional(),
  AccountHolderId: z.string().uuid().optional(),
  AccoutHolderId: z.string().uuid().optional(), // typo da BRX
});

const cashInSchema = baseIdSchema.extend({
  ReceiptValue: z.preprocess(toNumber, z.number()),
  ReceiptDate: z.preprocess(toDate, z.string()),

  PayerName: z.string().nullable().optional(),
  PayerTaxNumber: z.string().optional(),
  PayerBankCode: z.string().optional(),
  PayerBankBranch: z.string().optional(),
  PayerBankAccount: z.string().optional(),
  PayerBankAccountDigit: z.string().optional(),
  PayerISPB: z.string().optional(),
  PayerMessage: z.string().nullable().optional(),

  ReceiverName: z.string().nullable().optional(),
  ReceiverTaxNumber: z.string().nullable().optional(),
  ReceiverBankCode: z.string().nullable().optional(),
  ReceiverBankBranch: z.string().nullable().optional(),
  ReceiverBankAccount: z.string().nullable().optional(),
  ReceiverBankAccountDigit: z.string().nullable().optional(),
  ReceiverISPB: z.string().nullable().optional(),
  ReceiverPixKey: z.string().nullable().optional(),

  Status: z.string().nullable().optional(),
  StatusId: z.number().optional(),
});

const cashOutSchema = baseIdSchema.extend({
  Identifier: z.string().optional(),
  PaymentValue: z.preprocess(toNumber, z.number()),
  PaymentDate: z.preprocess(toDate, z.string()),

  ReceiverName: z.string().optional(),
  ReceiverTaxNumber: z.string().optional(),
  ReceiverBankCode: z.string().optional(),
  ReceiverBankBranch: z.string().optional(),
  ReceiverBankAccount: z.string().optional(),
  ReceiverISPB: z.string().optional(),
  ReceiverPixKey: z.string().optional(),

  PayerName: z.string().optional(),
  PayerTaxNumber: z.string().optional(),
  PayerBankCode: z.string().optional(),
  PayerBankBranch: z.string().optional(),
  PayerBankAccount: z.string().optional(),
  PayerISPB: z.string().optional(),

  Status: z.string().optional(),
  StatusId: z.number().optional(),
  ErrorMessage: z.string().nullable().optional(),
});

const refundSchema = baseIdSchema
  .extend({
    RefundValue: z.preprocess(toNumber, z.number().optional()).optional(),
    RefundDate: z.preprocess(toDate, z.string().optional()).optional(),
    Status: z.string().optional(),
    StatusId: z.number().optional(),
    PayerTaxNumber: z.string().optional(),
    ReceiverTaxNumber: z.string().optional(),
  })
  .passthrough();

@Injectable()
export class BrxWebhooksService {
  private readonly logger = new Logger(BrxWebhooksService.name);

  constructor(private readonly prisma: PrismaService) { }

  /* ⚙️ Se a BRX passar a assinar, validar aqui */
  private checkSignature(_req: Request, _headers: any): boolean | null {
    // TODO: Implementar validação de assinatura BRX quando disponível
    return null;
  }

  private getEndToEnd(obj: any): string | undefined {
    return obj.EndToEnd ?? obj.EndToEndId ?? obj.EndToEndIdentifier;
  }

  private getAccountHolderId(obj: any): string | undefined {
    return obj.AccountHolderId ?? obj.AccoutHolderId;
  }

  private async resolveCustomerId(taxNumber?: string): Promise<string | null> {
    if (!taxNumber) return null;

    const clean = taxNumber.replace(/\D/g, '');

    let found = null;

    if (clean.length === 11) {
      // CPF
      found = await this.prisma.customer.findFirst({ where: { cpf: clean } });
    } else if (clean.length === 14) {
      // CNPJ
      found = await this.prisma.customer.findFirst({ where: { cnpj: clean } });
    } else {
      this.logger.warn(`⚠️ Documento inválido: ${clean}`);
      return null;
    }

    return found?.id ?? null;
  }

  /* 💰 CASH-IN (PIX Recebido) */
  async handleCashIn(req: Request, headers: any): Promise<void> {
    const body = req.body;
    const parsed = cashInSchema.safeParse(body);

    if (!parsed.success) {
      this.logger.error(
        '❌ [Webhook BRX] Falha no parse CASH-IN:',
        parsed.error.flatten().fieldErrors,
      );

      await this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'cash_in',
          payload: body as Prisma.InputJsonValue,
          endToEnd: this.getEndToEnd(body) ?? undefined,
          processed: false,
          error: JSON.stringify(parsed.error.flatten().fieldErrors),
        },
      });
      return;
    }

    const data = parsed.data;
    const endToEnd = this.getEndToEnd(data);

    if (!endToEnd) {
      this.logger.warn('⚠️ CASH-IN sem EndToEnd, ignorando');
      return;
    }

    // ✅ Verificar duplicação
    const existing = await this.prisma.deposit.findUnique({ where: { endToEnd } });
    if (existing) {
      this.logger.warn(`⚠️ CASH-IN duplicado: ${endToEnd}`);

      await this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'cash_in',
          payload: body as Prisma.InputJsonValue,
          endToEnd,
          processed: true,
          error: 'Duplicado - ignorado',
        },
      });
      return;
    }

    const customerId = await this.resolveCustomerId(data.PayerTaxNumber);

    // ✅ Criar deposit + log em transação
    await this.prisma.$transaction([
      this.prisma.deposit.create({
        data: {
          endToEnd,
          receiptValue: Math.round(Number(data.ReceiptValue) * 100),
          receiptDate: new Date(data.ReceiptDate),

          payerName: data.PayerName ?? undefined,
          payerTaxNumber: data.PayerTaxNumber?.replace(/\D/g, '') ?? undefined,
          payerMessage: data.PayerMessage ?? undefined,

          receiverPixKey: data.ReceiverPixKey ?? undefined,

          status: 'CONFIRMED',
          bankPayload: body as Prisma.InputJsonValue,
          customerId: customerId ?? undefined,
        },
      }),
      this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'cash_in',
          payload: body as Prisma.InputJsonValue,
          endToEnd,
          processed: true,
        },
      }),
    ]);

    this.logger.log(`✅ CASH-IN processado: ${endToEnd} | Customer: ${customerId || 'N/A'}`);
  }

  /* 💸 CASH-OUT (PIX Enviado) */
  async handleCashOut(req: Request, headers: any): Promise<void> {
    const body = req.body;
    const parsed = cashOutSchema.safeParse(body);

    if (!parsed.success) {
      this.logger.error(
        '❌ [Webhook BRX] Falha no parse CASH-OUT:',
        parsed.error.flatten().fieldErrors,
      );

      await this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'cash_out',
          payload: body as Prisma.InputJsonValue,
          endToEnd: this.getEndToEnd(body) ?? undefined,
          processed: false,
          error: JSON.stringify(parsed.error.flatten().fieldErrors),
        },
      });
      return;
    }

    const data = parsed.data;
    const endToEnd = this.getEndToEnd(data);

    if (!endToEnd) {
      this.logger.warn('⚠️ CASH-OUT sem EndToEnd, ignorando');
      return;
    }

    // ✅ Verificar duplicação
    const existing = await this.prisma.payment.findUnique({ where: { endToEnd } });
    if (existing) {
      this.logger.warn(`⚠️ CASH-OUT duplicado: ${endToEnd}`);

      await this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'cash_out',
          payload: body as Prisma.InputJsonValue,
          endToEnd,
          processed: true,
          error: 'Duplicado - ignorado',
        },
      });
      return;
    }

    const customerId = await this.resolveCustomerId(data.PayerTaxNumber);

    // ✅ Mapear status
    let status: 'PENDING' | 'CONFIRMED' | 'FAILED' = 'PENDING';
    if (data.Status === 'CONFIRMED' || data.StatusId === 1) {
      status = 'CONFIRMED';
    } else if (data.Status === 'FAILED' || data.StatusId === 2) {
      status = 'FAILED';
    }

    // ✅ Criar payment + log em transação
    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          endToEnd,
          identifier: data.Identifier ?? undefined,
          paymentValue: Math.round(Number(data.PaymentValue) * 100),
          paymentDate: new Date(data.PaymentDate),

          receiverName: data.ReceiverName ?? undefined,
          receiverTaxNumber: data.ReceiverTaxNumber?.replace(/\D/g, '') ?? undefined,
          receiverPixKey: data.ReceiverPixKey ?? undefined,

          payerName: data.PayerName ?? undefined,
          payerTaxNumber: data.PayerTaxNumber?.replace(/\D/g, '') ?? undefined,

          status,
          errorMessage: data.ErrorMessage ?? undefined,
          bankPayload: body as Prisma.InputJsonValue,
          customerId: customerId ?? undefined,
        },
      }),
      this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'cash_out',
          payload: body as Prisma.InputJsonValue,
          endToEnd,
          processed: true,
        },
      }),
    ]);

    this.logger.log(`✅ CASH-OUT processado: ${endToEnd} | Status: ${status}`);
  }

  /* 🔁 REFUND (Devolução) */
  async handleRefund(req: Request, headers: any): Promise<void> {
    const body = req.body;
    const parsed = refundSchema.safeParse(body);

    if (!parsed.success) {
      this.logger.error(
        '❌ [Webhook BRX] Falha no parse REFUND:',
        parsed.error.flatten().fieldErrors,
      );

      await this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'refund',
          payload: body as Prisma.InputJsonValue,
          endToEnd: this.getEndToEnd(body) ?? undefined,
          processed: false,
          error: JSON.stringify(parsed.error.flatten().fieldErrors),
        },
      });
      return;
    }

    const data = parsed.data;
    const endToEnd = this.getEndToEnd(data);

    if (!endToEnd) {
      this.logger.warn('⚠️ REFUND sem EndToEnd, ignorando');
      return;
    }

    // ✅ Verificar duplicação
    const existing = await this.prisma.refund.findUnique({ where: { endToEnd } });
    if (existing) {
      this.logger.warn(`⚠️ REFUND duplicado: ${endToEnd}`);

      await this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'refund',
          payload: body as Prisma.InputJsonValue,
          endToEnd,
          processed: true,
          error: 'Duplicado - ignorado',
        },
      });
      return;
    }

    // ✅ Resolver customer (tentar por pagador ou recebedor)
    const taxNumber = data.PayerTaxNumber ?? data.ReceiverTaxNumber;
    const customerId = await this.resolveCustomerId(taxNumber);

    // ✅ Criar refund + log em transação
    await this.prisma.$transaction([
      this.prisma.refund.create({
        data: {
          endToEnd,
          status: data.Status ?? undefined,
          statusId: data.StatusId ?? undefined,
          valueCents: data.RefundValue
            ? Math.round(Number(data.RefundValue) * 100)
            : undefined,
          refundDate: data.RefundDate ? new Date(data.RefundDate) : undefined,
          bankPayload: body as Prisma.InputJsonValue,
          customerId: customerId ?? undefined,
        },
      }),
      this.prisma.webhookLog.create({
        data: {
          source: 'BRX',
          type: 'refund',
          payload: body as Prisma.InputJsonValue,
          endToEnd,
          processed: true,
        },
      }),
    ]);

    this.logger.log(`✅ REFUND processado: ${endToEnd}`);
  }
}
