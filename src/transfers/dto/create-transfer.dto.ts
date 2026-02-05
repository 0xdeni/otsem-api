import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateTransferDto {
    @ApiProperty({ example: 'joaosilva', description: 'Username do destinatário' })
    @IsString()
    @IsNotEmpty({ message: 'Username é obrigatório' })
    @Matches(/^[a-z0-9_]{3,20}$/, { message: 'Username inválido' })
    username: string;

    @ApiProperty({ example: 10.50, description: 'Valor em BRL (mínimo R$ 0.01)' })
    @IsNumber({}, { message: 'Valor deve ser um número' })
    @Min(0.01, { message: 'Valor mínimo é R$ 0,01' })
    amount: number;

    @ApiPropertyOptional({ example: 'Pagamento do almoço', description: 'Descrição opcional da transferência' })
    @IsOptional()
    @IsString()
    description?: string;
}
