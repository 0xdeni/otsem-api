import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsEmail,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AccountStatusDto {
  not_requested = 'not_requested',
  requested = 'requested',
  in_review = 'in_review',
  approved = 'approved',
  rejected = 'rejected',
}

export enum CustomerTypeDto {
  PF = 'PF',
  PJ = 'PJ',
}

class AddressDto {
  @IsString()
  zipCode!: string;

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

class PixLimitsDto {
  @IsInt()
  singleTransfer!: number;

  @IsInt()
  daytime!: number;

  @IsInt()
  nighttime!: number;

  @IsInt()
  monthly!: number;

  @IsInt()
  serviceId!: number;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsEnum(AccountStatusDto)
  accountStatus?: AccountStatusDto;

  @IsOptional()
  @IsEnum(CustomerTypeDto)
  type?: CustomerTypeDto;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  socialName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsInt()
  genderId?: number;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PixLimitsDto)
  pixLimits?: PixLimitsDto;
}
