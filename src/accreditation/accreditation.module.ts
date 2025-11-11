import { Module } from '@nestjs/common';
import { AccreditationService } from './accreditation.service';
import { AccreditationController } from './accreditation.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { BrxAuthModule } from '../brx/brx-auth.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    BrxAuthModule, // módulo correto (não o serviço)
  ],
  controllers: [AccreditationController],
  providers: [AccreditationService],
  exports: [AccreditationService],
})
export class AccreditationModule {}
