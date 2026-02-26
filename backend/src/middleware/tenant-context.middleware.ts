import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { JwksService } from '../auth/jwks.service';
import { TenantSchemaService } from '../database/tenant-schema.service';
import { TenantSchemaContextService } from '../database/tenant-schema-context.service';
import { TenantAuditService } from '../database/tenant-audit.service';
import { TenantOpenbaoResolverService } from '../database/tenant-openbao-resolver.service';

export interface TenantContext {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
  orgId: string;
  schemaName: string;
  tenantStatus: string;  // active | pending_schema | suspended | deleted
  requestId: string;
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);
  private readonly KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'curandis-app-angular';

  constructor(
    private readonly jwksService: JwksService,
    private readonly tenantSchemaService: TenantSchemaService,
    private readonly tenantSchemaContext: TenantSchemaContextService,
    private readonly tenantAudit: TenantAuditService,
    private readonly tenantResolver: TenantOpenbaoResolverService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Estrai il token dall'header Authorization (Bearer)
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('No auth token');
    }

    try {
      // 2. Valida JWT Keycloak localmente via JWKS (zero chiamate HTTP aggiuntive)
      const payload = await this.jwksService.verifyToken(token);
      if (!payload) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      // 3. Estrai claims dal JWT Keycloak
      const userId = payload['sub'] as string;
      const email = (payload['email'] as string) || '';
      const name = (payload['name'] as string) || (payload['preferred_username'] as string) || '';
      const requestId = randomUUID();

      // Il subdomain (es. "demo4" da demo4.curandis.cloud) è la fonte di verità
      // per determinare quale tenant servire. L'org nel token serve per verificare
      // che l'utente sia autorizzato ad accedere a quel subdomain.
      // X-Tenant-Alias è inviato dal frontend con il subdomain corrente,
      // necessario perché le API vanno a api.curandis.cloud (Host diverso dal tenant).
      const requestedTenant = (req.headers['x-tenant-alias'] as string) || this.extractTenantFromHost(req);

      // Estrai org dal token/headers per verifica autorizzazione
      let tokenOrgId = this.extractOrgId(payload);
      let tokenOrgAlias = this.extractOrgAlias(payload);
      if (!tokenOrgId) {
        tokenOrgId = req.headers['x-org-id'] as string || null;
      }
      if (!tokenOrgAlias) {
        tokenOrgAlias = req.headers['x-org-alias'] as string || null;
      }

      // Il tenant da servire è il subdomain; fallback all'org del token se non c'è subdomain
      let orgAlias = requestedTenant || tokenOrgAlias || tokenOrgId;
      let orgId = tokenOrgId || tokenOrgAlias || requestedTenant;

      if (!orgAlias) {
        this.logger.warn(`Nessun tenant determinabile per userId="${userId}"`);
        throw new ForbiddenException('Missing tenant context');
      }

      // Verifica: se c'è un subdomain E un'org nel token, devono corrispondere
      if (requestedTenant && tokenOrgAlias && requestedTenant !== tokenOrgAlias) {
        this.logger.warn(
          `Tenant mismatch: utente org="${tokenOrgAlias}" su subdomain="${requestedTenant}" (userId="${userId}")`,
        );
        throw new ForbiddenException(
          `Accesso negato: l'utente appartiene a "${tokenOrgAlias}", non a "${requestedTenant}"`,
        );
      }

      if (!orgId) {
        orgId = orgAlias;
      }

      // Roles: realm_access.roles + resource_access[clientId].roles
      const roles = this.extractRoles(payload);

      // 4. Risolvi schemaName e tenantStatus tramite OpenBao (kv/data/tenant-map/{alias})
      const tenantInfo = await this.tenantResolver.resolveTenant(orgAlias);
      if (!tenantInfo) {
        throw new ForbiddenException(`Tenant non trovato in OpenBao: alias="${orgAlias}"`);
      }

      const { schemaName, status: tenantStatus } = tenantInfo;
      this.logger.log(`Tenant risolto: orgAlias="${orgAlias}" → schema="${schemaName}", status="${tenantStatus}"`);

      // 5. Verifica stato tenant: blocca suspended/deleted
      if (tenantStatus === 'suspended' || tenantStatus === 'deleted') {
        throw new ForbiddenException(`Tenant ${tenantStatus}`);
      }

      // 6. Verifica esistenza schema nel DB (solo informativa, nessun provisioning automatico)
      if (schemaName && schemaName !== 'pending' && tenantStatus === 'active') {
        const exists = await this.tenantSchemaService.schemaExists(schemaName);
        if (!exists) {
          this.logger.warn(
            `Schema "${schemaName}" non trovato nel DB per orgId="${orgId}". ` +
            `L'admin deve avviare il provisioning dalla dashboard /admin.`,
          );
        }
      }

      // 7. Popola tenantContext nella request
      const tenantContext: TenantContext = {
        userId,
        email,
        name,
        roles,
        tenantId: orgId,
        orgId,
        schemaName,
        tenantStatus,
        requestId,
      };
      req.tenantContext = tenantContext;

      // 8. Imposta AsyncLocalStorage per isolamento schema (solo tenant attivi con schema valido)
      const shouldSetSchema = Boolean(
        schemaName &&
        schemaName !== 'pending' &&
        tenantStatus === 'active',
      );

      if (shouldSetSchema) {
        await new Promise<void>((resolve, reject) => {
          this.tenantSchemaContext.run(
            { schemaName, tenantId: orgId, userId, requestId },
            () => {
              this.tenantAudit.log('SCHEMA_SET', { requestId, schemaName });
              Promise.resolve(next()).then(resolve).catch(reject);
            },
          );
        });
      } else {
        next();
      }
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Errore validazione token', error);
      throw new UnauthorizedException('Token validation failed');
    }
  }

  /**
   * Estrae il token JWT dall'header Authorization: Bearer <token>.
   * Con Keycloak OIDC il token viaggia solo nell'header, non nel cookie.
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  /**
   * Estrae l'alias del tenant dal subdomain della richiesta HTTP.
   * Es: "demo4.curandis.cloud" → "demo4"
   * Es: "api.curandis.cloud" → null (non è un tenant)
   * Es: "localhost" → null
   */
  private extractTenantFromHost(req: Request): string | null {
    const host = (req.headers['x-forwarded-host'] as string) || req.hostname || '';
    const hostname = host.split(':')[0]; // rimuovi porta

    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.DEFAULT_TENANT || null;
    }

    const parts = hostname.split('.');
    if (parts.length < 3) return null;

    const subdomain = parts[0].toLowerCase();
    const NON_TENANT = ['api', 'auth', 'tenants', 'my', 'www', 'agenda'];
    if (NON_TENANT.includes(subdomain)) return null;

    return subdomain;
  }

  /**
   * Estrae orgId dal JWT Keycloak.
   *
   * Formato reale del claim "organization" (Keycloak Organizations):
   *   [ { "demo4": { "id": "d5a0e53a-..." } }, "demo4" ]
   * Dove l'array contiene un oggetto { alias: { id: uuid } } e l'alias come stringa.
   *
   * Supporta anche:
   * - claim custom "org_id" (Protocol Mapper)
   * - claim "organizations" oggetto { orgId: { name, roles } } (formato Keycloak 26+)
   */
  private extractOrgId(payload: Record<string, unknown>): string | null {
    // Priorità 1: claim custom "org_id" (Protocol Mapper semplice)
    if (payload['org_id']) {
      return payload['org_id'] as string;
    }

    // Priorità 2: claim "organization" come array (formato Keycloak Organizations reale)
    // [ { "alias": { "id": "uuid" } }, "alias" ]
    const organization = payload['organization'];
    if (Array.isArray(organization)) {
      // Cerca l'oggetto con { alias: { id } } nell'array
      for (const item of organization) {
        if (item && typeof item === 'object') {
          const keys = Object.keys(item);
          if (keys.length > 0) {
            const orgData = item[keys[0]];
            if (orgData?.id) {
              return orgData.id as string;
            }
          }
        }
      }
      // Fallback: usa la stringa alias dall'array
      for (const item of organization) {
        if (typeof item === 'string') {
          return item;
        }
      }
    }

    // Priorità 3: claim "organizations" oggetto (formato Keycloak 26+ standard)
    const organizations = payload['organizations'] as Record<string, unknown> | undefined;
    if (organizations && typeof organizations === 'object' && !Array.isArray(organizations)) {
      const orgIds = Object.keys(organizations);
      if (orgIds.length > 0) {
        return orgIds[0];
      }
    }

    // Priorità 4: claim "organization" come oggetto singolo con .id
    if (organization && typeof organization === 'object' && !Array.isArray(organization)) {
      const org = organization as Record<string, unknown>;
      if (org.id) {
        return org.id as string;
      }
    }

    return null;
  }

  /**
   * Estrae l'alias dell'organizzazione dal JWT Keycloak.
   * Formato: [ { "demo4": { "id": "uuid" } }, "demo4" ] → "demo4"
   */
  private extractOrgAlias(payload: Record<string, unknown>): string | null {
    const organization = payload['organization'];
    if (Array.isArray(organization)) {
      for (const item of organization) {
        if (typeof item === 'string') return item;
      }
      // Fallback: prima key dell'oggetto
      for (const item of organization) {
        if (item && typeof item === 'object') {
          const keys = Object.keys(item);
          if (keys.length > 0) return keys[0];
        }
      }
    }
    return null;
  }

  /**
   * Estrae i ruoli dal JWT Keycloak.
   * realm_access.roles per i ruoli del realm.
   * resource_access[clientId].roles per i ruoli specifici del client.
   */
  private extractRoles(payload: Record<string, unknown>): string[] {
    const realmRoles = (payload['realm_access'] as any)?.roles as string[] || [];
    const clientRoles = (payload['resource_access'] as any)?.[this.KEYCLOAK_CLIENT_ID]?.roles as string[] || [];
    return [...new Set([...realmRoles, ...clientRoles])];
  }
}
