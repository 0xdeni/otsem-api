import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PixLimitsController } from './pix-limits.controller';
import { PixLimitsService } from './pix-limits.service';
import { BrxAuthService } from '../../brx/brx-auth.service';

@Module({
    imports: [HttpModule],
    controllers: [PixLimitsController],
    providers: [PixLimitsService, BrxAuthService],
})
export class PixLimitsModule { }
