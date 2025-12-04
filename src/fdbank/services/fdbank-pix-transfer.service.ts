import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankPixTransferService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/Pix/Transfer/';
    private token = process.env.FDBANK_API_KEY;

    private async getHeaders() {
        return {
            'x-api-key': this.token,
        };
    }

    async createPixTransfer(data: any) {
        const response = await axios.post(this.baseUrl, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async generatePixDynamicQrCode(data: any) {
        const response = await axios.post(`${this.baseUrl}GeneratePixDynamicQrCode`, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async captureQrCode(data: any) {
        const response = await axios.post(`${this.baseUrl}CaptureQrCode`, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }
}