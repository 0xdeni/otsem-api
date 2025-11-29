import { Controller, Get, Query } from '@nestjs/common';
import { FdbankBankAccountService } from '../services/fdbank-bank-account.service';

@Controller('fdbank/bank-account')
export class FdbankBankAccountController {
    constructor(private readonly bankAccountService: FdbankBankAccountService) { }

    @Get('active')
    async getActiveBankAccount() {
        return await this.bankAccountService.getActiveBankAccount();
    }

    @Get('statement')
    async getBankAccountStatement(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return await this.bankAccountService.getBankAccountStatement({ startDate, endDate });
    }
}