import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { PixTransactionsService } from './pix-transactions.service';
import { SendPixDto } from './dto/send-pix.dto';
import { ReceivePixDto } from './dto/receive-pix.dto';

@Controller('pix/transactions')
export class PixTransactionsController {
    constructor(private readonly svc: PixTransactionsService) { }

    @Get('account-holders/:accountHolderId')
    async history(
        @Param('accountHolderId') accountHolderId: string,
        @Query('page') page = '1',
        @Query('pageSize') pageSize = '10',
        @Query('status') status?: string,
    ) {
        return this.svc.getHistory({
            accountHolderId,
            page: Number(page) || 1,
            pageSize: Number(pageSize) || 10,
            status: status?.toLowerCase(),
        });
    }

    @Post('account-holders/:accountHolderId/send')
    async send(
        @Param('accountHolderId') accountHolderId: string,
        @Body() dto: SendPixDto,
    ) {
        return this.svc.sendPix(accountHolderId, dto);
    }

    @Post('account-holders/:accountHolderId/receive')
    async receive(
        @Param('accountHolderId') accountHolderId: string,
        @Body() dto: ReceivePixDto,
    ) {
        return this.svc.createCharge(accountHolderId, dto);
    }
}
