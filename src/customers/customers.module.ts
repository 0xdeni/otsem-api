import { Module, forwardRef } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerBalanceService } from './customer-balance.service';
import { CustomerKycService } from './customer-kyc.service';
import { KycLimitsService } from './kyc-limits.service';
import { KycUpgradeService } from './kyc-upgrade.service';
import { KycUpgradeController } from './kyc-upgrade.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StatementsModule } from '../statements/statements.module';
import { DiditModule } from '../didit/didit.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => StatementsModule),
    DiditModule,
    AffiliatesModule,
  ],
  controllers: [CustomersController, KycUpgradeController],
  providers: [
    CustomersService,
    CustomerBalanceService,
    CustomerKycService,
    KycLimitsService,
    KycUpgradeService,
  ],
  exports: [
    CustomersService,
    CustomerBalanceService,
    CustomerKycService,
    KycLimitsService,
    KycUpgradeService,
  ],
})
export class CustomersModule { }
