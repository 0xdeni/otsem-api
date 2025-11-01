import { IsString, IsNumberString, IsOptional } from 'class-validator';

export class ReceivePixDto {
    @IsNumberString() amount!: string;      // "10.00"
    @IsOptional() @IsString() description?: string;
}
