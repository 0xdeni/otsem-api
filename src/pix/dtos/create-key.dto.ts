// src/pix/dtos/create-key.dto.ts
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

type KeyTypeInput = '1' | '2' | '3' | '4' | '5' | 'cpf' | 'cnpj' | 'phone' | 'email' | 'random';

/** Corpo aceito pelo seu backend */
export class CreatePixKeyDto {
    @IsString()
    @IsIn(['1', '2', '3', '4', '5', 'cpf', 'cnpj', 'phone', 'email', 'random'])
    keyType!: KeyTypeInput;

    /** Obrigatório para tudo, exceto random (5) */
    @ValidateIf(o => {
        const t = String(o.keyType).toLowerCase();
        return !(t === '5' || t === 'random');
    })
    @IsString()
    @IsOptional()
    pixKey?: string;
}

/** Payload que a BRX espera */
export interface BrxCreateKeyBody {
    KeyType: '1' | '2' | '3' | '4' | '5';
    PixKey?: string; // omitido quando aleatória
}

/** Resposta bruta padrão BRX (mantemos tipagem aberta) */
export interface BrxCreateKeyRaw {
    statusCode?: number;
    title?: string;
    type?: string;
    extensions?: {
        data?: unknown;
        message?: string;
        errors?: unknown;
    };
}
