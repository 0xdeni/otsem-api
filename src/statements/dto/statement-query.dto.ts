import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class StatementQueryDto {
    @ApiPropertyOptional({
        description: 'Data inicial (ISO 8601)',
        example: '2025-01-01T00:00:00.000Z'
    })
    @IsOptional()
    @IsString()
    from?: string;

    @ApiPropertyOptional({
        description: 'Data final (ISO 8601)',
        example: '2025-01-31T23:59:59.999Z'
    })
    @IsOptional()
    @IsString()
    to?: string;

    @ApiPropertyOptional({
        description: 'Alias para "from" (compatibilidade)',
        example: '2025-01-01'
    })
    @IsOptional()
    @IsString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'Alias para "to" (compatibilidade)',
        example: '2025-01-31'
    })
    @IsOptional()
    @IsString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Tipo de transação',
        enum: TransactionType,
        example: 'PIX_IN',
    })
    @IsOptional()
    @IsEnum(TransactionType, { message: 'Tipo de transação inválido' })
    type?: TransactionType;

    @ApiPropertyOptional({
        description: 'Status da transação',
        enum: TransactionStatus,
        example: 'COMPLETED',
    })
    @IsOptional()
    @IsEnum(TransactionStatus, { message: 'Status de transação inválido' })
    status?: TransactionStatus;

    @ApiPropertyOptional({
        description: 'Número da página',
        example: 1,
        default: 1,
        minimum: 1
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        description: 'Limite de resultados por página',
        example: 50,
        default: 50,
        minimum: 1,
        maximum: 200
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number;
}