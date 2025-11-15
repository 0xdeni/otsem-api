import { Controller, Get, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentListDto } from './dto/payment-list.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Get()
    async listPayments(@Query() query: PaymentListDto): Promise<PaymentResponseDto[]> {
        return this.paymentsService.listPayments(query);
    }
}