// src/transactions/dto/transaction-receipt.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReceiptPartyDto {
    @ApiPropertyOptional({ example: 'João da Silva' })
    name?: string;

    @ApiPropertyOptional({ example: '***456789**', description: 'CPF/CNPJ mascarado' })
    taxNumber?: string;

    @ApiPropertyOptional({ example: '12345678900', description: 'Chave PIX utilizada' })
    pixKey?: string;

    @ApiPropertyOptional({ example: '0077', description: 'Código do banco' })
    bankCode?: string;
}

export class TransactionReceiptDto {
    @ApiProperty({ example: 'Comprovante de Depósito PIX' })
    title: string;

    @ApiProperty({ example: 'uuid-da-transacao' })
    transactionId: string;

    @ApiProperty({ example: 'PIX_IN', enum: ['PIX_IN', 'PIX_OUT'] })
    type: string;

    @ApiProperty({ example: 'COMPLETED' })
    status: string;

    @ApiProperty({ example: 150.50 })
    amount: number;

    @ApiProperty({ example: '2025-11-13T14:30:00.000Z' })
    date: string;

    @ApiPropertyOptional({ example: '2025-11-13T14:30:05.000Z' })
    completedAt?: string;

    @ApiPropertyOptional({ example: 'E12345678901234567890123456789012' })
    endToEnd?: string;

    @ApiPropertyOptional({ example: 'OTSEMABCD1234567890XYZW12' })
    txid?: string;

    @ApiPropertyOptional({ example: 'Depósito para compra de USDT' })
    description?: string;

    @ApiProperty({ description: 'Dados do pagador' })
    payer: ReceiptPartyDto;

    @ApiProperty({ description: 'Dados do recebedor' })
    receiver: ReceiptPartyDto;

    @ApiPropertyOptional({ example: 'INTER' })
    bankProvider?: string;

    @ApiPropertyOptional({ example: 'Mensagem do pagador' })
    payerMessage?: string;
}
