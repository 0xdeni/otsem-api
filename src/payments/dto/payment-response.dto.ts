export class PaymentResponseDto {
    id: string;
    endToEnd: string;
    paymentValue: number;
    paymentDate: Date;
    status: string;
    receiverPixKey?: string | null;
    customerId?: string | null;
    createdAt: Date;
    updatedAt: Date;
}