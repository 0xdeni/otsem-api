// src/brx-webhooks/brx-webhooks.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { Request } from 'express';

const prisma = new PrismaClient();

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
    AccoutHolderId: z.string().uuid().optional(),
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

const refundSchema = baseIdSchema.extend({
    RefundValue: z.preprocess(toNumber, z.number().optional()).optional(),
    RefundDate: z.preprocess(toDate, z.string().optional()).optional(),
    Status: z.string().optional(),
    StatusId: z.number().optional(),
}).passthrough();

@Injectable()
export class BrxWebhooksService {
    /* ⚙️ Se a BRX passar a assinar, validar aqui */
    private checkSignature(_req: Request, _headers: any): boolean | null {
        return null; // ainda não implementado pela BRX
    }

    private getEndToEnd(obj: any): string | undefined {
        return obj.EndToEnd ?? obj.EndToEndId ?? obj.EndToEndIdentifier;
    }

    private getAccountHolderId(obj: any): string | undefined {
        return obj.AccountHolderId ?? obj.AccoutHolderId;
    }



    private async resolveCustomerId(taxNumber?: string) {
        if (!taxNumber) return null;

        const clean = taxNumber.replace(/\D/g, '');

        let found = null;

        if (clean.length === 11) {
            // CPF
            found = await prisma.customer.findFirst({ where: { cpf: clean } });
        } else if (clean.length === 14) {
            // CNPJ
            found = await prisma.customer.findFirst({ where: { cnpj: clean } });
        } else {
            // Documento inválido
            return null;
        }

        return found?.id ?? null;
    }


    /* 💰 CASH-IN */
    async handleCashIn(req: Request, headers: any) {
        const body = req.body;
        const parsed = cashInSchema.safeParse(body);

        if (!parsed.success) {
            console.error('❌ [Webhook] Falha no parse CASH-IN:', parsed.error.flatten().fieldErrors);
            await prisma.webhookEvent.create({
                data: {
                    kind: 'cash-in',
                    endToEnd: this.getEndToEnd(body) ?? null,
                    rawBody: body,
                    headers,
                    ip: req.socket.remoteAddress ?? undefined,
                    signatureOk: this.checkSignature(req, headers),
                    valid: false,
                    validationErrors: parsed.error.flatten().fieldErrors,
                },
            });
            return;
        }

        const data = parsed.data;
        const endToEnd = this.getEndToEnd(data);
        if (!endToEnd) return;

        const existing = await prisma.deposit.findUnique({ where: { endToEnd } });
        if (existing) {
            await prisma.webhookEvent.create({
                data: { kind: 'cash-in', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress ?? undefined, valid: true, note: 'duplicate_ignored' },
            });
            return;
        }

        const accountHolderId = this.getAccountHolderId(data);
        const customerId = await this.resolveCustomerId(data.PayerTaxNumber);

        await prisma.$transaction([
            prisma.deposit.create({
                data: {
                    endToEnd,
                    accountHolderId: accountHolderId ?? null,
                    receiptValue: Math.round(Number(data.ReceiptValue) * 100),
                    receiptDate: new Date(data.ReceiptDate),
                    payerName: data.PayerName,
                    payerTaxNumber: data.PayerTaxNumber?.replace(/\D/g, ''),
                    payerBankCode: data.PayerBankCode,
                    payerBankBranch: data.PayerBankBranch,
                    payerBankAccount: data.PayerBankAccount,
                    payerBankAccountDigit: data.PayerBankAccountDigit,
                    payerISPB: data.PayerISPB,
                    payerMessage: data.PayerMessage,
                    receiverName: data.ReceiverName,
                    receiverTaxNumber: data.ReceiverTaxNumber?.replace(/\D/g, ''),
                    receiverBankCode: data.ReceiverBankCode,
                    receiverBankBranch: data.ReceiverBankBranch,
                    receiverBankAccount: data.ReceiverBankAccount,
                    receiverBankAccountDigit: data.ReceiverBankAccountDigit,
                    receiverISPB: data.ReceiverISPB,
                    receiverPixKey: data.ReceiverPixKey,
                    status: data.Status,
                    statusId: data.StatusId,
                    bankPayload: body,
                    customerId,
                },
            }),
            prisma.webhookEvent.create({
                data: { kind: 'cash-in', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress ?? undefined, valid: true },
            }),
        ]);
    }

    /* 💸 CASH-OUT */
    async handleCashOut(req: Request, headers: any) {
        const body = req.body;
        const parsed = cashOutSchema.safeParse(body);

        if (!parsed.success) {
            console.error('❌ [Webhook] Falha no parse CASH-OUT:', parsed.error.flatten().fieldErrors);
            await prisma.webhookEvent.create({
                data: { kind: 'cash-out', endToEnd: this.getEndToEnd(body) ?? null, rawBody: body, headers, ip: req.socket.remoteAddress ?? undefined, valid: false, validationErrors: parsed.error.flatten().fieldErrors },
            });
            return;
        }

        const data = parsed.data;
        const endToEnd = this.getEndToEnd(data);
        if (!endToEnd) return;

        const existing = await prisma.payment.findUnique({ where: { endToEnd } });
        if (existing) {
            await prisma.webhookEvent.create({
                data: { kind: 'cash-out', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress ?? undefined, valid: true, note: 'duplicate_ignored' },
            });
            return;
        }

        const customerId = await this.resolveCustomerId(data.PayerTaxNumber);

        await prisma.$transaction([
            prisma.payment.create({
                data: {
                    endToEnd,
                    identifier: data.Identifier ?? null,
                    paymentValue: Math.round(Number(data.PaymentValue) * 100),
                    paymentDate: new Date(data.PaymentDate),
                    receiverName: data.ReceiverName,
                    receiverTaxNumber: data.ReceiverTaxNumber?.replace(/\D/g, ''),
                    receiverBankCode: data.ReceiverBankCode,
                    receiverBankBranch: data.ReceiverBankBranch,
                    receiverBankAccount: data.ReceiverBankAccount,
                    receiverISPB: data.ReceiverISPB,
                    receiverPixKey: data.ReceiverPixKey,
                    payerName: data.PayerName,
                    payerTaxNumber: data.PayerTaxNumber?.replace(/\D/g, ''),
                    payerBankCode: data.PayerBankCode,
                    payerBankBranch: data.PayerBankBranch,
                    payerBankAccount: data.PayerBankAccount,
                    payerISPB: data.PayerISPB,
                    status: data.Status,
                    statusId: data.StatusId,
                    errorMessage: data.ErrorMessage ?? null,
                    bankPayload: body,
                    customerId,
                },
            }),
            prisma.webhookEvent.create({
                data: { kind: 'cash-out', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress ?? undefined, valid: true },
            }),
        ]);
    }

    /* 🔁 REFUND */
    async handleRefund(req: Request, headers: any) {
        const body = req.body;
        const parsed = refundSchema.safeParse(body);

        if (!parsed.success) {
            console.error('❌ [Webhook] Falha no parse REFUND:', parsed.error.flatten().fieldErrors);
            await prisma.webhookEvent.create({
                data: { kind: 'refunds', endToEnd: this.getEndToEnd(body) ?? null, rawBody: body, headers, ip: req.socket.remoteAddress ?? undefined, valid: false, validationErrors: parsed.error.flatten().fieldErrors },
            });
            return;
        }

        const data = parsed.data;
        const endToEnd = this.getEndToEnd(data);
        if (!endToEnd) return;

        const existing = await prisma.refund.findUnique({ where: { endToEnd } });
        if (existing) {
            await prisma.webhookEvent.create({
                data: { kind: 'refunds', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress ?? undefined, valid: true, note: 'duplicate_ignored' },
            });
            return;
        }

        let customerId: string | null = null;
        const tax =
            typeof data.PayerTaxNumber === 'string' ? data.PayerTaxNumber :
                typeof data.ReceiverTaxNumber === 'string' ? data.ReceiverTaxNumber :
                    undefined;
        if (tax) customerId = await this.resolveCustomerId(tax);

        await prisma.$transaction([
            prisma.refund.create({
                data: {
                    endToEnd,
                    status: data.Status ?? null,
                    statusId: data.StatusId ?? null,
                    valueCents: data.RefundValue ? Math.round(Number(data.RefundValue) * 100) : null,
                    refundDate: data.RefundDate ? new Date(data.RefundDate) : null,
                    bankPayload: body,
                    customerId,
                },
            }),
            prisma.webhookEvent.create({
                data: { kind: 'refunds', endToEnd, rawBody: body, headers, ip: req.socket.remoteAddress ?? undefined, valid: true },
            }),
        ]);
    }
}
