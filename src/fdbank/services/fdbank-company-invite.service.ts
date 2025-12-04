import { Injectable } from '@nestjs/common';
import axios from 'axios';


@Injectable()
export class FdbankCompanyInviteService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/CompanyInvite/';
    private token = process.env.FDBANK_API_KEY;

    private async getHeaders() {
        return {
            'x-api-key': this.token,
        };
    }

    async listCompanyInvites() {
        const response = await axios.get(this.baseUrl, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async createCompanyInvite(data: any) {
        const response = await axios.post(this.baseUrl, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async deleteCompanyInvite(id: string) {
        const response = await axios.delete(`${this.baseUrl}${id}`, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }
}