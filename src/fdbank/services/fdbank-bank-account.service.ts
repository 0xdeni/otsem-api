import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankBankAccountService {
    private baseUrl = 'https://api-baas.fdbank.com.br/v1.0/BankAccount/';
    private token = process.env.FDBANK_API_KEY;

    private async getHeaders() {
        return {
            'x-api-key': this.token,
        };
    }

    async getActiveBankAccount() {
        const response = await axios.get(`${this.baseUrl}GetActiveBankAccount`, {
            headers: await this.getHeaders(),
        });
        return {
            success: true,
            data: response.data,
        };
    }

    async getBankAccountStatement(params: Record<string, any>) {
        const response = await axios.get(`${this.baseUrl}GetBankAccountStatement`, {
            headers: await this.getHeaders(),
            params,
        });
        return response.data;
    }
}