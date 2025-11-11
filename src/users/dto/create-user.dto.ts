import { Role } from '@prisma/client';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
  IsBoolean,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail() email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
