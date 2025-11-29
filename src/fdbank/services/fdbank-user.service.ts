import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { FdbankAuthService } from './fdbank-auth.service';

@Injectable()
export class FdbankUserService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/User/';
    private apiKey = process.env.FDBANK_API_KEY;
    private username = process.env.FDBANK_USERNAME;
    private password = process.env.FDBANK_PASSWORD;

    constructor(private readonly authService: FdbankAuthService) { }

    private async getHeaders() {
        const token = await this.authService.getToken({
            username: "this.username",
            password: "this.password",
        });
        return {
            'x-api-key': this.apiKey,
            'Authorization': `Bearer ${token}`,
        };
    }

    async updateUserStatus(id: string, data: any) {
        const response = await axios.put(`${this.baseUrl}${id}/Status`, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async updateUserPermissions(id: string, data: any) {
        const response = await axios.put(`${this.baseUrl}${id}/Permissions`, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }
}