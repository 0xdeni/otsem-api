import { IsInt, IsNotEmpty, IsOptional, IsString, IsEmail, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto, PixLimitsDto } from './common.dto';

export class PersonBlock {
    @IsString() @IsNotEmpty()
    name!: string;

    @IsOptional() @IsString()
    socialName?: string;

    @IsString() @IsNotEmpty()
    cpf!: string;

    @IsString() @IsNotEmpty()
    birthday!: string; // yyyy-mm-dd

    @IsString() @IsNotEmpty()
    phone!: string;

    @IsEmail()
    email!: string;

    @IsOptional() @IsInt() @IsIn([1, 2])
    genderId?: number;

    @ValidateNested() @Type(() => AddressDto)
    address!: AddressDto;
}


export class CreatePersonDto {
    @IsString() @IsNotEmpty()
    identifier!: string;

    @IsInt() @IsIn([1])
    productId!: number; // 1 = digital-account

    @ValidateNested() @Type(() => PersonBlock)
    person!: PersonBlock;

    @ValidateNested() @Type(() => PixLimitsDto)
    pixLimits!: PixLimitsDto;
}

