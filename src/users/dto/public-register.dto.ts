// src/users/dto/public-register.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class PublicRegisterDto {
  @IsString() @MinLength(3) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}
