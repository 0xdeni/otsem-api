import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { FdbankAuthService } from './fdbank-auth.service';

@Injectable()
export class FdbankPixLimitsService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/PixLimits/';
    private apiKey = process.env.FDBANK_API_KEY;
    private username = process.env.FDBANK_USERNAME;
    private password = process.env.FDBANK_PASSWORD;

    constructor(private readonly authService: FdbankAuthService) { }

    private async getHeaders() {
        const token = await this.authService.getToken({
            username: "username",
            password: "password",
        });
        return {
            'x-api-key': this.apiKey,
            'Authorization': `Bearer ${token}`,
        };
    }

    async getPixLimits() {
        const response = await axios.get(this.baseUrl, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async updatePixLimits(data: any) {
        const response = await axios.post(this.baseUrl, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }
}