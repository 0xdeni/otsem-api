import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaService } from '../prisma/prisma.service';
import { InterPixService } from '../inter/services/inter-pix.service';
import { InterModule } from '../inter/inter.module';
import { OkxModule } from '../okx/okx.module';
import { TronModule } from '../tron/tron.module';

@Module({
    imports: [InterModule, OkxModule, TronModule],
    providers: [WalletService, PrismaService, InterPixService],
    controllers: [WalletController],
})
export class WalletModule { }