import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiTags,
    ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { Request as ExpressRequest } from 'express';

@ApiTags('Transfers')
@ApiBearerAuth()
@Controller('transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransfersController {
    constructor(private readonly service: TransfersService) {}

    @Post()
    @Roles(Role.CUSTOMER, Role.ADMIN)
    @ApiOperation({
        summary: 'Transferir BRL para outro usuário por username',
        description: 'Realiza transferência interna de BRL entre contas usando o username do destinatário. Ambas as contas devem estar ativas.',
    })
    @ApiResponse({ status: 201, description: 'Transferência realizada com sucesso' })
    @ApiResponse({ status: 400, description: 'Saldo insuficiente / Conta inativa / Auto-transferência' })
    @ApiResponse({ status: 404, description: 'Username não encontrado' })
    async create(
        @Request() req: ExpressRequest & { user: { customerId: string } },
        @Body() dto: CreateTransferDto,
    ) {
        const customerId = req.user.customerId;
        return this.service.createTransfer(customerId, dto);
    }
}
