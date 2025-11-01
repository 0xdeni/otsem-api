import { IsString, IsOptional, IsNumberString, IsUUID, IsBoolean, IsOptional as Opt } from 'class-validator';

export class SendPixDto {
    @IsString() pixKey!: string;
    @IsNumberString() amount!: string;      // "10.00"
    @IsOptional() @IsString() description?: string;
    @Opt() @IsString() endToEnd?: string;   // vem da pré-consulta, opcional
}
