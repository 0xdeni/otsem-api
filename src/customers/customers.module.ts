import { Module, forwardRef } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerBalanceService } from './customer-balance.service';
import { CustomerKycService } from './customer-kyc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StatementsModule } from '../statements/statements.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => StatementsModule),
  ],
  controllers: [CustomersController],
  providers: [
    CustomersService,
    CustomerBalanceService,
    CustomerKycService,
  ],
  exports: [
    CustomersService,
    CustomerBalanceService,
    CustomerKycService,
  ],
})
export class CustomersModule { }
