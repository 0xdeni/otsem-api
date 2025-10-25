import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import { PixService } from './pix.service';
import { verifyMtbankSignature } from './mtbank-signature';

@Controller()
export class MtBankController {
    constructor(private readonly pix: PixService) { }

    @Post('webhooks/mtbank/cash-in')
    @HttpCode(200)
    async cashIn(@Body() body: any, @Headers() headers: Record<string, any>, @Req() req: any) {
        const raw = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(body);
        const ok = verifyMtbankSignature(headers, raw);
        if (!ok) {
            return { ok: false, error: 'invalid_signature' };
        }
        return this.pix.handleCashInFromMtBank(body, headers['x-webhook-signature']);
    }

    @Get('deposits')
    async list(@Query('take') take = '50', @Query('skip') skip = '0') {
        const data = await this.pix.listDeposits(Number(take), Number(skip));
        return { ok: true, count: data.length, data };
    }
}
