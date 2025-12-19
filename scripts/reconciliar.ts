import { PrismaClient, Prisma } from '@prisma/client';
import * as https from 'https';
import * as fs from 'fs';
import axios from 'axios';

const prisma = new PrismaClient();

async function getInterToken() {
    const certPath = '/home/runner/workspace/inter-keys';
    const cert = fs.readFileSync(`${certPath}/certificado.crt`);
    const key = fs.readFileSync(`${certPath}/chave_privada.key`);

    const httpsAgent = new https.Agent({ cert, key });

    const params = new URLSearchParams();
    params.append('client_id', process.env.INTER_CLIENT_ID!);
    params.append('client_secret', process.env.INTER_CLIENT_SECRET!);
    params.append('scope', 'cob.read cob.write pix.read pix.write boleto-cobranca.read boleto-cobranca.write pagamento-boleto.read pagamento-boleto.write pagamento-pix.read pagamento-pix.write extrato.read');
    params.append('grant_type', 'client_credentials');

    const res = await axios.post('https://cdpj.partners.bancointer.com.br/oauth/v2/token', params, {
        httpsAgent,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return res.data.access_token;
}

async function listCobrancas(token: string) {
    const certPath = '/home/runner/workspace/inter-keys';
    const cert = fs.readFileSync(`${certPath}/certificado.crt`);
    const key = fs.readFileSync(`${certPath}/chave_privada.key`);
    const httpsAgent = new https.Agent({ cert, key });

    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);

    const res = await axios.get('https://cdpj.partners.bancointer.com.br/pix/v2/cob', {
        httpsAgent,
        headers: { Authorization: `Bearer ${token}` },
        params: {
            inicio: dataInicio.toISOString(),
            fim: dataFim.toISOString(),
        }
    });

    return res.data;
}

async function getCobranca(token: string, txid: string) {
    const certPath = '/home/runner/workspace/inter-keys';
    const cert = fs.readFileSync(`${certPath}/certificado.crt`);
    const key = fs.readFileSync(`${certPath}/chave_privada.key`);
    const httpsAgent = new https.Agent({ cert, key });

    const res = await axios.get(`https://cdpj.partners.bancointer.com.br/pix/v2/cob/${txid}`, {
        httpsAgent,
        headers: { Authorization: `Bearer ${token}` }
    });

    return res.data;
}

async function main() {
    console.log('🔄 Iniciando reconciliação...\n');

    const token = await getInterToken();
    console.log('✅ Token obtido\n');

    const cobrancasData = await listCobrancas(token);
    const cobrancas = cobrancasData.cobs || [];

    console.log(`📋 Total de cobranças encontradas: ${cobrancas.length}\n`);

    const concluidas = cobrancas.filter((c: any) => c.status === 'CONCLUIDA');
    console.log(`💰 Cobranças CONCLUÍDAS (pagas): ${concluidas.length}\n`);

    for (const cob of concluidas) {
        console.log(`\n--- TXID: ${cob.txid} ---`);
        console.log(`Status: ${cob.status}`);
        console.log(`Valor: R$ ${cob.valor?.original}`);

        // Verificar se já existe no banco
        const existing = await prisma.transaction.findFirst({
            where: {
                OR: [{ txid: cob.txid }, { externalId: cob.txid }],
                status: 'COMPLETED'
            }
        });

        if (existing) {
            console.log(`✅ Já processada: Transaction ID ${existing.id}`);
            continue;
        }

        // Buscar detalhes
        const detalhes = await getCobranca(token, cob.txid);
        console.log(`Pagador: ${detalhes.pix?.[0]?.pagador?.nome || 'N/A'}`);
        console.log(`CPF: ${detalhes.pix?.[0]?.pagador?.cpf || 'N/A'}`);
        console.log(`EndToEnd: ${detalhes.pix?.[0]?.endToEndId || 'N/A'}`);

        // Tentar encontrar customer pelo txid
        let customerId: string | null = null;
        if (cob.txid.startsWith('OTSEM') && cob.txid.length >= 17) {
            const shortId = cob.txid.substring(5, 17);
            const customer = await prisma.customer.findFirst({
                where: { id: { startsWith: shortId.toLowerCase() } }
            });
            if (customer) {
                customerId = customer.id;
                console.log(`🔗 Customer encontrado pelo txid: ${customerId}`);
            }
        }

        // Se não encontrou, buscar transaction PENDING
        if (!customerId) {
            const pendingTx = await prisma.transaction.findFirst({
                where: {
                    OR: [{ txid: cob.txid }, { externalId: cob.txid }],
                    status: 'PENDING'
                },
                include: { account: true }
            });
            if (pendingTx?.account?.customerId) {
                customerId = pendingTx.account.customerId;
                console.log(`🔗 Customer encontrado via Transaction PENDING: ${customerId}`);
            }
        }

        if (!customerId) {
            console.log(`❌ Customer não identificado para txid ${cob.txid}`);
            continue;
        }

        // Buscar conta
        const account = await prisma.account.findUnique({ where: { customerId } });
        if (!account) {
            console.log(`❌ Conta não encontrada para customer ${customerId}`);
            continue;
        }

        // Creditar
        const valor = parseFloat(detalhes.valor?.original || '0');
        const pix = detalhes.pix?.[0];
        const pagadorNome = pix?.pagador?.nome || 'Pagador não identificado';
        const pagadorCpf = pix?.pagador?.cpf || '';
        const endToEnd = pix?.endToEndId || '';

        const balanceBefore = account.balance;
        const balanceAfter = balanceBefore.add(new Prisma.Decimal(valor));

        await prisma.$transaction([
            prisma.account.update({
                where: { id: account.id },
                data: { balance: balanceAfter }
            }),
            prisma.transaction.create({
                data: {
                    accountId: account.id,
                    type: 'PIX_IN',
                    status: 'COMPLETED',
                    amount: new Prisma.Decimal(valor),
                    txid: cob.txid,
                    endToEnd,
                    externalId: cob.txid,
                    description: `Depósito PIX de ${pagadorNome} (reconciliado)`,
                    payerName: pagadorNome,
                    payerTaxNumber: pagadorCpf,
                    balanceBefore,
                    balanceAfter,
                    externalData: detalhes as any
                }
            })
        ]);

        console.log(`✅ CREDITADO: R$ ${valor} para customer ${customerId}`);
        console.log(`   Saldo anterior: R$ ${balanceBefore} -> Novo saldo: R$ ${balanceAfter}`);
    }

    console.log('\n🎉 Reconciliação concluída!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
