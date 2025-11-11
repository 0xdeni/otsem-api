import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { AccountStatusDto, CustomerTypeDto } from './update-customer.dto';

export class ListCustomersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(CustomerTypeDto)
  type?: CustomerTypeDto;

  @IsOptional()
  @IsEnum(AccountStatusDto)
  accountStatus?: AccountStatusDto;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasAccreditation?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
