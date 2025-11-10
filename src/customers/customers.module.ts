import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccreditationModule } from '../accreditation/accreditation.module';

@Module({
    imports: [
        PrismaModule,
        AccreditationModule, // ← torna AccreditationService disponível aqui
    ],
    controllers: [CustomersController],
    providers: [CustomersService],
    exports: [CustomersService],
})
export class CustomersModule { }
