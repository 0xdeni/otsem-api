import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankUserService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/User/';
    private token = process.env.FDBANK_API_KEY;

    private async getHeaders() {
        return {
            'x-api-key': this.token,
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