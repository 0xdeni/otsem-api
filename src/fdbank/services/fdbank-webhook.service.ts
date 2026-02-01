import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FdbankWebhookService {
    private readonly logger = new Logger(FdbankWebhookService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Process incoming PIX webhook from FDBank
     * FDBank sends webhook notifications when PIX transfers are received.
     * The payload structure may vary - we handle it flexibly.
     */
    async handlePixReceived(payload: any): Promise<void> {
        this.logger.log('Processing FDBank PIX webhook...');
        this.logger.debug('Payload:', JSON.stringify(payload, null, 2));

        // FDBank may send data in different formats - handle flexibly
        // Common structures: { pix: [...] }, { data: {...} }, or direct transfer object
        const pixList = payload.pix || payload.data?.pix || (Array.isArray(payload) ? payload : [payload]);

        if (!Array.isArray(pixList) || pixList.length === 0) {
            this.logger.warn('No PIX data found in FDBank webhook payload');
            await this.logWebhook('pix_received_empty', payload, false, 'No PIX data in payload');
            return;
        }

        for (const pix of pixList) {
            try {
                const endToEnd = pix.endToEndId || pix.e2eId || pix.endToEnd || pix.id || '';
                const txid = pix.txid || pix.externalId || pix.transactionId || '';
                const valorReais = parseFloat(pix.valor || pix.value || pix.amount || '0') || 0;

                if (!endToEnd && !txid) {
                    this.logger.warn('PIX without identifier, skipping');
                    continue;
                }

                // Check for duplicates
                const identifier = endToEnd || txid;
                const existingTx = await this.prisma.transaction.findFirst({
                    where: {
                        OR: [
                            endToEnd ? { endToEnd } : {},
                            txid ? { txid } : {},
                        ].filter(o => Object.keys(o).length > 0),
                    },
                });

                if (existingTx && existingTx.status === 'COMPLETED') {
                    this.logger.warn(`Duplicate FDBank PIX: ${identifier}`);
                    await this.logWebhook('pix_received', pix, true, 'Duplicate - ignored');
                    continue;
                }

                // Try to find matching PENDING transaction by txid (from QR code)
                let pendingTx: any = null;
                if (txid) {
                    pendingTx = await this.prisma.transaction.findFirst({
                        where: {
                            OR: [{ txid }, { externalId: txid }],
                            status: 'PENDING',
                            bankProvider: 'FDBANK',
                        },
                        include: { account: { include: { customer: true } } },
                    });
                }

                // Also try matching by externalId from QR code generation
                if (!pendingTx && pix.externalId) {
                    pendingTx = await this.prisma.transaction.findFirst({
                        where: {
                            txid: pix.externalId,
                            status: 'PENDING',
                            bankProvider: 'FDBANK',
                        },
                        include: { account: { include: { customer: true } } },
                    });
                }

                if (pendingTx && pendingTx.accountId) {
                    // CASE 1: QR Code with linked customer - auto credit
                    const txAccount = pendingTx.account;
                    const customerId = txAccount?.customerId;
                    this.logger.log(`Found PENDING transaction for FDBank PIX | txid: ${txid} | Customer: ${customerId}`);

                    const valorDecimal = new Prisma.Decimal(valorReais);
                    const balanceBefore = txAccount.balance;
                    const balanceAfter = balanceBefore.add(valorDecimal);

                    await this.prisma.$transaction([
                        this.prisma.transaction.update({
                            where: { id: pendingTx.id },
                            data: {
                                endToEnd: endToEnd || undefined,
                                amount: valorDecimal,
                                balanceBefore,
                                balanceAfter,
                                payerName: pix.payerName || pix.pagador?.nome || pix.senderName,
                                payerTaxNumber: pix.payerTaxNumber || pix.pagador?.cpfCnpj || pix.pagador?.cpf,
                                payerMessage: pix.infoPagador || pix.message,
                                status: 'COMPLETED',
                                bankPayload: pix as Prisma.InputJsonValue,
                                processedAt: new Date(),
                                completedAt: new Date(),
                            },
                        }),
                        this.prisma.account.update({
                            where: { id: txAccount.id },
                            data: { balance: balanceAfter },
                        }),
                        this.prisma.webhookLog.create({
                            data: {
                                source: 'FDBANK',
                                type: 'pix_received',
                                payload: pix as Prisma.InputJsonValue,
                                endToEnd: endToEnd || undefined,
                                txid: txid || undefined,
                                processed: true,
                                processedAt: new Date(),
                            },
                        }),
                    ]);

                    this.logger.log(`FDBank PIX credited: ${identifier} | R$ ${valorReais} | Customer: ${customerId}`);
                } else {
                    // CASE 2: Unlinked PIX - log for manual review
                    this.logger.log(`FDBank PIX without linked customer: ${identifier}`);

                    await this.logWebhook(
                        'pix_received_unlinked',
                        pix,
                        true,
                        'PIX without linked customer - manual review required',
                    );

                    this.logger.log(`FDBank PIX saved to webhook_logs (no customer): ${identifier} | R$ ${valorReais}`);
                }
            } catch (error: any) {
                this.logger.error(`Error processing FDBank PIX: ${error.message}`);
                await this.logWebhook('pix_received', pix, false, error.message);
            }
        }
    }

    /**
     * Log webhook to database
     */
    private async logWebhook(type: string, payload: any, processed: boolean, error?: string) {
        await this.prisma.webhookLog.create({
            data: {
                source: 'FDBANK',
                type,
                payload: payload as Prisma.InputJsonValue,
                endToEnd: payload.endToEndId || payload.e2eId || payload.endToEnd,
                txid: payload.txid || payload.externalId,
                processed,
                error,
                processedAt: processed ? new Date() : undefined,
            },
        });
    }
}
