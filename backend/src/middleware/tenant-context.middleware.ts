import { Injectable, NestMiddleware, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { JwksService } from '../auth/jwks.service';
import { TenantSchemaService } from '../database/tenant-schema.service';
import { TenantSchemaContextService } from '../database/tenant-schema-context.service';
import { TenantAuditService } from '../database/tenant-audit.service';
import { TenantOpenbaoResolverService } from '../database/tenant-openbao-resolver.service';

export type ActorType = 'user' | 'service';

export interface TenantContext {
  /**
   * Identificativo del caller. Per user è l'UUID Keycloak (`sub`); per
   * service-account è il `client_id` (es. `curandis-clinico-service`).
   */
  userId: string;
  email: string;
  name: string;
  roles: string[];
  tenantId: string;
  /**
   * UUID organizzazione Keycloak. `null` per service-account o se non
   * presente nel JWT user. Allineato col contratto auth-core.
   */
  orgId: string | null;
  orgAlias: string;     // alias del tenant, usato come X-Tenant-Alias verso il registry
  schemaName: string;
  tenantStatus: string;  // active | pending_schema | suspended | deleted
  requestId: string;
  rawToken: string;     // JWT originale Bearer, da forwardare al registry
  /** Tipo di caller (user vs service-account). */
  actorType: ActorType;
  /** Shorthand per `actorType === 'service'`. */
  isServiceAccount: boolean;
  toJSON?(): unknown;   // redatta rawToken nei log
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

/**
 * Whitelist dei client Keycloak riconosciuti come service-account legittimi.
 * Tipicamente quelli che fanno chiamate S2S verso il clinico (es. cron job
 * esterni, eventuale futuro modulo che chiama il clinico).
 *
 * NOTA: il clinico stesso usa `curandis-clinico-service` per chiamare il
 * registry, ma quel client NON appare nei JWT in entrata sul clinico
 * (sono in uscita). Quindi questa whitelist è per S2S diretti verso ME.
 * Per ora vuota: se in futuro accounting o altri moduli ci chiamano S2S,
 * aggiungere qui i loro client_id.
 */
const SERVICE_ACCOUNT_CLIENT_IDS: ReadonlySet<string> = new Set<string>([
  // Esempio: 'curandis-accounting-service'
]);

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
      const sub = payload['sub'] as string;
      const azp = (payload['azp'] as string) || '';
      const requestId = randomUUID();

      // 3a. Distingui user vs service-account.
      // I service-account hanno `azp` nella whitelist e di solito niente
      // `email` né `organization` claim. I JWT user hanno `azp` = client
      // del frontend (es. "curandis-app-angular").
      const isServiceAccount = !!azp && SERVICE_ACCOUNT_CLIENT_IDS.has(azp);
      const actorType: ActorType = isServiceAccount ? 'service' : 'user';

      // Per service-account: identificativo = client_id (azp); per user: sub.
      const userId = isServiceAccount ? azp : sub;
      const email = isServiceAccount ? '' : ((payload['email'] as string) || '');
      const name = isServiceAccount
        ? azp
        : ((payload['name'] as string) || (payload['preferred_username'] as string) || '');

      // 3b. Tenant target: header X-Tenant-Alias o subdomain.
      const requestedTenant =
        (req.headers['x-tenant-alias'] as string) || this.extractTenantFromHost(req);

      // 3c. Org claim dal JWT (solo per user; service-account non ce l'ha).
      const tokenOrgId = isServiceAccount ? null : this.extractOrgId(payload);
      const tokenOrgAlias = isServiceAccount ? null : this.extractOrgAlias(payload);

      // 3d. Risoluzione tenantAlias e orgId: regole diverse per user vs service.
      let orgAlias: string | null;
      let orgId: string | null;

      if (isServiceAccount) {
        // Service-account: DEVE specificare il tenant via header/subdomain.
        // Niente fallback su claim del JWT (non c'è).
        if (!requestedTenant) {
          this.logger.warn(
            `Service-account "${azp}" senza X-Tenant-Alias o subdomain valido`,
          );
          throw new ForbiddenException(
            'Service-account deve specificare il tenant via subdomain o header X-Tenant-Alias',
          );
        }
        orgAlias = requestedTenant;
        orgId = null; // service-account non agisce per conto di una specifica organization
      } else {
        // User: priorità subdomain → claim. Niente fallback su orgId come alias
        // (era un bug di sicurezza: mascherava token mal configurati).
        orgAlias = requestedTenant || tokenOrgAlias;
        orgId = tokenOrgId; // se manca → null, e sotto throw

        if (!orgAlias) {
          this.logger.warn(`Nessun tenant determinabile per userId="${userId}"`);
          throw new ForbiddenException('Missing tenant context');
        }

        // Coerenza tenant: se c'è un subdomain E un'org nel token, devono corrispondere
        if (requestedTenant && tokenOrgAlias && requestedTenant !== tokenOrgAlias) {
          this.logger.warn(
            `Tenant mismatch: utente org="${tokenOrgAlias}" su subdomain="${requestedTenant}" (userId="${userId}")`,
          );
          throw new ForbiddenException(
            `Accesso negato: l'utente appartiene a "${tokenOrgAlias}", non a "${requestedTenant}"`,
          );
        }

        // Niente più fallback orgId = orgAlias: se il claim manca, è un bug
        // di config Keycloak che vogliamo vedere esplicitamente.
        if (!orgId) {
          this.logger.warn(
            `User token senza claim 'organization'/'org_id' (userId="${userId}", tenant="${orgAlias}"). ` +
              `Configurare il mapper Keycloak.`,
          );
          throw new ForbiddenException(
            'Missing org_id claim in user token: configurare il mapper Keycloak',
          );
        }
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

      // 7. Popola tenantContext nella request.
      // Per service-account: orgId = null. Per il legacy `tenantId` mantengo
      // un valore non-null (orgId reale per user, orgAlias come fallback per
      // service-account) per non rompere downstream che si aspettano string.
      const tenantContext: TenantContext = {
        userId,
        email,
        name,
        roles,
        tenantId: orgId ?? orgAlias,
        orgId,
        orgAlias,
        schemaName,
        tenantStatus,
        requestId,
        rawToken: token,
        actorType,
        isServiceAccount,
        toJSON() {
          return { ...this, rawToken: '[REDACTED]', toJSON: undefined };
        },
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
            { schemaName, tenantId: orgId ?? orgAlias, tenantAlias: orgAlias, userId, requestId },
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
