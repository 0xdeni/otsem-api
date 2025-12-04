import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankPixContactService {
    private baseUrl = 'https://api.fdbank.com.br/v1.0/PixContact/';
    private token = process.env.FDBANK_API_KEY;

    private async getHeaders() {
        return {
            'x-api-key': this.token,
        };
    }

    async listPixContacts() {
        const response = await axios.get(this.baseUrl, {
            headers: await this.getHeaders(),
        });
        return response.data;
    }
}