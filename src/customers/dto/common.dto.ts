import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min, ValidateNested, IsIn, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
    @IsString() @IsNotEmpty() @MaxLength(9)
    zipCode!: string;

    @IsString() @IsNotEmpty()
    street!: string;

    @IsOptional() @IsString()
    number?: string;

    @IsOptional() @IsString()
    complement?: string;

    @IsString() @IsNotEmpty()
    neighborhood!: string;

    @IsInt()
    cityIbgeCode!: number;
}

export class PixLimitsDto {
    @IsNumber() @Min(0)
    singleTransfer!: number;

    @IsNumber() @Min(0)
    daytime!: number;

    @IsNumber() @Min(0)
    nighttime!: number;

    @IsNumber() @Min(0)
    monthly!: number;

    @IsInt() @IsIn([1, 8]) // 1 big-pix, 8 pix
    serviceId!: number;
}

export class OwnershipItemDto {
    @IsString() @IsNotEmpty()
    name!: string;

    @IsString() @IsNotEmpty()
    cpf!: string;

    @IsString() @IsNotEmpty()
    birthday!: string; // manter string (yyyy-mm-dd) no DTO

    @IsBoolean()
    isAdministrator!: boolean;
}
