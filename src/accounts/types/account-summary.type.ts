import { PaymentSummary } from './payment-summary.type';

export type AccountSummary = {
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
    payments: PaymentSummary[];
};