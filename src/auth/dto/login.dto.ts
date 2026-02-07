// src/auth/dto/login.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'E-mail do usuário',
        example: 'joao@exemplo.com',
    })
    @IsEmail()
    email!: string;

    @ApiProperty({
        description: 'Senha do usuário',
        example: 'Senha@123',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    password!: string;

    @ApiPropertyOptional({
        description: 'Código TOTP de 6 dígitos (obrigatório se 2FA estiver ativo)',
        example: '123456',
    })
    @IsOptional()
    @IsString()
    @Length(6, 6)
    twoFactorCode?: string;
}