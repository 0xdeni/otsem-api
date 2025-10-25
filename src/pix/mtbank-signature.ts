// src/pix/mtbank-signature.ts
import * as crypto from 'crypto';

export function verifyMtbankSignature(headers: Record<string, any>, raw: string) {
    if (process.env.MTBANK_WEBHOOK_SKIP_SIGNATURE === '1') return true;

    const secret = process.env.MTBANK_WEBHOOK_SECRET;
    if (!secret) return true; // sem segredo definido, não bloqueia em dev

    // tente múltiplos nomes de header
    const header =
        (headers['x-webhook-signature'] ??
            headers['x-signature'] ??
            headers['x-hub-signature'] ??
            headers['x-mtbank-signature'] ??
            headers['x-mtbank-webhook-signature'] ??
            headers['x-mt-signature'] ??
            '') as string;

    // o banco pode enviar HEX ou BASE64. Vamos aceitar os dois.
    const hmac = crypto.createHmac('sha256', secret).update(raw);

    const calcBase64 = hmac.digest('base64');
    const calcHex = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    // normaliza
    const got = (header || '').trim();

    return got === calcBase64 || got === calcHex;
}
