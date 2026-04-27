import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Shape del contesto utente popolato da TenantContextMiddleware.
 * Esposto ai resolver tramite il decorator @CurrentUser().
 *
 * NOTA: `userId` è il `sub` del JWT Keycloak, NON l'id di AppUser.
 * Per risolvere AppUser → Operator vai via `AppUserService.findByKeycloakId()`.
 */
export interface CurrentUserContext {
  userId: string;       // Keycloak sub
  email: string;
  name: string;
  roles: string[];      // realm_access + resource_access (Keycloak)
  tenantId: string;
  orgId: string;
  schemaName: string;
  requestId: string;
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
