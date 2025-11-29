import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { FdbankAuthService } from './fdbank-auth.service';

@Injectable()
export class FdbankBankAccountService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/BankAccount/';
    private apiKey = process.env.FDBANK_API_KEY;

    // TODO: Ajustar para obter username e password dinamicamente

    private username = "username"
    private password = "password"

    constructor(private readonly authService: FdbankAuthService) { }

    private async getHeaders() {
        const token = await this.authService.getToken({
            username: this.username,
            password: this.password,
        });
        return {
            'x-api-key': this.apiKey,
            'Authorization': `Bearer ${token}`,
        };
    }

    async getActiveBankAccount() {
        const response = await axios.get(`${this.baseUrl}GetActiveBankAccount`, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async getBankAccountStatement(params: { startDate: string; endDate: string }) {
        const response = await axios.get(`${this.baseUrl}GetBankAccountStatement`, {
            headers: await this.getHeaders(),
            params,
        });
        return response.data;
    }
}