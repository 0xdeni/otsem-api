import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PixService {
    private readonly logger = new Logger(PixService.name);
    constructor(private prisma: PrismaService) { }

    async handleCashInFromMtBank(body: any, signature?: string) {
        const accId = body?.AccoutHolderId || body?.AccountHolderId;
        const endToEnd = String(body?.EndToEnd ?? '');
        const status = String(body?.Status ?? '').toUpperCase();
        const amount = new Decimal(String(body?.ReceiptValue ?? '0'));

        // 1) registrar evento bruto
        const event = await this.prisma.pixWebhookEvent.create({
            data: {
                provider: 'mtbank',
                eventType: 'cash-in',
                signature: signature ?? null,
                endToEndId: endToEnd || null,
                raw: body,
            },
        });

        // 2) só processa se status final (ajuste a lista conforme o banco)
        const accepted = (process.env.MTBANK_STATUS_OK || 'CONFIRMED,COMPLETED,PAID')
            .split(',')
            .map((s) => s.trim().toUpperCase());

        if (!accepted.includes(status)) {
            this.logger.warn(`cash-in ignorado por status=${status} e2e=${endToEnd}`);
            await this.prisma.pixWebhookEvent.update({
                where: { id: event.id },
                data: { processedAt: new Date(), error: `ignored_status_${status}` },
            });
            return { ok: true, ignored: true, status };
        }

        // 3) idempotência por EndToEnd
        const reference = endToEnd || `mtbank-${Date.now()}`;

        // 4) localizar cliente por externalAccountHolderId
        let customer = accId
            ? await this.prisma.customer.findUnique({ where: { externalAccountHolderId: accId } })
            : null;

        if (!customer) {
            // opcional: criar cliente automaticamente pelo AccoutHolderId
            customer = await this.prisma.customer.create({
                data: {
                    name: body?.ReceiverName || 'Cliente',
                    taxNumber: body?.ReceiverTaxNumber || null,
                    externalAccountHolderId: accId || null,
                },
            });
        }

        // 5) upsert carteira BRL
        const wallet = await this.prisma.wallet.upsert({
            where: { customerId_currency: { customerId: customer.id, currency: 'BRL' } },
            create: { customerId: customer.id, currency: 'BRL', balance: new Decimal(0) },
            update: {},
        });

        // 6) transação idempotente
        const result = await this.prisma.$transaction(async (trx) => {
            const exists = await trx.transaction.findUnique({ where: { reference } });
            if (exists) {
                await trx.pixWebhookEvent.update({
                    where: { id: event.id },
                    data: { processedAt: new Date(), error: 'already_processed' },
                });
                return { credited: false, duplicate: true };
            }

            const newBalance = wallet.balance.plus(amount);

            await trx.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance },
            });

            const txn = await trx.transaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'CREDIT',
                    amount,
                    reference,
                    metadata: {
                        provider: 'mtbank',
                        payer: { name: body?.PayerName, taxNumber: body?.PayerTaxNumber },
                        receiver: { name: body?.ReceiverName, taxNumber: body?.ReceiverTaxNumber },
                    },
                },
            });

            await trx.pixWebhookEvent.update({
                where: { id: event.id },
                data: { processedAt: new Date() },
            });

            return { credited: true, txId: txn.id, balance: newBalance.toString() };
        });

        return { ok: true, reference, ...result };
    }

    // listar depósitos (admin)
    async listDeposits(take = 50, skip = 0) {
        return this.prisma.transaction.findMany({
            where: { type: 'CREDIT' },
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            include: { wallet: { include: { customer: true } } },
        });
    }
}
