import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateBoletoPaymentDto {
  @ApiProperty({
    description: 'Linha digitável do boleto',
    example: '23793.38128 60000.000003 00000.000400 1 84340000012345',
  })
  @IsString()
  @IsNotEmpty({ message: 'O código de barras do boleto é obrigatório' })
  barcode: string;

  @ApiProperty({
    description: 'Valor do boleto em BRL (reais)',
    example: 150.0,
  })
  @IsNumber()
  @Min(1, { message: 'O valor do boleto deve ser no mínimo R$ 1,00' })
  boletoAmount: number;

  @ApiProperty({
    description: 'ID da wallet a ser usada para pagamento',
    example: 'clxyz123...',
  })
  @IsString()
  @IsNotEmpty({ message: 'O ID da wallet é obrigatório' })
  walletId: string;

  @ApiProperty({
    description: 'Moeda da wallet: USDT, SOL ou TRX',
    example: 'USDT',
    enum: ['USDT', 'SOL', 'TRX'],
  })
  @IsString()
  @IsNotEmpty({ message: 'A moeda é obrigatória' })
  cryptoCurrency: string;

  @ApiProperty({
    description: 'Descrição opcional do pagamento',
    example: 'Conta de luz - Janeiro 2026',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
