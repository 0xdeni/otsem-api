import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminMarkBoletoAsPaidDto {
  @ApiProperty({
    description: 'Observações do admin sobre o pagamento',
    example: 'Boleto pago via internet banking',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class AdminRejectBoletoDto {
  @ApiProperty({
    description: 'Motivo da rejeição/falha',
    example: 'Boleto vencido ou inválido',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
