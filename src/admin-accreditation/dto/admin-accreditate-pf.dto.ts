import { IsEmail, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AddressDto, PixLimitsDto } from '../../accreditation/dto/common.dto';

export class AdminAccreditatePfDto {
    @IsString() identifier: string;
    @IsInt() productId: number;

    @IsString() name: string;

    @IsOptional() @IsString() socialName?: string;

    @IsString()
    @Transform(({ value }) => String(value).replace(/\D/g, ''))
    cpf: string;

    @IsString() birthday: string;

    @IsString()
    @Transform(({ value }) => String(value).replace(/\D/g, ''))
    phone: string;

    @IsEmail()
    @Transform(({ value }) => String(value).toLowerCase())
    email: string;

    @IsOptional() @IsInt() genderId?: number;

    @ValidateNested()
    @Type(() => AddressDto)
    address: AddressDto;

    @ValidateNested()
    @Type(() => PixLimitsDto)
    pixLimits: PixLimitsDto;
}
