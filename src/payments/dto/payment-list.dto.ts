import { IsOptional, IsString } from 'class-validator';

export class PaymentListDto {
    @IsOptional()
    @IsString()
    customerId?: string;

    @IsOptional()
    @IsString()
    dataInicio?: string; // formato ISO (YYYY-MM-DD)

    @IsOptional()
    @IsString()
    dataFim?: string;    // formato ISO (YYYY-MM-DD)
}