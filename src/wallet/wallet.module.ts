import { Module, forwardRef } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController, PublicQuoteController } from './wallet.controller';
import { PrismaService } from '../prisma/prisma.service';
import { BankingModule } from '../banking/banking.module';
import { OkxModule } from '../okx/okx.module';
import { TronModule } from '../tron/tron.module';
import { SolanaModule } from '../solana/solana.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { CustomersModule } from '../customers/customers.module';
import { SellProcessingService } from './sell-processing.service';

@Module({
    imports: [BankingModule, OkxModule, TronModule, SolanaModule, forwardRef(() => AffiliatesModule), forwardRef(() => CustomersModule)],
    providers: [WalletService, PrismaService, SellProcessingService],
    controllers: [WalletController, PublicQuoteController],
    exports: [WalletService, SellProcessingService],
})
export class WalletModule { }
