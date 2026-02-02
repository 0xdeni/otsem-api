import {
    Injectable,
    Logger,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, TransactionType } from '@prisma/client';
import { FdbankPixTransferService } from './fdbank-pix-transfer.service';
import { FdbankBankAccountService } from './fdbank-bank-account.service';
import { FdbankPixKeyService } from './fdbank-pix-key.service';
import { SendPixDto, PixPaymentResponseDto } from '../../inter/dto/send-pix.dto';
import { CreatePixChargeDto } from '../../inter/dto/create-pix-charge.dto';

@Injectable()
export class FdbankPixIntegrationService {
    private readonly logger = new Logger(FdbankPixIntegrationService.name);
    private readonly fdbankPixKeyId = process.env.FDBANK_PIX_KEY_ID || '0c818990-6f70-4056-abc0-e4cfe876bb15';

    constructor(
        private readonly prisma: PrismaService,
        private readonly pixTransferService: FdbankPixTransferService,
        private readonly bankAccountService: FdbankBankAccountService,
        private readonly pixKeyService: FdbankPixKeyService,
    ) {}

    // ==================== COBRANÇAS (QR CODE) ====================

    /**
     * Generate txid for tracking customer charges
     */
    private generateTxid(customerId?: string): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();

        if (customerId) {
            const shortId = customerId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12).toUpperCase();
            const txid = `FDBNK${shortId}${timestamp}${randomPart}`;
            return txid.substring(0, 35).padEnd(26, 'X');
        }

        const random = Math.random().toString(36).substring(2, 14).toUpperCase();
        const txid = `FDBNK${random}${timestamp}${randomPart}`;
        return txid.substring(0, 35).padEnd(26, 'X');
    }

    /**
     * Create PIX charge (QR Code) for deposit - mirrors InterPixService.createCobranca
     */
    async createCobranca(dto: CreatePixChargeDto, customerId?: string): Promise<any> {
        this.logger.log(`Creating FDBank PIX charge ${dto.valor ? `R$ ${dto.valor}` : '(open value)'} for customer: ${customerId || 'none'}...`);

        if (!this.fdbankPixKeyId) {
            throw new BadRequestException(
                'FDBANK_PIX_KEY_ID not configured. Set it in .env',
            );
        }

        const txid = this.generateTxid(customerId);
        const valor = dto.valor || 10;

        let customerName = 'Cliente OTSEM';
        if (customerId) {
            const customer = await this.prisma.customer.findUnique({
                where: { id: customerId },
                select: { name: true },
            });
            if (customer?.name) {
                customerName = customer.name;
            }
        }

        try {
            const qrCodeResult = await this.pixTransferService.generatePixDynamicQrCode(
                this.fdbankPixKeyId,
                valor,
                dto.descricao || `Deposito para ${customerName}`,
                txid,
            );

            this.logger.log(`QR Code created via FDBank: externalId=${txid}, response keys: ${JSON.stringify(Object.keys(qrCodeResult || {}))}`);

            // FDBank returns { result: { copyPaste, image, ... }, isValid, message }
            // Inter returns { pixCopiaECola, ... } at the top level.
            // Normalize so the frontend always gets `pixCopiaECola`.
            const resultObj = qrCodeResult.result || qrCodeResult;
            if (!qrCodeResult.pixCopiaECola && resultObj.copyPaste) {
                qrCodeResult.pixCopiaECola = resultObj.copyPaste;
                this.logger.log(`Mapped FDBank result.copyPaste to pixCopiaECola`);
            }

            if (customerId) {
                const account = await this.prisma.account.findUnique({
                    where: { customerId },
                });

                if (account) {
                    const valorDecimal = dto.valor ? new Prisma.Decimal(dto.valor) : new Prisma.Decimal(0);
                    await this.prisma.transaction.create({
                        data: {
                            accountId: account.id,
                            type: 'PIX_IN',
                            status: 'PENDING',
                            amount: valorDecimal,
                            balanceBefore: account.balance,
                            balanceAfter: account.balance,
                            description: dto.descricao || `Aguardando deposito PIX de ${customerName}`,
                            txid,
                            bankPayload: qrCodeResult as Prisma.InputJsonValue,
                            bankProvider: 'FDBANK',
                        },
                    });
                    this.logger.log(`Transaction PENDING created for customer ${customerId} | txid: ${txid} | valor: ${dto.valor || 'open'}`);
                } else {
                    this.logger.warn(`Account not found for customer ${customerId}`);
                }
            }

            return {
                ...qrCodeResult,
                txid,
                customerId,
                bankProvider: 'FDBANK',
                message: customerId
                    ? 'Cobranca criada via FDBank. Quando paga, o valor sera creditado automaticamente.'
                    : 'Cobranca criada via FDBank. Sem customer vinculado - credito manual necessario.',
            };
        } catch (error: any) {
            this.logger.error(`Error creating FDBank charge: ${error.message}`);
            throw new BadRequestException(
                error.response?.data?.message || error.message || 'Error creating FDBank PIX charge',
            );
        }
    }

    /**
     * Get charge details by txid
     */
    async getCobranca(txid: string): Promise<any> {
        this.logger.log(`Querying FDBank charge: ${txid}...`);

        // FDBank doesn't have a direct charge query endpoint like Inter.
        // Look up from our database
        const tx = await this.prisma.transaction.findFirst({
            where: {
                OR: [{ txid }, { externalId: txid }],
                bankProvider: 'FDBANK',
            },
            include: { account: true },
        });

        if (!tx) {
            throw new BadRequestException('Charge not found');
        }

        return {
            txid,
            status: tx.status,
            valor: { original: tx.amount.toString() },
            bankPayload: tx.bankPayload,
        };
    }

    // ==================== ENVIAR PIX ====================

    /**
     * Send PIX with full validations - mirrors InterPixService.sendPix
     */
    async sendPix(
        customerId: string,
        dto: SendPixDto,
    ): Promise<PixPaymentResponseDto> {
        this.logger.log(`Sending FDBank PIX: R$ ${dto.valor} to ${dto.chaveDestino}`);

        if (!customerId) {
            throw new BadRequestException('customerId not provided');
        }

        // 1. Validate KYC
        await this.validateKyc(customerId);

        // 2. Validate destination key
        await this.validateDestinationKey(customerId, dto.chaveDestino, dto.tipoChave);

        // 3. Validate balance
        await this.validateBalance(customerId, dto.valor);

        // 4. Validate limits
        await this.validateLimits(customerId, dto.valor);

        try {
            // Map tipoChave to FDBank pixKeyType
            const pixKeyTypeMap: Record<string, string> = {
                CPF: 'cpf',
                CNPJ: 'cnpj',
                EMAIL: 'email',
                TELEFONE: 'phone',
                CHAVE_ALEATORIA: 'random',
                CHAVE: 'random',
            };

            const externalId = `FDBNK-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

            // FDBank PIX transfer payload per API docs
            // Note: endToEndId is generated by the bank, not the client
            const payload = {
                pixKey: dto.chaveDestino,
                pixKeyType: pixKeyTypeMap[dto.tipoChave] || 'cpf',
                value: dto.valor,
                message: dto.descricao || 'PIX Transfer',
                externalId,
            };

            const pixResponse = await this.pixTransferService.createPixTransfer(payload);

            // FDBank wraps responses in { result: {...}, isValid, message }
            const pixData = pixResponse.result || pixResponse;

            this.logger.log(`FDBank PIX sent: ${pixData.endToEndId || pixData.id || 'unknown'}`);

            // Record in database
            await this.createPaymentRecord(customerId, dto, pixData);

            return {
                endToEndId: pixData.endToEndId || pixData.id || externalId,
                valor: dto.valor,
                horario: pixData.createdAt || pixData.date || new Date().toISOString(),
                status: pixData.status || 'PROCESSANDO',
                transacaoId: pixData.id || pixData.transactionId,
                destinatario: pixData.destinatario || pixData.receiver,
            };
        } catch (error: any) {
            const message = error.response?.data?.message || error.message;
            this.logger.error(`Error sending FDBank PIX: ${message}`);

            await this.createFailedPayment(customerId, dto, message);

            throw new InternalServerErrorException(`Error sending FDBank PIX: ${message}`);
        }
    }

    /**
     * Send PIX internal (no KYC/balance validations) - mirrors InterPixService.sendPixInternal
     */
    async sendPixInternal(dto: {
        valor: number;
        chaveDestino: string;
        tipoChave: string;
        descricao?: string;
        nomeFavorecido?: string;
    }): Promise<PixPaymentResponseDto> {
        this.logger.log(`[INTERNAL] Sending FDBank PIX: R$ ${dto.valor} to ${dto.chaveDestino}`);

        try {
            const pixKeyTypeMap: Record<string, string> = {
                CPF: 'cpf',
                CNPJ: 'cnpj',
                EMAIL: 'email',
                TELEFONE: 'phone',
                CHAVE_ALEATORIA: 'random',
                CHAVE: 'random',
            };

            const externalId = `FDBNK-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

            const payload = {
                pixKey: dto.chaveDestino,
                pixKeyType: pixKeyTypeMap[dto.tipoChave] || 'cpf',
                value: dto.valor,
                message: dto.descricao || 'PIX Transfer',
                externalId,
            };

            const pixResponse = await this.pixTransferService.createPixTransfer(payload);
            const pixData = pixResponse.result || pixResponse;

            this.logger.log(`[INTERNAL] FDBank PIX sent: ${pixData.endToEndId || pixData.id || 'unknown'}`);

            return {
                endToEndId: pixData.endToEndId || pixData.id || externalId,
                valor: dto.valor,
                horario: pixData.createdAt || pixData.date || new Date().toISOString(),
                status: pixData.status || 'PROCESSANDO',
                transacaoId: pixData.id || pixData.transactionId,
                destinatario: pixData.destinatario || pixData.receiver,
            };
        } catch (error: any) {
            const message = error.response?.data?.message || error.message;
            this.logger.error(`[INTERNAL] Error sending FDBank PIX: ${message}`);
            throw new InternalServerErrorException(`Error sending FDBank PIX: ${message}`);
        }
    }

    /**
     * Get PIX transfer status
     */
    async getPixStatus(endToEndId: string): Promise<any> {
        this.logger.log(`Querying FDBank PIX status: ${endToEndId}`);

        // Check local database
        const payment = await this.prisma.payment.findFirst({
            where: { endToEnd: endToEndId, bankProvider: 'FDBANK' },
        });

        if (payment) {
            return {
                endToEndId,
                status: payment.status,
                valor: payment.paymentValue / 100,
                bankPayload: payment.bankPayload,
            };
        }

        throw new BadRequestException(`PIX transfer not found: ${endToEndId}`);
    }

    // ==================== RECONCILIATION ====================

    /**
     * Reconcile pending FDBank charges
     * Checks bank statement for completed transactions that aren't credited locally
     */
    async reconciliarCobrancas(dias: number = 7): Promise<{
        processadas: number;
        jaProcessadas: number;
        pendentes: number;
        erros: string[];
        detalhes: any[];
    }> {
        this.logger.log(`Starting FDBank reconciliation for last ${dias} days...`);

        const resultado = {
            processadas: 0,
            jaProcessadas: 0,
            pendentes: 0,
            erros: [] as string[],
            detalhes: [] as any[],
        };

        try {
            // Get bank statement from FDBank
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - dias);
            const endDate = new Date();

            let statement: any;
            try {
                statement = await this.bankAccountService.getBankAccountStatement({
                    startDate: startDate.toISOString().slice(0, 10),
                    endDate: endDate.toISOString().slice(0, 10),
                    page: 1,
                    perPage: 100,
                });
            } catch (err: any) {
                this.logger.error(`Error fetching FDBank statement: ${err.message}`);
                resultado.erros.push(`Error fetching statement: ${err.message}`);
                return resultado;
            }

            // Extract PIX credit transactions from statement
            // FDBank returns nested: { result: { result: { result: [...] } } }
            const transactions =
                statement?.result?.result?.result ||
                statement?.result?.result ||
                statement?.result ||
                statement?.items ||
                statement?.data ||
                statement ||
                [];
            if (!Array.isArray(transactions)) {
                this.logger.log('No transactions array found in FDBank statement');
                return resultado;
            }

            this.logger.log(`FDBank statement returned ${transactions.length} entries`);

            for (const entry of transactions) {
                try {
                    // Look for PIX credit entries (incoming PIX)
                    // FDBank uses method:"pix" + direction:"cashin" for incoming PIX
                    const entryMethod = (entry.method || '').toLowerCase();
                    const entryDirection = (entry.direction || '').toLowerCase();
                    const entryStatus = (entry.status || '').toLowerCase();
                    const isPixCredit =
                        (entryMethod === 'pix' && entryDirection === 'cashin') ||
                        ((entry.type || '').toUpperCase().includes('PIX') && (entry.direction === 'CREDIT' || entry.creditDebit === 'C'));

                    if (!isPixCredit) continue;
                    if (entryStatus !== 'completed') continue;

                    const endToEnd = entry.endToEndId || entry.e2eId || entry.externalId || '';
                    const valor = Math.abs(Number(entry.value || entry.amount || 0));
                    const externalId = entry.externalId || entry.id || '';

                    if (!endToEnd && !externalId) continue;

                    // Check if already processed
                    const existingTx = await this.prisma.transaction.findFirst({
                        where: {
                            OR: [
                                endToEnd ? { endToEnd } : {},
                                externalId ? { externalId } : {},
                            ].filter(o => Object.keys(o).length > 0),
                            status: 'COMPLETED',
                            bankProvider: 'FDBANK',
                        },
                    });

                    if (existingTx) {
                        resultado.jaProcessadas++;
                        continue;
                    }

                    // Try to match with pending transaction
                    const pendingTx = await this.prisma.transaction.findFirst({
                        where: {
                            OR: [
                                entry.message ? { txid: { contains: entry.message } } : {},
                                externalId ? { txid: externalId } : {},
                            ].filter(o => Object.keys(o).length > 0),
                            status: 'PENDING',
                            bankProvider: 'FDBANK',
                        },
                        include: { account: true },
                    });

                    if (pendingTx?.account?.customerId) {
                        const account = pendingTx.account;
                        const balanceBefore = account.balance;
                        const balanceAfter = balanceBefore.add(new Prisma.Decimal(valor));

                        await this.prisma.$transaction([
                            this.prisma.account.update({
                                where: { id: account.id },
                                data: { balance: balanceAfter },
                            }),
                            this.prisma.transaction.update({
                                where: { id: pendingTx.id },
                                data: {
                                    status: 'COMPLETED',
                                    endToEnd: endToEnd || undefined,
                                    amount: new Prisma.Decimal(valor),
                                    balanceBefore,
                                    balanceAfter,
                                    payerName: entry.payerName || entry.senderName || 'FDBank PIX',
                                    payerTaxNumber: entry.payerTaxNumber || undefined,
                                    externalData: entry as any,
                                    completedAt: new Date(),
                                },
                            }),
                        ]);

                        resultado.processadas++;
                        resultado.detalhes.push({
                            endToEnd,
                            status: 'PROCESSADA',
                            customerId: account.customerId,
                            valor,
                        });

                        this.logger.log(`Reconciled FDBank: ${endToEnd || externalId} - R$ ${valor} for ${account.customerId}`);
                    } else {
                        resultado.pendentes++;
                        resultado.detalhes.push({
                            endToEnd,
                            status: 'PENDING_NO_MATCH',
                            valor,
                        });
                    }
                } catch (err: any) {
                    resultado.erros.push(`${entry.endToEndId || entry.id}: ${err.message}`);
                }
            }

            this.logger.log(`FDBank reconciliation done: ${resultado.processadas} processed, ${resultado.jaProcessadas} already processed, ${resultado.pendentes} pending, ${resultado.erros.length} errors`);
            return resultado;
        } catch (error: any) {
            this.logger.error(`Error in FDBank reconciliation: ${error.message}`);
            throw error;
        }
    }

    // ==================== VALIDATIONS ====================

    private async validateKyc(customerId: string): Promise<void> {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
            select: { accountStatus: true, name: true },
        });

        if (!customer) {
            throw new BadRequestException('Cliente nao encontrado');
        }

        if (customer.accountStatus !== 'approved') {
            const statusMessages: Record<string, string> = {
                not_requested: 'Voce precisa iniciar a verificacao de identidade (KYC) antes de enviar PIX.',
                requested: 'Sua verificacao de identidade (KYC) esta pendente. Aguarde a aprovacao.',
                in_review: 'Sua verificacao de identidade (KYC) esta em analise. Aguarde a aprovacao.',
                rejected: 'Sua verificacao de identidade (KYC) foi rejeitada. Entre em contato com o suporte.',
                suspended: 'Sua conta esta suspensa. Entre em contato com o suporte.',
            };
            throw new BadRequestException(statusMessages[customer.accountStatus] || 'Conta nao aprovada para envio de PIX.');
        }
    }

    private async validateDestinationKey(customerId: string, chaveDestino: string, tipoChave: string): Promise<void> {
        const allowedPartnerKeysEnv = process.env.ALLOWED_PARTNER_PIX_KEYS || '50459025000126';
        const allowedPartnerKeys = allowedPartnerKeysEnv.split(',').map(k => k.trim()).filter(Boolean);
        if (allowedPartnerKeys.includes(chaveDestino)) {
            return;
        }

        const pixKey = await this.prisma.pixKey.findFirst({
            where: { customerId, keyValue: chaveDestino, status: 'ACTIVE' },
        });

        if (pixKey) {
            if (pixKey.validated) return;
            throw new BadRequestException('Esta chave PIX nao esta validada.');
        }

        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
            select: { cpf: true, cnpj: true },
        });

        if (!customer) throw new BadRequestException('Cliente nao encontrado');

        const chaveNormalizada = chaveDestino.replace(/[.\-\/\s\+]/g, '').toLowerCase();

        if (tipoChave === 'CPF') {
            const cpfNormalizado = customer.cpf?.replace(/[.\-]/g, '').toLowerCase() || '';
            if (chaveNormalizada === cpfNormalizado) return;
        } else if (tipoChave === 'CNPJ') {
            const cnpjNormalizado = customer.cnpj?.replace(/[.\-\/]/g, '').toLowerCase() || '';
            if (chaveNormalizada === cnpjNormalizado) return;
        }

        throw new BadRequestException(
            'Voce so pode enviar PIX para chaves cadastradas e validadas em seu nome.',
        );
    }

    private async validateBalance(customerId: string, valor: number) {
        const account = await this.prisma.account.findUnique({
            where: { customerId },
            select: { id: true, balance: true, blockedAmount: true },
        });

        if (!account) throw new BadRequestException('Conta nao encontrada');

        const valorDecimal = new Prisma.Decimal(valor);
        const blocked = account.blockedAmount || new Prisma.Decimal(0);
        const available = account.balance.sub(blocked);

        if (available.lessThan(valorDecimal)) {
            throw new BadRequestException(`Saldo insuficiente. Disponivel: R$ ${available.toFixed(2)}`);
        }
    }

    private async validateLimits(customerId: string, valor: number) {
        const account = await this.prisma.account.findUnique({
            where: { customerId },
            select: { id: true, dailyLimit: true, monthlyLimit: true },
        });

        if (!account) throw new BadRequestException('Conta nao encontrada');

        const valorDecimal = new Prisma.Decimal(valor);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalToday = await this.prisma.transaction.aggregate({
            where: {
                accountId: account.id,
                type: TransactionType.PIX_OUT,
                status: 'COMPLETED',
                createdAt: { gte: today },
            },
            _sum: { amount: true },
        });

        const usedToday = totalToday._sum.amount || new Prisma.Decimal(0);
        const remainingDaily = account.dailyLimit.sub(usedToday);

        if (remainingDaily.lessThan(valorDecimal)) {
            throw new BadRequestException(`Limite diario excedido. Disponivel hoje: R$ ${remainingDaily.toFixed(2)}`);
        }

        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const totalMonth = await this.prisma.transaction.aggregate({
            where: {
                accountId: account.id,
                type: TransactionType.PIX_OUT,
                status: 'COMPLETED',
                createdAt: { gte: firstDayOfMonth },
            },
            _sum: { amount: true },
        });

        const usedMonth = totalMonth._sum.amount || new Prisma.Decimal(0);
        const remainingMonthly = account.monthlyLimit.sub(usedMonth);

        if (remainingMonthly.lessThan(valorDecimal)) {
            throw new BadRequestException(`Limite mensal excedido. Disponivel no mes: R$ ${remainingMonthly.toFixed(2)}`);
        }
    }

    // ==================== DATABASE RECORDS ====================

    private async createPaymentRecord(customerId: string, dto: SendPixDto, pixData: any) {
        const account = await this.prisma.account.findUnique({
            where: { customerId },
            select: { id: true, balance: true },
        });

        if (!account) throw new BadRequestException('Conta nao encontrada');

        const valorDecimal = new Prisma.Decimal(dto.valor);
        const valorCentavos = Math.round(dto.valor * 100);
        const balanceBefore = account.balance;
        const balanceAfter = balanceBefore.sub(valorDecimal);
        const endToEnd = pixData.endToEndId || pixData.id || `FDBNK-${Date.now()}`;
        const txType = dto.transactionType || TransactionType.PIX_OUT;

        await this.prisma.$transaction([
            this.prisma.payment.create({
                data: {
                    endToEnd,
                    identifier: pixData.transactionId || pixData.id,
                    paymentValue: valorCentavos,
                    paymentDate: new Date(pixData.date || new Date()),
                    receiverName: dto.nomeFavorecido,
                    receiverPixKey: dto.chaveDestino,
                    status: 'PENDING',
                    bankPayload: pixData as Prisma.InputJsonValue,
                    customerId,
                    bankProvider: 'FDBANK',
                },
            }),
            this.prisma.account.update({
                where: { id: account.id },
                data: { balance: balanceAfter },
            }),
            this.prisma.transaction.create({
                data: {
                    accountId: account.id,
                    type: txType,
                    status: 'COMPLETED',
                    amount: valorDecimal,
                    balanceBefore,
                    balanceAfter,
                    description: dto.descricao || `Pix para ${dto.chaveDestino}`,
                    externalId: endToEnd,
                    externalData: pixData as Prisma.InputJsonValue,
                    completedAt: new Date(),
                    bankProvider: 'FDBANK',
                },
            }),
        ]);

        this.logger.log(`Payment recorded: ${endToEnd} (type: ${txType}) via FDBank`);
    }

    private async createFailedPayment(customerId: string, dto: SendPixDto, error: string) {
        const valorCentavos = Math.round(dto.valor * 100);

        await this.prisma.payment.create({
            data: {
                endToEnd: `FDBNK-FAILED-${Date.now()}`,
                paymentValue: valorCentavos,
                paymentDate: new Date(),
                receiverName: dto.nomeFavorecido,
                receiverPixKey: dto.chaveDestino,
                status: 'FAILED',
                errorMessage: error.substring(0, 500),
                bankPayload: { error } as Prisma.InputJsonValue,
                customerId,
                bankProvider: 'FDBANK',
            },
        });
    }
}
