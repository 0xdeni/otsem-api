import { IsEmail, IsInt, IsOptional, IsString, IsDateString } from 'class-validator';
import { AddressDto, PixLimitsDto } from './common.dto';

export class AccreditationPersonDto {
    @IsString() identifier!: string;     // Identificador do Integrador
    @IsInt() productId!: number;         // 1 = digital-account (doc)

    // Person
    @IsString() name!: string;
    @IsOptional() @IsString() socialName?: string;
    @IsString() cpf!: string;            // só dígitos
    @IsDateString() birthday!: string;   // YYYY-MM-DD
    @IsString() phone!: string;          // E.164 recomendado (+55...)
    @IsEmail() email!: string;
    @IsOptional() @IsInt() genderId?: number; // 1 male, 2 female

    // Address
    address!: AddressDto;

    // Pix limits
    pixLimits!: PixLimitsDto;
}
