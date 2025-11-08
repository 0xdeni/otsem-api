// src/@types/express.d.ts
import "express";

declare global {
    namespace Express {
        export interface Request {
            user?: {
                sub: string;         // id do usuário
                email: string;
                role?: string;
                [key: string]: any;  // para payloads adicionais
            };
        }
    }
}
