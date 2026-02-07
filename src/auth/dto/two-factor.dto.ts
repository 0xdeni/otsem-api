import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class TwoFactorCodeDto {
  @ApiProperty({
    description: 'Código TOTP de 6 dígitos do app autenticador',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code!: string;
}
