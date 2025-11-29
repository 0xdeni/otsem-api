import { Controller, Post, Body } from '@nestjs/common';
import { FdbankPixTransferService } from '../services/fdbank-pix-transfer.service';

@Controller('fdbank/pix-transfer')
export class FdbankPixTransferController {
    constructor(private readonly pixTransferService: FdbankPixTransferService) { }

    @Post()
    async createPixTransfer(@Body() data: any) {
        return await this.pixTransferService.createPixTransfer(data);
    }

    @Post('generate-dynamic-qrcode')
    async generatePixDynamicQrCode(@Body() data: any) {
        return await this.pixTransferService.generatePixDynamicQrCode(data);
    }

    @Post('capture-qrcode')
    async captureQrCode(@Body() data: any) {
        return await this.pixTransferService.captureQrCode(data);
    }
}