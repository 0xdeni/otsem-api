import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, Matches } from 'class-validator';

export class SendSolDto {
  @ApiProperty({ description: 'Endereço Solana do destinatário', example: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV' })
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { message: 'Endereço Solana inválido' })
  toAddress: string;

  @ApiProperty({ description: 'Quantidade de SOL a enviar', example: 0.1 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
