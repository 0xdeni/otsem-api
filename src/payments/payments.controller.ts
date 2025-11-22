import {
    Controller,
    Get,
    Query,
    Post,
    Body,
    Req,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InterPixService } from '../inter/services/inter-pix.service';
import { SendPixDto } from '../inter/dto/send-pix.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

interface User {
    role: 'CUSTOMER' | 'ADMIN';
    customerId?: string;
    // add other properties as needed
}

@Controller('payments')
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly interPixService: InterPixService,
    ) { }

    @UseGuards(JwtAuthGuard)
    @Get()
    async listPayments(
        @Query('customerId') customerIdQuery: string,
        @Query('dataInicio') dataInicio: string,
        @Query('dataFim') dataFim: string,
        @Req() req: Request
    ) {
        const user = req.user as User;

        // ADMIN sem customerId: retorna todas as transações
        if (user.role === 'ADMIN' && !customerIdQuery) {
            return this.paymentsService.listPayments({
                dataInicio,
                dataFim,
            });
        }

        // CUSTOMER ou ADMIN com customerId: retorna apenas do customerId
        let customerId = user.customerId;
        if (user.role === 'ADMIN' && customerIdQuery) {
            customerId = customerIdQuery;
        }

        if (!customerId) {
            throw new BadRequestException('customerId não encontrado');
        }

        return this.paymentsService.listPayments({
            customerId,
            dataInicio,
            dataFim,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('pix/send')
    async sendPix(@Body() dto: SendPixDto, @Req() req: Request) {
        console.log('DTO recebido no sendPix:', dto);

        const user = req.user as User;

        if (!user || user.role !== 'CUSTOMER') {
            throw new BadRequestException('Apenas CUSTOMER pode enviar Pix');
        }

        if (!user.customerId) {
            throw new BadRequestException('customerId não encontrado para o usuário CUSTOMER');
        }

        console.log('customerId usado:', user.customerId);

        return this.interPixService.sendPix(user.customerId, dto);
    }
}