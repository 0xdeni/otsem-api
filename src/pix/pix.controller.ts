// src/pix/pix.controller.ts
import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { PixService } from './pix.service';
import { CreatePixKeyDto, BrxCreateKeyRaw } from './dtos/create-key.dto';
import { ListKeysResponseDto } from './dtos/list-keys.dto';

@Controller('pix/keys')
export class PixController {
    constructor(private readonly pix: PixService) { }

    @Get('account-holders/:accountHolderId')
    listAllKeys(
        @Param('accountHolderId') accountHolderId: string,
    ): Promise<ListKeysResponseDto> {
        return this.pix.listKeys(accountHolderId);
    }

    @Post('account-holders/:accountHolderId')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    createKey(
        @Param('accountHolderId') accountHolderId: string,
        @Body() body: CreatePixKeyDto,
    ): Promise<BrxCreateKeyRaw> {
        return this.pix.createKey(accountHolderId, { keyType: body.keyType, pixKey: body.pixKey });
    }
}
