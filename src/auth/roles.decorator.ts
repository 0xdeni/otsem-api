import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('ADMIN' | 'CLIENT')[]) => SetMetadata(ROLES_KEY, roles);
