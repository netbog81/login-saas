import { CurrentUserContext } from '../../users/decorators/current-user.decorator';
import { RegistryRequestContext } from '../registry.types';

/**
 * Costruisce il contesto richiesto dal RegistryClient a partire dal
 * CurrentUserContext popolato dal TenantContextMiddleware.
 *
 * La preferenza è orgAlias (es. "bdq") perché il registry usa il
 * subdomain del tenant come X-Tenant-Alias.
 */
export function buildRegistryCtx(user: CurrentUserContext): RegistryRequestContext {
  return {
    rawToken: user.rawToken,
    tenantAlias: user.orgAlias,
    // orgId può essere null (service-account); il RegistryClient omette
    // l'header X-Org-Id quando è null e il registry risolve via X-Tenant-Alias.
    orgId: user.orgId,
    requestId: user.requestId,
  };
}
