import { Controller, Get, Post, Body } from '@nestjs/common';
import { FdbankPixLimitsService } from '../services/fdbank-pix-limits.service';

@Controller('fdbank/pix-limits')
export class FdbankPixLimitsController {
    constructor(private readonly pixLimitsService: FdbankPixLimitsService) { }

    @Get()
    async getPixLimits() {
        return await this.pixLimitsService.getPixLimits();
    }

    @Post()
    async updatePixLimits(@Body() data: any) {
        return await this.pixLimitsService.updatePixLimits(data);
    }
}