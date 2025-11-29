import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { FdbankAuthService } from './fdbank-auth.service';

@Injectable()
export class FdbankPixKeyService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/PixKey/';
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

    async listPixKeys() {
        const response = await axios.get(this.baseUrl, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async createPixKey(data: any) {
        const response = await axios.post(this.baseUrl, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async getPixKey(id: string) {
        const response = await axios.get(`${this.baseUrl}${id}`, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async deletePixKey(id: string) {
        const response = await axios.delete(`${this.baseUrl}${id}`, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async resolveDict(data: any) {
        const response = await axios.post(`${this.baseUrl}ResolveDict`, data, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }
}