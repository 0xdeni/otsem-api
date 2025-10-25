import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PixService } from './pix.service';
import { MtBankController } from './mtbank.controller';

@Module({
    controllers: [MtBankController],
    providers: [PrismaService, PixService],
})
export class PixModule { }
