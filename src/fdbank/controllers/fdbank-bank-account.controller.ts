import { Controller, Get, Query, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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
        @Query('page') page: number = 1,
        @Query('perPage') perPage: number = 10,
    ) {
        if (!startDate || !endDate) {
            throw new BadRequestException({
                isValid: true,
                message: 'startDate and endDate are required',
                result: [
                    { path: 'startDate', message: 'startDate is required' },
                    { path: 'endDate', message: 'endDate is required' }
                ],
                requestTraceId: null
            });
        }

        try {
            const result = await this.bankAccountService.getBankAccountStatement({
                startDate,
                endDate,
                page,
                perPage,
            });
            return {
                isValid: true,
                message: 'OK',
                result,
                requestTraceId: null
            };
        } catch (error) {
            throw new InternalServerErrorException({
                isValid: true,
                message: error.message || 'Internal server error',
                result: null,
                requestTraceId: null
            });
        }
    }
}