import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum AccountStatusFilter {
    not_requested = 'not_requested',
    requested = 'requested',
    approved = 'approved',
    rejected = 'rejected',
}

export enum CustomerTypeFilter {
    PF = 'PF',
    PJ = 'PJ',
}

export class ListCustomersDto {
    @IsOptional() @IsString()
    q?: string;

    @IsOptional() @IsEnum(CustomerTypeFilter)
    type?: CustomerTypeFilter;

    @IsOptional() @IsEnum(AccountStatusFilter)
    status?: AccountStatusFilter;

    @Type(() => Number) @IsInt() @Min(1)
    page = 1;

    @Type(() => Number) @IsInt() @Min(1)
    pageSize = 10;
}
