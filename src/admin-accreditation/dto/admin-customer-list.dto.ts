import { AccountStatus, CustomerType } from '@prisma/client';

export class AdminCustomerListItem {
    id: string;
    type: CustomerType;
    name: string | null;
    taxNumber: string | null;
    email: string;
    phone: string;
    status: AccountStatus;
    externalClientId: string | null;
    externalAccredId: string | null;
    createdAt: Date;
}
