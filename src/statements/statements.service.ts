// src/statements/statements.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BrxAuthService } from '../brx/brx-auth.service';
import { firstValueFrom } from 'rxjs';

interface BalanceResponse {
    StatusCode: number;
    Title: string;
    Extensions?: {
        Data?: {
            AccountHolderId: string;
            AvailableBalance: number;
            BlockedBalance: number;
            TotalBalance: number;
            Currency: string;
            UpdatedAt: string;
        };
        Message?: string;
    };
}

interface StatementResponse {
    StatusCode: number;
    Title: string;
    Extensions?: {
        Data?: {
            Statements: Array<{
                TransactionId: string;
                Type: string;
                Amount: number;
                Description: string;
                CreatedAt: string;
                Status: string;
            }>;
            TotalCount: number;
            Page: number;
            Limit: number;
        };
        Message?: string;
    };
}

@Injectable()
export class StatementsService {
    private readonly logger = new Logger(StatementsService.name);
    private readonly baseUrl = process.env.BRX_API_URL || 'https://apisbank.brxbank.com.br';

    constructor(
        private readonly httpService: HttpService,
        private readonly brxAuth: BrxAuthService,
    ) { }

    /* -------------------- Consultar Saldo -------------------- */
    async getBalance(accountHolderId: string) {
        const token = await this.brxAuth.getAccessToken();
        const url = `${this.baseUrl}/statements/account-holders/${accountHolderId}/balance`;

        this.logger.debug(`Consultando saldo accountHolderId=${accountHolderId}`);

        try {
            const response = await firstValueFrom(
                this.httpService.get<BalanceResponse>(url, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            const data = response.data;

            if (data.StatusCode >= 400) {
                throw new BadRequestException(
                    data.Extensions?.Message || data.Title || 'Erro ao consultar saldo',
                );
            }

            const balance = data.Extensions?.Data;
            if (!balance) {
                throw new BadRequestException('Saldo não retornado pela BRX');
            }

            return {
                accountHolderId: balance.AccountHolderId,
                availableBalance: balance.AvailableBalance,
                blockedBalance: balance.BlockedBalance,
                totalBalance: balance.TotalBalance,
                currency: balance.Currency,
                updatedAt: balance.UpdatedAt,
            };
        } catch (e: any) {
            const msg = e?.response?.data?.Extensions?.Message || e?.message || 'Erro ao consultar saldo';
            this.logger.error(`Falha ao consultar saldo: ${msg}`);
            throw new BadRequestException(msg);
        }
    }

    /* -------------------- Consultar Extrato -------------------- */
    async getStatement(
        accountHolderId: string,
        page = 1,
        limit = 50,
        startDate?: string,
        endDate?: string,
    ) {
        const token = await this.brxAuth.getAccessToken();
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
        });
        const url = `${this.baseUrl}/statements/account-holders/${accountHolderId}?${params}`;

        this.logger.debug(`Consultando extrato accountHolderId=${accountHolderId}`);

        try {
            const response = await firstValueFrom(
                this.httpService.get<StatementResponse>(url, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            const data = response.data;

            if (data.StatusCode >= 400) {
                throw new BadRequestException(
                    data.Extensions?.Message || data.Title || 'Erro ao consultar extrato',
                );
            }

            const result = data.Extensions?.Data;
            if (!result) {
                throw new BadRequestException('Extrato não retornado pela BRX');
            }

            return {
                statements: result.Statements ?? [],
                total: result.TotalCount ?? 0,
                page: result.Page ?? page,
                limit: result.Limit ?? limit,
            };
        } catch (e: any) {
            const msg = e?.response?.data?.Extensions?.Message || e?.message || 'Erro ao consultar extrato';
            this.logger.error(`Falha ao consultar extrato: ${msg}`);
            throw new BadRequestException(msg);
        }
    }
}