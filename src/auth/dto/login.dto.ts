// src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

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
        minLength: 6,
    })
    @IsString()
    @MinLength(6)
    password!: string;
}