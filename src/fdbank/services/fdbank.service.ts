import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class FdbankService {
    private apiUrl = process.env.FDBANK_API_URL || 'https://api-baas.fdbank.com.br/v1.0/';

    async systemHealth() {
        const url = `${this.apiUrl}Meta/Health`;
        const response = await axios.get(url);
        return response.data;
    }

    // Métodos de integração FD Bank serão implementados aqui
}