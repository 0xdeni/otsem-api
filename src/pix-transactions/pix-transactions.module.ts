import { Module } from '@nestjs/common';
import { PixTransactionsController } from './pix-transactions.controller';
import { PixTransactionsService } from './pix-transactions.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [PixTransactionsController],
    providers: [PixTransactionsService, PrismaService],
})
export class PixTransactionsModule { }
