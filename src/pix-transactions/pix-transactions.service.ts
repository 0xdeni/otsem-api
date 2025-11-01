import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type HistoryParams = {
    accountHolderId: string;
    page: number;
    pageSize: number;
    status?: string; // created|pending|confirmed|failed|refunded
};

@Injectable()
export class PixTransactionsService {
    constructor(private prisma: PrismaService) { }

    private toBRL(n: number | string) {
        const x = Number(n);
        return Math.round(x * 100); // cents
    }
    private centsToReal(cents: number | null): number {
        if (cents == null) return 0;
        return Number(cents) / 100;
    }

    /** Junta `deposit` (entradas) e `payment` (saídas) num feed único */
    async getHistory({ accountHolderId, page, pageSize, status }: HistoryParams) {
        const skip = (page - 1) * pageSize;

        // filtros por status (normaliza)
        const statusMap = {
            created: ['CREATED'],
            pending: ['PENDING', 'PROCESSING'],
            confirmed: ['CONFIRMED', 'COMPLETED', 'PAID'],
            failed: ['FAILED', 'ERROR'],
            refunded: ['REFUNDED', 'ESTORNADO'],
        } as const;
        const whereDeposit: any = { accountHolderId: accountHolderId || undefined };
        const wherePayment: any = {};

        if (status && statusMap[status as keyof typeof statusMap]) {
            const list = statusMap[status as keyof typeof statusMap];
            // nos seus webhooks, `deposit.status` e `payment.status` são strings livres
            whereDeposit.status = { in: list };
            wherePayment.status = { in: list };
        }

        const [depositCount, paymentCount] = await Promise.all([
            this.prisma.deposit.count({ where: whereDeposit }),
            this.prisma.payment.count({ where: wherePayment }),
        ]);
        const total = depositCount + paymentCount;

        // Pegamos um range um pouco maior e depois ordenamos/limitamos
        const [deposits, payments] = await Promise.all([
            this.prisma.deposit.findMany({
                where: whereDeposit,
                orderBy: { receiptDate: 'desc' },
                take: pageSize,
                skip,
            }),
            this.prisma.payment.findMany({
                where: wherePayment,
                orderBy: { paymentDate: 'desc' },
                take: pageSize,
                skip,
            }),
        ]);

        // Normaliza para o shape do front
        const items = [
            ...deposits.map(d => ({
                id: `dep_${d.id}`,
                endToEndId: d.endToEnd || undefined,
                direction: 'in' as const,
                amount: this.centsToReal(d.receiptValue),
                key: d.receiverPixKey ?? undefined,
                keyType: undefined,
                description: d.payerMessage ?? null,
                status: (d.status || 'confirmed').toLowerCase(),
                createdAt: (d.receiptDate ?? d.createdAt).toISOString(),
                settledAt: d.receiptDate?.toISOString?.() ?? null,
                counterpartyName: d.payerName ?? null,
                counterpartyTaxNumber: d.payerTaxNumber ?? null,
            })),
            ...payments.map(p => ({
                id: `pay_${p.id}`,
                endToEndId: p.endToEnd || undefined,
                direction: 'out' as const,
                amount: this.centsToReal(p.paymentValue),
                key: p.receiverPixKey ?? undefined,
                keyType: undefined,
                description: p.errorMessage ? `Erro: ${p.errorMessage}` : null,
                status: (p.status || 'pending').toLowerCase(),
                createdAt: (p.paymentDate ?? p.createdAt).toISOString(),
                settledAt: null,
                counterpartyName: p.receiverName ?? null,
                counterpartyTaxNumber: p.receiverTaxNumber ?? null,
            })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
            items: items.slice(0, pageSize),
            total,
            page,
            pageSize,
        };
    }

    /** Envia Pix (stub para ligar na BRX). */
    async sendPix(accountHolderId: string, dto: { pixKey: string; amount: string; description?: string; endToEnd?: string }) {
        // TODO: integrar no seu client BRX real (usar dto.endToEnd se vier da pré-consulta)
        // Exemplo de “sucesso” simulado:
        const endToEndId = dto.endToEnd || `E2E-${Date.now()}`;

        // opcional: registrar um `payment` local em “PROCESSING”
        await this.prisma.payment.create({
            data: {
                endToEnd: endToEndId,
                paymentValue: this.toBRL(dto.amount),
                paymentDate: new Date(),
                receiverPixKey: dto.pixKey,
                receiverName: null,
                receiverTaxNumber: null,
                payerName: null,
                payerTaxNumber: null,
                payerBankCode: null,
                payerBankBranch: null,
                payerBankAccount: null,
                payerISPB: null,
                status: 'PROCESSING',
                bankPayload: { accountHolderId, ...dto },
            },
        });

        return { ok: true, message: 'PIX enviado (simulado).', endToEndId };
    }

    /** Cria um charge (QR / copia-e-cola). */
    async createCharge(accountHolderId: string, dto: { amount: string; description?: string }) {
        // TODO: integrar com BRX payload de cobrança imediata e retornar imagem base64 e copia-e-cola reais
        // Aqui geramos um “fake” base64 só para funcionar o front:
        const copyPaste = `00020126${Date.now()}52040000...5802BR5910OTSEM LTDA...540${dto.amount}`;
        const pngBase64 = ''; // se tiver uma lib para gerar QR, preencha aqui

        // opcional: também pode gravar algo numa tabela “charge” se tiver
        return {
            ok: true,
            message: 'Charge gerada (simulada).',
            copyPaste,
            qrCodeBase64: pngBase64 || undefined,
            txId: `TX-${Date.now()}`,
        };
    }
}
