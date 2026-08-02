import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CurandisTenantContext } from '@curandis/auth-core';

/**
 * Estensione locale di CurandisTenantContext con `rawToken`.
 *
 * `auth-core` non espone il JWT raw nel suo tenantContext per ridurre
 * la superficie di leak. Il clinico però ne ha bisogno per forwardare
 * il token Bearer al registry come `Authorization: Bearer <token>`.
 *
 * Soluzione: in `buildGraphqlContext` estraiamo il rawToken dall'header
 * Authorization e lo iniettiamo sul `req.tenantContext` come campo
 * runtime. Questo tipo lo dichiara così che TS sappia che è disponibile
 * quando si usa `@CurrentUser()`.
 *
 * NOTA: `userId` è il `sub` del JWT Keycloak (user) o il `client_id`
 * (service-account). NON è l'id di AppUser. Per risolvere AppUser →
 * Operator usa `AppUserService.findByKeycloakId()`.
 */
export interface CurrentUserContext extends CurandisTenantContext {
  /** JWT raw estratto da Authorization header in buildGraphqlContext. */
  rawToken: string;
}
export type ActorType = CurandisTenantContext['actorType'];

/**
 * Estrae il contesto utente corrente (popolato dal CurandisTenantContextMiddleware
 * di @curandis/auth-core + esteso con rawToken in buildGraphqlContext) dal
 * request GraphQL.
 *
 *   @Mutation()
 *   doThing(@CurrentUser() user: CurrentUserContext) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserContext => {
    // Supporta sia resolver GraphQL sia controller REST
    const req =
      context.getType<'http' | 'graphql'>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();
    return req?.tenantContext as CurrentUserContext;
  },
);
