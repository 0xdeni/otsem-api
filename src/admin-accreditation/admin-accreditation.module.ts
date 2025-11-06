import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccreditationModule } from '../accreditation/accreditation.module';
import { AdminAccreditationController } from './admin-accreditation.controller';
import { AdminAccreditationService } from './admin-accreditation.service';
import { AccreditationService } from '../accreditation/accreditation.service';
import { BrxAuthService } from '../brx/brx-auth.service';
import { HttpModule } from '@nestjs/axios';


@Module({
    imports: [PrismaModule, AccreditationModule, HttpModule],
    controllers: [AdminAccreditationController],
    providers: [AdminAccreditationService, AccreditationService, BrxAuthService]
})
export class AdminAccreditationModule { }
