import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, Min, MinLength } from 'class-validator';

export enum AdjustmentType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export class AdjustBalanceDto {
  @ApiProperty({
    enum: AdjustmentType,
    example: 'CREDIT',
    description: 'Tipo do ajuste: CREDIT (crédito) ou DEBIT (débito)',
  })
  @IsEnum(AdjustmentType, { message: 'Tipo deve ser CREDIT ou DEBIT' })
  type: AdjustmentType;

  @ApiProperty({
    example: 150.5,
    description: 'Valor do ajuste em BRL (mínimo R$ 0.01)',
  })
  @IsNumber({}, { message: 'Valor deve ser um número' })
  @Min(0.01, { message: 'Valor mínimo é R$ 0,01' })
  amount: number;

  @ApiProperty({
    example: 'Correção manual - depósito não processado pelo webhook',
    description: 'Motivo do ajuste (obrigatório para auditoria)',
  })
  @IsString({ message: 'Motivo deve ser uma string' })
  @MinLength(5, { message: 'Motivo deve ter no mínimo 5 caracteres' })
  reason: string;
}
