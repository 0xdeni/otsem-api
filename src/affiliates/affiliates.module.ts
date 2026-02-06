import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TronModule } from '../tron/tron.module';
import { SolanaModule } from '../solana/solana.module';
import { OkxModule } from '../okx/okx.module';
import { AffiliatesService } from './affiliates.service';
import { AffiliatesController, PublicAffiliatesController } from './affiliates.controller';

@Module({
  imports: [PrismaModule, TronModule, SolanaModule, forwardRef(() => OkxModule)],
  controllers: [AffiliatesController, PublicAffiliatesController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
