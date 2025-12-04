import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { PrismaService } from '../prisma/prisma.service';
import { InterPixService } from '../inter/services/inter-pix.service';
import { InterModule } from '../inter/inter.module';
import { OkxModule } from '../okx/okx.module'; // <-- importe o módulo Okx

@Module({
    imports: [InterModule, OkxModule], // <-- adicione aqui
    providers: [WalletService, PrismaService, InterPixService],
    controllers: [WalletController],
})
export class WalletModule { }