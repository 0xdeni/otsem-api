import { IsEmail, IsString, MinLength, IsOptional, IsEnum, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'joao@exemplo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Senha@123',
    description: 'Mínimo 8 caracteres, com pelo menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Senha deve conter pelo menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial',
  })
  password: string;

  @IsOptional() @IsString() name?: string;

  // KYC fields
  @IsOptional() @IsEnum(CustomerType) type?: CustomerType;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() cnpj?: string;

  // Affiliate code
  @IsOptional() @IsString() affiliateCode?: string;
}

export const RegisterDtoSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
    name: { type: 'string' },
    type: { type: 'string', enum: ['PF', 'PJ'] },
    cpf: { type: 'string' },
    cnpj: { type: 'string' },
  },
  required: ['email', 'password'],
};
