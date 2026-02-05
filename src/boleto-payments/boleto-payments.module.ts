import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OkxModule } from '../okx/okx.module';
import { SolanaModule } from '../solana/solana.module';
import { TronModule } from '../tron/tron.module';
import { BoletoPaymentsService } from './boleto-payments.service';
import { BoletoPaymentsController } from './boleto-payments.controller';
import { AdminBoletoPaymentsController } from './admin-boleto-payments.controller';

@Module({
  imports: [PrismaModule, OkxModule, SolanaModule, TronModule],
  controllers: [BoletoPaymentsController, AdminBoletoPaymentsController],
  providers: [BoletoPaymentsService],
  exports: [BoletoPaymentsService],
})
export class BoletoPaymentsModule {}
