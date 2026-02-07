import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { OkxAuthService } from './okx-auth.service';

// Exemplo para extrair saldo USDT
interface OkxBalanceDetail {
    ccy: string;
    availBal: string;
    [key: string]: any;
}

interface OkxBalanceResponse {
    details: OkxBalanceDetail[];
    [key: string]: any;
}

interface OkxApiResponse {
    data: OkxBalanceResponse[];
    [key: string]: any;
}

interface WithdrawUsdtParams {
    currency: string;
    amount: string | number;
    toAddress: string;
    network: string; // exemplo: 'SOL', 'ERC20', 'TRC20'
    fundPwd: string;
    fee: string | number;
}


@Injectable()
export class OkxService {
    private readonly logger = new Logger(OkxService.name);

    constructor(private readonly authService: OkxAuthService) { }

    private getApiUrl() {
        return process.env.OKX_API_URL || 'https://www.okx.com';
    }

    /**
     * Validate OKX API response — OKX returns HTTP 200 even on errors,
     * with the actual error code in response.data.code
     */
    private validateOkxResponse(response: any, operation: string): void {
        const code = response?.code;
        if (code && code !== '0') {
            const msg = response?.msg || 'Unknown OKX error';
            this.logger.error(`[OKX] ${operation} failed: code=${code} msg=${msg} data=${JSON.stringify(response?.data)}`);
            throw new Error(`OKX ${operation}: ${msg} (code: ${code})`);
        }
    }

    async getSpotInstruments(instIds: string[]) {
        const apiUrl = this.getApiUrl();
        const response = await axios.get(`${apiUrl}/api/v5/public/instruments?instType=SPOT`);
        this.validateOkxResponse(response.data, 'getSpotInstruments');
        const data = response.data?.data || [];
        const filtered = instIds.length > 0
            ? data.filter((item: any) => instIds.includes(item.instId))
            : data;
        return {
            instruments: filtered.map((item: any) => ({
                instId: item.instId,
                baseCcy: item.baseCcy,
                quoteCcy: item.quoteCcy,
                tickSz: item.tickSz,
                lotSz: item.lotSz,
                minSz: item.minSz,
                maxMktSz: item.maxMktSz,
                maxLmtSz: item.maxLmtSz,
                state: item.state,
            })),
        };
    }

    async getSpotTicker(instId: string) {
        const apiUrl = this.getApiUrl();
        const response = await axios.get(`${apiUrl}/api/v5/market/ticker?instId=${instId}`);
        this.validateOkxResponse(response.data, 'getSpotTicker');
        const ticker = response.data?.data?.[0] || {};
        const last = parseFloat(ticker.last || '0');
        const open = parseFloat(ticker.open24h || ticker.sodUtc0 || '0');
        const changePct = open ? ((last - open) / open) * 100 : 0;
        return {
            instId: ticker.instId || instId,
            last,
            open24h: open,
            high24h: parseFloat(ticker.high24h || '0'),
            low24h: parseFloat(ticker.low24h || '0'),
            vol24h: parseFloat(ticker.vol24h || '0'),
            changePct,
        };
    }

    async getSpotOrderBook(instId: string, depth: number) {
        const apiUrl = this.getApiUrl();
        const response = await axios.get(
            `${apiUrl}/api/v5/market/books?instId=${instId}&sz=${depth}`
        );
        this.validateOkxResponse(response.data, 'getSpotOrderBook');
        const book = response.data?.data?.[0] || {};
        const asks = (book.asks || []).map((row: string[]) => ({
            price: parseFloat(row[0]),
            size: parseFloat(row[1]),
        }));
        const bids = (book.bids || []).map((row: string[]) => ({
            price: parseFloat(row[0]),
            size: parseFloat(row[1]),
        }));
        return {
            instId,
            ts: Number(book.ts || 0),
            asks,
            bids,
        };
    }

    async getSpotTrades(instId: string, limit: number) {
        const apiUrl = this.getApiUrl();
        const response = await axios.get(
            `${apiUrl}/api/v5/market/trades?instId=${instId}&limit=${limit}`
        );
        this.validateOkxResponse(response.data, 'getSpotTrades');
        const data = response.data?.data || [];
        return {
            instId,
            trades: data.map((trade: any) => ({
                price: parseFloat(trade.px || '0'),
                size: parseFloat(trade.sz || '0'),
                side: trade.side,
                ts: Number(trade.ts || 0),
            })),
        };
    }

    async getSpotCandles(instId: string, bar: string, limit: number) {
        const apiUrl = this.getApiUrl();
        const response = await axios.get(
            `${apiUrl}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`
        );
        this.validateOkxResponse(response.data, 'getSpotCandles');
        const data = response.data?.data || [];
        return {
            instId,
            bar,
            candles: data.map((row: string[]) => ({
                ts: Number(row[0]),
                open: parseFloat(row[1]),
                high: parseFloat(row[2]),
                low: parseFloat(row[3]),
                close: parseFloat(row[4]),
                volume: parseFloat(row[5]),
            })),
        };
    }

    async placeSpotOrder(params: {
        instId: string;
        side: 'buy' | 'sell';
        ordType: 'limit' | 'market';
        sz: string | number;
        px?: string | number;
        tgtCcy?: 'base_ccy' | 'quote_ccy';
    }) {
        const method = 'POST';
        const requestPath = '/api/v5/trade/order';
        const bodyObj: Record<string, any> = {
            instId: params.instId,
            tdMode: 'cash',
            side: params.side,
            ordType: params.ordType,
            sz: params.sz.toString(),
        };
        if (params.ordType === 'limit') {
            bodyObj.px = params.px?.toString();
        }
        if (params.ordType === 'market' && params.tgtCcy) {
            bodyObj.tgtCcy = params.tgtCcy;
        }
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = this.getApiUrl();
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        this.validateOkxResponse(response.data, 'placeSpotOrder');
        return response.data;
    }

    async getSpotFills(instId: string, ordId: string) {
        const method = 'GET';
        const requestPath = `/api/v5/trade/fills?instId=${instId}&ordId=${ordId}`;
        const headers = this.authService.getAuthHeaders(method, requestPath, '');
        const apiUrl = this.getApiUrl();
        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        this.validateOkxResponse(response.data, 'getSpotFills');
        return response.data?.data || [];
    }

    async getSpotOrderStatus(instId: string, ordId: string) {
        const method = 'GET';
        const requestPath = `/api/v5/trade/order?instId=${instId}&ordId=${ordId}`;
        const headers = this.authService.getAuthHeaders(method, requestPath, '');
        const apiUrl = this.getApiUrl();
        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        this.validateOkxResponse(response.data, 'getSpotOrderStatus');
        return response.data?.data?.[0] || null;
    }

    async cancelSpotOrder(instId: string, ordId: string) {
        const method = 'POST';
        const requestPath = '/api/v5/trade/cancel-order';
        const bodyObj = { instId, ordId };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = this.getApiUrl();
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        this.validateOkxResponse(response.data, 'cancelSpotOrder');
        return response.data;
    }

    async getAccountBalance() {
        const method = 'GET';
        const requestPath = '/api/v5/account/balance';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, {
            headers,
        });

        const okxData = response.data as OkxApiResponse;
        const details = okxData.data[0]?.details || [];
        const usdt = details.find((d: OkxBalanceDetail) => d.ccy === 'USDT');

        if (usdt) {
            console.log('Saldo USDT:', usdt.availBal);
        } else {
            console.log('USDT balance not found.');
        }

        return response.data;
    }

    async getBrlBalance() {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        const brl = details.find((d: any) => d.ccy === 'BRL');
        return brl ? brl.availBal : '0';
    }

    async getUsdtBalance() {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        const usdt = details.find((d: any) => d.ccy === 'USDT');
        return usdt ? usdt.availBal : '0';
    }

    async getBrlToUsdtRate(): Promise<number> {
        try {
            const method = 'GET';
            const requestPath = '/api/v5/market/ticker?instId=USDT-BRL';
            const body = '';
            const headers = this.authService.getAuthHeaders(method, requestPath, body);
            const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

            const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
            const ticker = response.data?.data?.[0];
            if (ticker?.last) {
                return parseFloat(ticker.last);
            }
            return 5.5;
        } catch (error) {
            console.error('Erro ao obter taxa BRL/USDT:', error);
            return 5.5;
        }
    }

    async buyUsdtWithBrl(brlAmount: number): Promise<any> {
        const method = 'POST';
        const requestPath = '/api/v5/trade/order';
        const bodyObj = {
            instId: 'USDT-BRL',
            tdMode: 'cash',
            side: 'buy',
            ordType: 'market',
            sz: brlAmount.toString()
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);

        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        this.logger.log(`[OKX] Buying USDT with R$ ${brlAmount}...`);
        const response = await axios.post(
            `${apiUrl}${requestPath}`,
            bodyObj,
            { headers }
        );
        this.validateOkxResponse(response.data, 'buyUsdtWithBrl');
        this.logger.log(`[OKX] Buy order placed: ${JSON.stringify(response.data?.data?.[0]?.ordId || 'no ordId')}`);
        return response.data;
    }

    async sellUsdtForBrl(usdtAmount: number): Promise<{
        orderId: string;
        brlReceived: number;
        tradingFee: number;
        fills: any[];
    }> {
        this.logger.log(`[SELL] Vendendo ${usdtAmount} USDT por BRL...`);
        
        const method = 'POST';
        const requestPath = '/api/v5/trade/order';
        const bodyObj = {
            instId: 'USDT-BRL',
            tdMode: 'cash',
            side: 'sell',
            ordType: 'market',
            sz: usdtAmount.toString(),
            tgtCcy: 'base_ccy'
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.post(
            `${apiUrl}${requestPath}`,
            bodyObj,
            { headers }
        );
        this.validateOkxResponse(response.data, 'sellUsdtForBrl');

        const orderId = response.data?.data?.[0]?.ordId;
        if (!orderId) {
            throw new Error('Ordem de venda não criada: ' + JSON.stringify(response.data));
        }
        
        this.logger.log(`[SELL] Ordem criada: ${orderId}`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const fillsResponse = await this.getOrderFills(orderId);
        const fills = fillsResponse || [];
        
        let brlReceived = 0;
        let tradingFee = 0;
        
        for (const fill of fills) {
            const fillSz = parseFloat(fill.fillSz || '0');
            const fillPx = parseFloat(fill.fillPx || '0');
            const fee = parseFloat(fill.fee || '0');
            
            brlReceived += fillSz * fillPx;
            tradingFee += Math.abs(fee);
        }
        
        this.logger.log(`[SELL] Venda concluída: ${usdtAmount} USDT → R$ ${brlReceived.toFixed(2)} (taxa: R$ ${tradingFee.toFixed(2)})`);
        
        return {
            orderId,
            brlReceived,
            tradingFee,
            fills
        };
    }

    async getOrderFills(orderId: string): Promise<any[]> {
        const method = 'GET';
        const requestPath = `/api/v5/trade/fills?ordId=${orderId}&instId=USDT-BRL`;
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        return response.data?.data || [];
    }

    async getUsdtBuyHistory(): Promise<any> {
        const method = 'GET';
        const requestPath = '/api/v5/trade/fills';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const params = {
            instId: 'USDT-BRL',
            side: 'buy',
            limit: 20
        };

        // O prehash NÃO inclui query params!
        return axios.get(`${apiUrl}${requestPath}`, {
            headers,
        });
    }

    async buyAndCheckHistory(brlAmount: number): Promise<any> {
        // 1. Comprar USDT com BRL
        const buyResponse = await this.buyUsdtWithBrl(brlAmount);
        const ordId = buyResponse.data?.[0]?.ordId;
        if (!ordId) {
            this.logger.error(`[OKX] Ordem não criada. Response: ${JSON.stringify(buyResponse)}`);
            throw new Error(`Ordem OKX não criada: ${buyResponse?.msg || JSON.stringify(buyResponse)}`);
        }

        // 2. Buscar fills com retry (market orders podem demorar alguns segundos)
        let detalhes: any[] = [];
        for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            detalhes = await this.getOrderFills(ordId);
            if (detalhes.length > 0) break;
            this.logger.warn(`[OKX] Fills attempt ${attempt}/3 empty for order ${ordId}, retrying...`);
        }

        if (detalhes.length === 0) {
            this.logger.error(`[OKX] No fills found for order ${ordId} after 3 attempts`);
        }

        return {
            ordId,
            detalhes
        };
    }

    async withdrawUsdt({
        amount,
        toAddress,
        network,
        fundPwd,
        fee
    }: WithdrawUsdtParams) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/withdrawal';
        const bodyObj = {
            ccy: 'USDT',
            amt: amount,
            dest: 4,
            toAddr: toAddress,
            chain: `USDT-${network}`,
            fee: fee,
            pwd: fundPwd
        };
        const body = JSON.stringify(bodyObj);

        const headers = this.authService.getAuthHeaders(method, requestPath, body);

        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';
        this.logger.log(`[OKX] Withdrawing ${amount} USDT to ${toAddress} via ${network}...`);
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        this.validateOkxResponse(response.data, `withdraw USDT to ${toAddress}`);
        return response.data;
    }

    async withdrawUsdtSimple(amount: string, toAddress: string, network: string, fee: string) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/withdrawal';
        const bodyObj = {
            ccy: 'USDT',
            amt: amount,
            dest: 4,
            toAddr: toAddress,
            chain: `USDT-${network}`,
            fee: fee
        };
        const body = JSON.stringify(bodyObj);

        const headers = this.authService.getAuthHeaders(method, requestPath, body);

        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';
        this.logger.log(`[OKX] Withdrawing ${amount} USDT to ${toAddress} via ${network} (fee: ${fee})...`);
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        this.validateOkxResponse(response.data, `withdraw USDT to ${toAddress}`);
        return response.data;
    }

    async withdrawCrypto({
        currency,
        amount,
        toAddress,
        chain,
        fee
    }: {
        currency: string;
        amount: string;
        toAddress: string;
        chain: string;
        fee: string;
    }) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/withdrawal';
        const bodyObj = {
            ccy: currency,
            amt: amount,
            dest: 4,
            toAddr: toAddress,
            chain: chain,
            fee: fee
        };
        const body = JSON.stringify(bodyObj);

        const headers = this.authService.getAuthHeaders(method, requestPath, body);

        const url = `https://www.okx.com${requestPath}`;
        const response = await axios.post(url, bodyObj, { headers });
        return response.data;
    }

    async getWithdrawalFee(currency: string, chain: string) {
        const method = 'GET';
        const requestPath = `/api/v5/asset/currencies?ccy=${currency}`;
        const headers = this.authService.getAuthHeaders(method, requestPath, '');

        const url = `https://www.okx.com${requestPath}`;
        const response = await axios.get(url, { headers });
        
        const currencies = response.data?.data || [];
        const chainData = currencies.find((c: any) => c.chain === chain);
        return chainData?.minFee || '0';
    }

    async buyCryptoWithUsdt(crypto: string, usdtAmount: number): Promise<any> {
        const method = 'POST';
        const requestPath = '/api/v5/trade/order';
        const instId = `${crypto}-USDT`;
        const bodyObj = {
            instId: instId,
            tdMode: 'cash',
            side: 'buy',
            ordType: 'market',
            sz: usdtAmount.toString(),
            tgtCcy: 'quote_ccy'
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        this.logger.log(`📈 Comprando ${crypto} com ${usdtAmount} USDT...`);
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        return response.data;
    }

    async getCryptoBalance(currency: string): Promise<string> {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        const crypto = details.find((d: any) => d.ccy === currency);
        return crypto ? crypto.availBal : '0';
    }

    async transferCryptoToFunding(currency: string, amount: string): Promise<any> {
        const method = 'POST';
        const requestPath = '/api/v5/asset/transfer';
        const bodyObj = {
            ccy: currency,
            amt: amount,
            from: '18',
            to: '6'
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        this.logger.log(`💱 Transferindo ${amount} ${currency} para funding...`);
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        return response.data;
    }

    async buyBrlAndReturnUsdtBalance(brlAmount: number) {
        await this.buyUsdtWithBrl(brlAmount);
        // Aguarda alguns segundos para a ordem ser processada
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.getUsdtBalance();
    }

    async buyUsdtWithBrlIfEnough(brlAmount: number): Promise<any> {
        const brlBalance = parseFloat(await this.getBrlBalance());
        if (brlAmount > brlBalance) {
            throw new Error(`Saldo insuficiente de BRL. Saldo disponível: ${brlBalance}`);
        }
        return this.buyUsdtWithBrl(brlAmount);
    }

    /**
     * Transfere BRL da conta funding para a conta trading.
     * @param amount Valor em BRL a transferir (string ou number)
     */
    async transferBrlToTrading(amount: string | number) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/transfer';
        const bodyObj = {
            ccy: 'BRL',
            amt: amount.toString(),
            from: 6,    // funding
            to: 18      // trading
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        this.logger.log(`[OKX] Transferring R$ ${amount} from funding to trading...`);
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        this.validateOkxResponse(response.data, 'transfer BRL funding→trading');
        return response.data;
    }

    async safeWithdrawUsdt(params: WithdrawUsdtParams) {
        // 2. Transfere USDT da conta trading para funding
        await this.transferFromTradingToFunding(params.currency, params.amount);

        // 3. Aguarda alguns segundos para garantir o processamento
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. Realiza o saque normalmente
        return this.withdrawUsdt(params);
    }

    /**
     * Transfere USDT da conta funding para trading.
     * @param amount Valor em USDT a transferir
     */
    async transferUsdtToTrading(amount: string | number) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/transfer';
        const bodyObj = {
            ccy: 'USDT',
            amt: amount.toString(),
            from: 6,   // 6 = funding
            to: 18     // 18 = trading
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        return response.data;
    }

    async getTradingBalanceByCurrency(currency: string) {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        const asset = details.find((d: any) => d.ccy === currency);
        return asset ? asset.availBal : '0';
    }

    async transferFromTradingToFunding(currency: string, amount: string | number) {
        const method = 'POST';
        const requestPath = '/api/v5/asset/transfer';
        const bodyObj = {
            ccy: currency,
            amt: amount.toString(),
            from: 18, // trading
            to: 6     // funding
        };
        const body = JSON.stringify(bodyObj);
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        this.logger.log(`[OKX] Transferring ${amount} ${currency} from trading to funding...`);
        const response = await axios.post(`${apiUrl}${requestPath}`, bodyObj, { headers });
        this.validateOkxResponse(response.data, `transfer ${currency} trading→funding`);
        return response.data;
    }

    async getFundingBalance(currency: string) {
        const method = 'GET';
        const requestPath = '/api/v5/asset/balances';
        const headers = this.authService.getAuthHeaders(method, requestPath, '');
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        const balances = response.data?.data || [];
        const asset = balances.find((b: any) => b.ccy === currency);
        return asset ? asset.availBal : '0';
    }

    async getAllFundingBalances() {
        const method = 'GET';
        const requestPath = '/api/v5/asset/balances';
        const headers = this.authService.getAuthHeaders(method, requestPath, '');
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        const balances = response.data?.data || [];
        return balances
            .filter((b: any) => parseFloat(b.availBal) > 0)
            .map((b: any) => ({
                currency: b.ccy,
                available: b.availBal,
                frozen: b.frozenBal
            }));
    }

    async getAllTradingBalances() {
        const response = await this.getAccountBalance();
        const details = response.data[0]?.details || [];
        return details
            .filter((d: any) => parseFloat(d.availBal) > 0)
            .map((d: any) => ({
                currency: d.ccy,
                available: d.availBal,
                frozen: d.frozenBal
            }));
    }

    /**
     * Busca histórico de vendas de USDT
     */
    async getUsdtSellHistory(): Promise<any> {
        const method = 'GET';
        const requestPath = '/api/v5/trade/fills';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        return axios.get(`${apiUrl}${requestPath}`, {
            headers,
        });
    }

    /**
     * Vende USDT e retorna detalhes da ordem (BRL recebido)
     */
    async sellAndCheckHistory(usdtAmount: number): Promise<{ ordId: string; detalhes: any[]; brlReceived: number }> {
        const result = await this.sellUsdtForBrl(usdtAmount);
        
        const fillsResponse = await this.getUsdtSellHistory();
        const fills = fillsResponse.data?.data || [];
        const detalhes = fills.filter((f: any) => f.ordId === result.orderId);

        return {
            ordId: result.orderId,
            detalhes,
            brlReceived: result.brlReceived
        };
    }

    /**
     * Obtém endereço de depósito USDT para uma rede específica
     * @param network 'Solana' | 'TRC20' (Tron)
     */
    async getDepositAddress(network: 'Solana' | 'TRC20'): Promise<{ address: string; chain: string; memo?: string }> {
        const method = 'GET';
        const requestPath = `/api/v5/asset/deposit-address?ccy=USDT`;
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        const addresses = response.data?.data || [];

        const chainMap: Record<string, string> = {
            'Solana': 'USDT-Solana',
            'TRC20': 'USDT-TRC20'
        };

        const targetChain = chainMap[network];
        const found = addresses.find((a: any) => a.chain === targetChain);

        if (!found) {
            throw new Error(`Endereço de depósito não encontrado para ${network}`);
        }

        return {
            address: found.addr,
            chain: found.chain,
            memo: found.memo || undefined
        };
    }

    /**
     * Lista depósitos recentes de USDT
     */
    async getRecentDeposits(): Promise<any[]> {
        const method = 'GET';
        const requestPath = '/api/v5/asset/deposit-history?ccy=USDT';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        return response.data?.data || [];
    }

    /**
     * Lista saques recentes de USDT
     */
    async getRecentWithdrawals(): Promise<any[]> {
        const method = 'GET';
        const requestPath = '/api/v5/asset/withdrawal-history?ccy=USDT';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        return response.data?.data || [];
    }

    /**
     * Obtém histórico completo de trades (fills)
     */
    async getTradeHistory(): Promise<any[]> {
        const method = 'GET';
        const requestPath = '/api/v5/trade/fills';
        const body = '';
        const headers = this.authService.getAuthHeaders(method, requestPath, body);
        const apiUrl = process.env.OKX_API_URL || 'https://www.okx.com';

        const response = await axios.get(`${apiUrl}${requestPath}`, { headers });
        return response.data?.data || [];
    }
}
