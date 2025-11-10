import { IsEmail, IsInt, IsOptional, IsString, IsBoolean, IsDateString, Min, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddressDto {
  @IsString()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  zipCode!: string;

  @IsString() street!: string;

  @IsOptional() @IsString() number?: string;

  @IsOptional() @IsString() complement?: string;

  @IsString() neighborhood!: string;

  @IsInt() cityIbgeCode!: number;
}

/** Limites Pix (campos em camelCase; no service eu mapeio para PascalCase) */
export class PixLimitsDto {
  @IsNumber() singleTransfer!: number;
  @IsNumber() daytime!: number;
  @IsNumber() nighttime!: number;
  @IsNumber() monthly!: number;
  @IsInt() serviceId!: number;
}

/** Resposta normalizada para o front */
export type AccreditationResult = {
    accreditationId: string;
    clientId: string;
    accreditationStatus: string;
    accreditationStatusId: number;
    product: string;
    productId: number;
    // PF
    person?: {
        name: string;
        socialName?: string | null;
        cpf: string;
        birthday: string;
        phone: string;
        email: string;
        genderId?: number | null;
        address: {
            zipCode: string;
            street: string;
            number?: string | null;
            complement?: string | null;
            neighborhood: string;
            cityIbgeCode: string | number;
        };
    };
    // PJ
    company?: {
        legalName: string;
        tradeName: string;
        cnpj: string;
        phone: string;
        email: string;
        address: {
            zipCode: string;
            street: string;
            number?: string | null;
            complement?: string | null;
            neighborhood: string;
            cityIbgeCode: string | number;
        };
        ownershipStructure: Array<{
            name: string;
            cpf: string;
            birthday: string;
            isAdministrator: boolean;
        }>;
    };
    pixLimits?: {
        singleTransfer: number;
        daytime: number;
        nighttime: number;
        monthly: number;
    };
    message?: string;
};
