import { IsNotEmpty, IsString, IsEmail, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
    @IsString() zipCode: string;
    @IsString() street: string;
    @IsString() neighborhood: string;
    @IsNumber() cityIbgeCode: number;
    number?: string;
    complement?: string;
}

class PixLimitsDto {
    @IsNumber() singleTransfer: number;
    @IsNumber() daytime: number;
    @IsNumber() nighttime: number;
    @IsNumber() monthly: number;
    @IsNumber() serviceId: number;
}

export class AdminAccreditatePfDto {
    @IsString() identifier: string;
    @IsNumber() productId: number;

    @IsString() name: string;
    socialName?: string;
    @IsString() cpf: string;
    @IsString() birthday: string;
    @IsString() phone: string;
    @IsEmail() email: string;
    genderId?: number;

    @ValidateNested() @Type(() => AddressDto) address: AddressDto;
    @ValidateNested() @Type(() => PixLimitsDto) pixLimits: PixLimitsDto;
}
