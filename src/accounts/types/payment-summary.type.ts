export type PaymentSummary = {
    id: string;
    paymentValue: number;
    paymentDate: Date;
    receiverPixKey?: string | null;
    endToEnd: string;
    bankPayload: any;
};