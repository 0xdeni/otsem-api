import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankAuthService {
    private baseUrl = process.env.FDBANK_API_URL || 'https://api-baas.fdbank.com.br/v1.0/';
    private apiKey = process.env.FDBANK_API_KEY;

    async getToken(credentials: { username: string; password: string }) {
        const response = await axios.post(`${this.baseUrl}Auth`, credentials, {
            headers: { 'x-api-key': this.apiKey }
        });
        // Retorna o token JWT
        return response.data?.token;
    }
}