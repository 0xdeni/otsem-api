// src/users/dto/create-user-with-customer.dto.ts
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CustomerType, Role } from '@prisma/client';

class CreateCustomerPayloadDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEnum(CustomerType)
  type!: CustomerType;

  @IsOptional()
  @IsString()
  identifier?: string;

  @IsOptional()
  productId?: number; // defaultaremos 1 no service
}

export class CreateUserWithCustomerDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsObject()
  @Type(() => CreateCustomerPayloadDto)
  customer!: CreateCustomerPayloadDto;
}
