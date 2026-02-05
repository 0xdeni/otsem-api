import { IsString, MinLength, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminChangePasswordDto {
  @ApiProperty({ description: 'Nova senha (mínimo 8 caracteres)', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class AdminChangePasswordByEmailDto {
  @ApiProperty({ description: 'Email do usuário' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Nova senha (mínimo 8 caracteres)', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
