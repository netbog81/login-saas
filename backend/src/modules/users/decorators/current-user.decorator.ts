import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Shape del contesto utente popolato da TenantContextMiddleware.
 * Esposto ai resolver tramite il decorator @CurrentUser().
 *
 * NOTA: `userId` è il `sub` del JWT Keycloak, NON l'id di AppUser.
 * Per risolvere AppUser → Operator vai via `AppUserService.findByKeycloakId()`.
 */
export type ActorType = 'user' | 'service';

export interface CurrentUserContext {
  /**
   * Identificativo del caller. Per user è il `sub` Keycloak (UUID); per
   * service-account è il `client_id` (es. "curandis-clinico-service").
   */
  userId: string;
  email: string;
  name: string;
  roles: string[];      // realm_access + resource_access (Keycloak)
  tenantId: string;
  /**
   * UUID organizzazione Keycloak. `null` per service-account o se il claim
   * `org_id` non è presente nel JWT user (in tal caso il middleware
   * rifiuta la request prima ancora di arrivare al resolver).
   */
  orgId: string | null;
  orgAlias: string;     // alias tenant (es. "bdq") usato come X-Tenant-Alias verso il registry
  schemaName: string;
  requestId: string;
  rawToken: string;     // JWT originale, forwardato al registry come Authorization Bearer
  /** Tipo di caller (user vs service-account). */
  actorType: ActorType;
  /** Shorthand per `actorType === 'service'`. */
  isServiceAccount: boolean;
}

/**
 * Estrae il contesto utente corrente (popolato dal TenantContextMiddleware)
 * dal request GraphQL.
 *
 *   @Mutation()
 *   doThing(@CurrentUser() user: CurrentUserContext) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserContext => {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;
    return req?.tenantContext as CurrentUserContext;
  },
);
