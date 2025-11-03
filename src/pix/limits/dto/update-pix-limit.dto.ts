import { IsNumber, IsPositive, Min } from 'class-validator';

export class UpdatePixLimitDto {
    @IsNumber()
    @Min(0)
    singleTransfer!: number;

    @IsNumber()
    @Min(0)
    daytime!: number;

    @IsNumber()
    @Min(0)
    nighttime!: number;

    @IsNumber()
    @Min(0)
    monthly!: number;
}

export type BrxPixLimitResponse = {
    StatusCode: number;
    Title: string;
    Type: string;
    Extensions?: {
        Data?: {
            ClientId: string;
            ProductId: number;
            SingleTransfer: number;
            DayTime: number;
            NightTime: number;
            Monthly: number;
        };
        Message?: string;
    };
};

export type PixLimitResult = {
    clientId: string;
    productId: number;
    singleTransfer: number;
    daytime: number;
    nighttime: number;
    monthly: number;
    message?: string;
};

