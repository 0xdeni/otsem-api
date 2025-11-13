// src/common/dto/address.dto.ts
import { IsString, IsInt, IsOptional } from 'class-validator';

export class AddressDto {
  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsString()
  street!: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsString()
  neighborhood!: string;

  @IsInt()
  cityIbgeCode!: number;
}
