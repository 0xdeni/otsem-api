// src/pix/utils/keytype.ts
import { BadRequestException } from '@nestjs/common';

export function mapKeyTypeToApi(keyType: string): '1' | '2' | '3' | '4' | '5' {
    const t = keyType.trim().toLowerCase();
    if (t === '1' || t === 'cpf') return '1';
    if (t === '2' || t === 'cnpj') return '2';
    if (t === '3' || t === 'phone') return '3';
    if (t === '4' || t === 'email') return '4';
    if (t === '5' || t === 'random') return '5';
    throw new BadRequestException('KeyType inválido');
}
