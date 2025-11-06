import { IsString, IsEmail, IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
    @IsString() zipCode: string;
    @IsString() street: string;
    @IsString() neighborhood: string;
    @IsNumber() cityIbgeCode: number;
    number?: string;
    complement?: string;
}

class OwnershipDto {
    @IsString() name: string;
    @IsString() cpf: string;
    @IsString() birthday: string;
    @IsNumber() isAdministrator: boolean;
}

class PixLimitsDto {
    @IsNumber() singleTransfer: number;
    @IsNumber() daytime: number;
    @IsNumber() nighttime: number;
    @IsNumber() monthly: number;
    @IsNumber() serviceId: number;
}

export class AdminAccreditatePjDto {
    @IsString() identifier: string;
    @IsNumber() productId: number;

    @IsString() legalName: string;
    @IsString() tradeName: string;
    @IsString() cnpj: string;
    @IsString() phone: string;
    @IsEmail() email: string;

    @ValidateNested() @Type(() => AddressDto) address: AddressDto;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OwnershipDto)
    ownershipStructure: OwnershipDto[];

    @ValidateNested() @Type(() => PixLimitsDto) pixLimits: PixLimitsDto;
}
