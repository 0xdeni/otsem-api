import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccreditationModule } from '../accreditation/accreditation.module';
import { StatementsModule } from '../statements/statements.module';

@Module({
  imports: [
    PrismaModule,
    AccreditationModule,
    StatementsModule, // ← para injetar StatementsService
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
