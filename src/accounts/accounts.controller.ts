import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountSummaryDto } from './dto/account-summary.dto';

@Controller('accounts')
export class AccountsController {
    constructor(private readonly accountsService: AccountsService) { }

    @Get(':customerId/summary')
    async getAccountSummary(@Param('customerId') customerId: string): Promise<AccountSummaryDto> {
        const summary = await this.accountsService.getAccountSummary(customerId);
        if (!summary) {
            throw new NotFoundException('Account not found');
        }
        return summary;
    }
}