import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStaticQrCodeDto {
    @ApiProperty({ 
        example: 100.50, 
        description: 'Valor fixo (opcional - se não informado, gera QR Code com valor aberto)',
        required: false
    })
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    valor?: number;

    @ApiProperty({
        example: 'Loja Centro',
        description: 'Descrição/identificador do ponto de venda',
        required: false
    })
    @IsOptional()
    @IsString()
    descricao?: string;

    @ApiProperty({
        example: 'LOJA01',
        description: 'Identificador único para rastrear pagamentos (máx 25 caracteres)',
        required: false
    })
    @IsOptional()
    @IsString()
    identificador?: string;
}
