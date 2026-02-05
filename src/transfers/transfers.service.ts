import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class TransfersService {
    private readonly logger = new Logger(TransfersService.name);

    constructor(private readonly transactionsService: TransactionsService) {}

    async createTransfer(fromCustomerId: string, dto: CreateTransferDto) {
        this.logger.log(`📤 Nova transferência: @${dto.username} R$ ${dto.amount}`);

        if (dto.amount <= 0) {
            throw new BadRequestException('Valor deve ser maior que zero');
        }

        const result = await this.transactionsService.processTransferByUsername(
            fromCustomerId,
            dto.username,
            dto.amount,
            dto.description,
        );

        return {
            success: true,
            transfer: {
                id: result.txOut.id,
                amount: Number(result.txOut.amount),
                description: result.txOut.description,
                status: result.txOut.status,
                createdAt: result.txOut.createdAt,
                sender: result.sender,
                receiver: result.receiver,
            },
        };
    }
}
