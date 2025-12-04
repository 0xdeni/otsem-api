import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankPixKeyService {
    private baseUrl = 'https://api-baas.fdbank.com.br/v1.0/PixKey/';
    private token = process.env.FDBANK_API_KEY;

    private async getHeaders() {
        return {
            'x-api-key': this.token,
        };
    }

    async listPixKeys() {
        const response = await axios.get(this.baseUrl, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }

    async createPixKey(data: any) {
        try {
            const response = await axios.post(this.baseUrl, data, {
                headers: await this.getHeaders(),
            });
            return {
                isValid: true,
                message: response.data.message || 'Pix key created',
                result: response.data.result,
                requestTraceId: response.data.requestTraceId || null,
            };
        } catch (error: any) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message || 'Error';
            const requestTraceId = error.response?.data?.requestTraceId || null;
            const result = error.response?.data?.result || null;

            if (status === 400 || status === 404) {
                return {
                    isValid: false,
                    message,
                    result,
                    requestTraceId,
                };
            }
            // 500 ou outros erros
            return {
                isValid: false,
                message,
                result,
                requestTraceId,
            };
        }
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