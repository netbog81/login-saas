import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export interface UserMeResponse {
  userId: string;
  email: string;
  name: string;
  /** UUID organizzazione Keycloak. `null` per service-account (raro su /api/me). */
  orgId: string | null;
  /** Alias del tenant (es. "bdq"). */
  tenantAlias: string;
  roles: string[];
}

/**
 * Endpoint GET /api/me
 *
 * Restituisce le informazioni dell'utente corrente estratte dal CurandisTenantContext
 * (popolato da @curandis/auth-core CurandisTenantContextMiddleware).
 *
 * Usato dal frontend dopo il callback OIDC Keycloak per leggere identità +
 * tenant + ruoli. Il middleware ha già validato il JWT.
 *
 * NOTA: il vecchio campo `schemaName` non esiste più (architettura DB-per-tenant
 * post-containerizzazione 2026-06-11). Frontend che lo leggeva → ora usa
 * `tenantAlias`.
 */
@Controller('api')
export class MeController {
  @Get('me')
  getMe(@Req() req: Request): UserMeResponse {
    const ctx = req.tenantContext;
    if (!ctx) {
      throw new UnauthorizedException('No tenant context');
    }

    return {
      userId: ctx.userId,
      email: ctx.email,
      name: ctx.name,
      orgId: ctx.orgId,
      tenantAlias: ctx.tenantAlias,
      roles: ctx.roles,
    };
  }
}
