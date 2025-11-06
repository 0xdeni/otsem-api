import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AccreditationController } from './accreditation.controller';
import { AccreditationService } from './accreditation.service';
import { BrxAuthService } from '../brx/brx-auth.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [HttpModule, PrismaModule],
    controllers: [AccreditationController],
    providers: [AccreditationService, BrxAuthService],
})
export class AccreditationModule { }
