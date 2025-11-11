import {
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AddressDto, PixLimitsDto } from './common.dto';

export class OwnershipItemDto {
  @IsString() name!: string;

  @IsString()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  cpf!: string;

  @IsDateString() birthday!: string;

  @IsBoolean()
  @Type(() => Boolean)
  isAdministrator!: boolean;
}

export class AccreditationCompanyDto {
  @IsString() identifier!: string;
  @IsInt() productId!: number;

  @IsString() legalName!: string;
  @IsString() tradeName!: string;

  @IsString()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  cnpj!: string;

  @IsString()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  phone!: string;

  @IsEmail()
  @Transform(({ value }) => String(value).toLowerCase())
  email!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnershipItemDto)
  ownershipStructure!: OwnershipItemDto[];

  @ValidateNested()
  @Type(() => PixLimitsDto)
  pixLimits!: PixLimitsDto;
}
