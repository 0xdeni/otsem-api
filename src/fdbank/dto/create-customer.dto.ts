import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateCustomerDto {
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    taxpayer?: string;

    @IsOptional()
    @IsString()
    taxpayerType?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    address?: string;
}