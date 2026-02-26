import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export interface UserMeResponse {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  schemaName: string;
  tenantStatus: string;
  roles: string[];
}

/**
 * Endpoint GET /api/me
 *
 * Restituisce le informazioni dell'utente corrente estratte dal TenantContext.
 * Usato dal frontend dopo il callback OIDC Keycloak per ottenere
 * schemaName e tenantStatus (non presenti nel JWT Keycloak, risolti da OpenBao).
 *
 * Il TenantContextMiddleware ha già validato il JWT e popolato req.tenantContext.
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
      schemaName: ctx.schemaName,
      tenantStatus: ctx.tenantStatus,
      roles: ctx.roles,
    };
  }
}
