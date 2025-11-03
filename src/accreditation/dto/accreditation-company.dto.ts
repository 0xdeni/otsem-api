import { IsArray, IsEmail, IsInt, IsOptional, IsString, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto, PixLimitsDto } from './common.dto';

export class OwnershipItemDto {
    @IsString() name!: string;
    @IsString() cpf!: string;
    @IsDateString() birthday!: string;
    @IsInt() // 0/1; mas doc diz boolean. Vamos usar boolean no body final.
    // para o DTO manteremos boolean (melhor):
    // Ajuste:
    isAdministrator!: boolean;
}

export class AccreditationCompanyDto {
    @IsString() identifier!: string;
    @IsInt() productId!: number; // 1 = digital-account

    // Company
    @IsString() legalName!: string;
    @IsString() tradeName!: string;
    @IsString() cnpj!: string;
    @IsString() phone!: string;
    @IsEmail() email!: string;

    address!: AddressDto;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OwnershipItemDto)
    ownershipStructure!: OwnershipItemDto[];

    // Pix limits
    pixLimits!: PixLimitsDto;
}
