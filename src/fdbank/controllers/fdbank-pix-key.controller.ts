import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { FdbankPixKeyService } from '../services/fdbank-pix-key.service';

@Controller('fdbank/pix-keys')
export class FdbankPixKeyController {
    constructor(private readonly pixKeyService: FdbankPixKeyService) { }

    @Get()
    async listPixKeys() {
        return await this.pixKeyService.listPixKeys();
    }

    @Post()
    async createPixKey(@Body() data: any) {
        return await this.pixKeyService.createPixKey(data);
    }

    @Get(':id')
    async getPixKey(@Param('id') id: string) {
        return await this.pixKeyService.getPixKey(id);
    }

    @Delete(':id')
    async deletePixKey(@Param('id') id: string) {
        return await this.pixKeyService.deletePixKey(id);
    }

    @Post('resolve-dict')
    async resolveDict(@Body() data: any) {
        return await this.pixKeyService.resolveDict(data);
    }
}