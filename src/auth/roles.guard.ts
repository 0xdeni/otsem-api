import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check handler-level @Roles first, then fall back to class-level @Roles
    const handlerRoles = this.reflector.get<Role[]>(
      'roles',
      context.getHandler(),
    );
    const classRoles = this.reflector.get<Role[]>(
      'roles',
      context.getClass(),
    );
    const requiredRoles = handlerRoles || classRoles;

    if (!requiredRoles || requiredRoles.length === 0) {
      // Default-deny: if RolesGuard is active but no @Roles specified, require ADMIN
      this.logger.warn(
        `⚠️ Nenhum @Roles definido em ${context.getClass().name}.${context.getHandler().name} — exigindo ADMIN por padrão`,
      );
      const request = context.switchToHttp().getRequest();
      const user = request.user;
      return user?.role === 'ADMIN';
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }
}
