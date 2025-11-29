export class CreateCustomerDto {
    name: string;
    email: string;
    taxpayer?: string;
    taxpayerType?: string;
    phone: string;
    address?: string;
}