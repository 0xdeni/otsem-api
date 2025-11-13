import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BalanceResponse {
    @ApiProperty({ example: 1500.50 })
    available: number;

    @ApiProperty({ example: 200.00 })
    blocked: number;

    @ApiProperty({ example: 1700.50 })
    total: number;

    @ApiPropertyOptional({ example: 'BRL' })
    currency?: string;

    @ApiPropertyOptional()
    accountHolderId?: string;

    @ApiPropertyOptional()
    pixKey?: string;

    @ApiProperty()
    updatedAt: string;
}