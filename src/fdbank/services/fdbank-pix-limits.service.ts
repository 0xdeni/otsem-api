import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankPixLimitsService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/PixLimits/';
    private token = process.env.FDBANK_API_KEY;

    private async getHeaders() {
        return {
            'x-api-key': this.token,
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