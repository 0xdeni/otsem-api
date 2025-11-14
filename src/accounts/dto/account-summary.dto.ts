import { PaymentSummaryDto } from "./payment-summary.dto";

export class AccountSummaryDto {
    id: string;
    balance: number;
    status: string;
    pixKey?: string | null;
    pixKeyType?: string | null;
    dailyLimit: number;
    monthlyLimit: number;
    blockedAmount: number;
    createdAt: Date;
    updatedAt: Date;
    payments: PaymentSummaryDto[];
}