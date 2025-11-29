import { Controller, Get } from '@nestjs/common';
import { FdbankService } from '../services/fdbank.service';

@Controller('fdbank')
export class FdbankController {
    constructor(private readonly fdbankService: FdbankService) { }

    @Get('system-health')
    async systemHealth() {
        return await this.fdbankService.systemHealth();
    }
}