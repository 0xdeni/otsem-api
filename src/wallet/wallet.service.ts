import { Injectable } from '@nestjs/common';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { PrismaService } from '../prisma/prisma.service';
import { InterPixService } from '../inter/services/inter-pix.service'; // <-- adicione este import
import { PixKeyType } from '../inter/dto/send-pix.dto';
import { OkxService } from '../okx/services/okx.service'; // <-- adicione este import

@Injectable()
export class WalletService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly interPixService: InterPixService, // <-- adicione aqui
        private readonly okxService: OkxService // <-- adicione esta linha
    ) { }


    async createSolanaWalletForCustomer(customerId: string) {
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toBase58();
        const secretKey = Buffer.from(keypair.secretKey).toString('hex');

        // Desmarca todas as wallets USDT do cliente como principal
        await this.prisma.wallet.updateMany({
            where: { customerId, currency: 'USDT', isMain: true },
            data: { isMain: false }
        });

        // Cria ou atualiza a wallet principal
        const wallet = await this.prisma.wallet.upsert({
            where: { customerId_currency: { customerId, currency: 'USDT' } },
            update: {
                externalAddress: publicKey,
                isMain: true,
                balance: 0
            },
            create: {
                customerId,
                currency: 'USDT',
                balance: 0,
                externalAddress: publicKey,
                isMain: true
            }
        });

        return {
            publicKey,
            secretKey,
            wallet
        };
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

            // Busca todas as contas de token do endereço
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                owner,
                { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            let saldo = 0;
            for (const acc of tokenAccounts.value) {
                const info = acc.account.data.parsed.info;
                console.log('Token encontrado:', info.mint, 'Saldo:', info.tokenAmount.amount);
                // Mint USDT SPL (corrigido para o mint completo)
                if (info.mint === 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB') {
                    saldo += Number(info.tokenAmount.amount);
                }
            }
            const saldoUsdt = (saldo / 1e6).toString();
            console.log('Saldo total USDT:', saldoUsdt);

            if (customerId) {
                await this.prisma.wallet.updateMany({
                    where: {
                        customerId,
                        currency: 'USDT',
                        externalAddress: address
                    },
                    data: {
                        balance: saldoUsdt
                    }
                });
            }

            return saldoUsdt;
        } catch (err) {
            if (err.message === 'Endereço Solana inválido') throw err;
            console.error('Erro ao consultar saldo USDT:', err);
            return '0';
        }
    }

    async getAllUsdtWalletsForCustomer(customerId: string) {
        return await this.prisma.wallet.findMany({
            where: {
                customerId,
                currency: 'USDT'
            }
        });
    }

    async buyUsdtWithBrl(customerId: string, brlAmount: number) {

        // 1. Verifica saldo BRL do cliente (mínimo R$10)
        const account = await this.prisma.account.findFirst({
            where: { customerId }
        });

        if (!account || Number(account.balance) < brlAmount || brlAmount < 10) {
            throw new Error('Saldo insuficiente em BRL (mínimo R$10)');
        }

        // 3. Envia Pix do Inter para OKX
        const pixResult = await this.interPixService.sendPix(customerId, {
            valor: brlAmount,
            chaveDestino: '50459025000126', // Chave Pix da OKX
            tipoChave: PixKeyType.CHAVE,
            descricao: customerId // Descrição é o id do cliente
        });

        // 4. Compra USDT na OKX
        // Aguarda alguns segundos para o Pix ser processado
        await new Promise(resolve => setTimeout(resolve, 5000));
        const okxBuyResult = await this.okxService.buyUsdtWithBrl(brlAmount);



        // 5. Transfere USDT para a carteira Solana do cliente
        // Busca a carteira principal USDT do cliente
        const wallet = await this.prisma.wallet.findFirst({
            where: { customerId, currency: 'USDT', isMain: true }
        });
        if (!wallet || !wallet.externalAddress) {
            throw new Error('Carteira Solana principal não encontrada para o cliente');
        }

        // Realiza o saque de USDT para a carteira Solana
        // Ajuste os parâmetros conforme sua integração OKX
        const withdrawResult = await this.okxService.safeWithdrawUsdt({
            currency: 'USDT', // <-- Adicione este campo
            amount: okxBuyResult.amount || brlAmount,
            toAddress: wallet.externalAddress,
            network: 'Solana',
            fundPwd: process.env.OKX_API_PASSPHRASE || 'not_found',
            fee: '1'
        });

        return {
            message: 'Compra e transferência de USDT concluída',
            pixResult,
            okxBuyResult,
            withdrawResult
        };
    }
}