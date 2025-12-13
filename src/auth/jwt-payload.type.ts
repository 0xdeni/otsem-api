import type { Request } from 'express';
import type { Role } from '@prisma/client';

// Se já existir, mantenha; caso contrário defina:
export interface JwtPayload {
  sub: string;
  email?: string;
  role: Role;
  customerId?: string;
  iat?: number;
  exp?: number;
}

// Alias para usar nos controllers/guards
export type AuthRequest = Request & { user?: JwtPayload };
