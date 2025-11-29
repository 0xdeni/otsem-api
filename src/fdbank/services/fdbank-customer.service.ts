import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankCustomerService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/Customer/';
    private apiKey = process.env.FDBANK_API_KEY; // ajuste conforme sua configuração

    private getHeaders() {
        return { 'x-api-key': this.apiKey };
    }

    async listCustomers() {
        const response = await axios.get(this.baseUrl, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async createCustomer(data: any) {
        const response = await axios.post(this.baseUrl, data, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async getCustomer(id: string) {
        const response = await axios.get(`${this.baseUrl}${id}`, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async updateCustomer(id: string, data: any) {
        const response = await axios.put(`${this.baseUrl}${id}`, data, {
            headers: this.getHeaders(),
        });
        return response.data;
    }

    async deleteCustomer(id: string) {
        const response = await axios.delete(`${this.baseUrl}${id}`, {
            headers: this.getHeaders(),
        });
        return response.data;
    }
}