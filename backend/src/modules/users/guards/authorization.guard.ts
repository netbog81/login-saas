import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, Logger, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AppUserService } from '../services/app-user.service';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/**
 * Guard di autorizzazione predisposto per OPA.
 *
 * Modalita' attuale: valuta permessi localmente dalle tabelle roles/permissions.
 * Futuro (USE_OPA=true): chiama OPA sidecar su http://localhost:8181/v1/data/authz/allow.
 *
 * Utilizzo:
 *   @RequirePermissions('patient_read', 'calendar_manage')
 *   @UseGuards(AuthorizationGuard)
 *   myResolver() { ... }
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  private readonly logger = new Logger(AuthorizationGuard.name);
  private readonly useOpa = process.env.USE_OPA === 'true';
  private readonly opaUrl = process.env.OPA_URL || 'http://localhost:8181';

  constructor(
    private readonly reflector: Reflector,
    private readonly appUserService: AppUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Estrai tenantContext dalla request — il guard è usato sia sui
    // resolver GraphQL sia sui controller REST (upload/download documenti)
    const request =
      context.getType<'http' | 'graphql'>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();
    const tenantContext = request?.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('No tenant context');
    }

    if (this.useOpa) {
      return this.evaluateWithOpa(tenantContext, requiredPermissions, request);
    }

    return this.evaluateLocally(tenantContext, requiredPermissions);
  }

  /**
   * Valutazione locale: verifica che l'utente abbia i permessi richiesti
   * tramite le tabelle roles/permissions nel DB.
   */
  private async evaluateLocally(
    tenantContext: any,
    requiredPermissions: string[],
  ): Promise<boolean> {
    // Cerca l'appUser tramite keycloak_id (dal JWT)
    const appUser = await this.appUserService.findByKeycloakId(tenantContext.userId);
    if (!appUser) {
      this.logger.warn(`No app_user found for keycloak_id ${tenantContext.userId}`);
      throw new ForbiddenException('User not found in app');
    }

    const userPermissions = await this.appUserService.getUserPermissions(appUser.id);
    const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      this.logger.warn(
        `User ${appUser.email} missing permissions: ${requiredPermissions.filter((p) => !userPermissions.includes(p)).join(', ')}`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  /**
   * Valutazione OPA: invia input al sidecar OPA per decisione.
   * Predisposizione per integrazione futura.
   */
  private async evaluateWithOpa(
    tenantContext: any,
    requiredPermissions: string[],
    request: any,
  ): Promise<boolean> {
    // TODO: Implementare chiamata a OPA quando il sidecar sara' attivo
    // const opaInput = {
    //   user: {
    //     id: tenantContext.userId,
    //     email: tenantContext.email,
    //     roles: tenantContext.roles,
    //     attributes: {},
    //   },
    //   action: requiredPermissions,
    //   resource: { type: 'graphql', path: request?.body?.operationName },
    //   context: {
    //     tenant_id: tenantContext.tenantId,
    //     schema: tenantContext.schemaName,
    //   },
    // };
    // const response = await fetch(`${this.opaUrl}/v1/data/authz/allow`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ input: opaInput }),
    // });
    // const result = await response.json();
    // return result?.result?.allow === true;

    // Fallback: valutazione locale finche' OPA non e' attivo
    this.logger.warn('OPA mode enabled but sidecar not implemented yet, falling back to local evaluation');
    return this.evaluateLocally(tenantContext, requiredPermissions);
  }
}
