// src/admin-customers/dto/admin-list-customers.dto.ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CustomerType, AccountStatus } from '@prisma/client';

export class AdminListCustomersDto {
    @IsOptional()
    @IsString()
    q?: string;

    @IsOptional()
    @IsEnum(CustomerType)
    type?: CustomerType;

    @IsOptional()
    @IsEnum(AccountStatus)
    status?: AccountStatus;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    pageSize?: number = 10;
}
