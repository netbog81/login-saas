import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard REST per gli endpoint health protetti.
 * Verifica che il tenantContext (popolato da CurandisTenantContextMiddleware
 * di @curandis/auth-core) contenga il ruolo 'admin' nei ruoli Keycloak.
 */
@Injectable()
export class HealthAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantContext = request.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('No tenant context');
    }

    const roles: string[] = tenantContext.roles || [];
    if (!roles.includes('admin')) {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}
