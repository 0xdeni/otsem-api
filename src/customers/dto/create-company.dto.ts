import { IsArray, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto, OwnershipItemDto, PixLimitsDto } from './common.dto';

export class CompanyBlock {
    @IsString() @IsNotEmpty()
    legalName!: string;

    @IsString() @IsNotEmpty()
    tradeName!: string;

    @IsString() @IsNotEmpty()
    cnpj!: string;

    @IsString() @IsNotEmpty()
    phone!: string;

    @IsEmail()
    email!: string;

    @ValidateNested() @Type(() => AddressDto)
    address!: AddressDto;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OwnershipItemDto)
    ownershipStructure!: OwnershipItemDto[];
}


export class CreateCompanyDto {
    @IsString() @IsNotEmpty()
    identifier!: string;

    @IsInt() @IsIn([1])
    productId!: number;

    @ValidateNested() @Type(() => CompanyBlock)
    company!: CompanyBlock;

    @ValidateNested() @Type(() => PixLimitsDto)
    pixLimits!: PixLimitsDto;
}
