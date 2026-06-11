import { CurandisTenantContext } from '@curandis/auth-core';
import { RegistryRequestContext } from '../registry.types';

/**
 * Costruisce il contesto richiesto dal RegistryClient a partire dal
 * CurandisTenantContext popolato dal CurandisTenantContextMiddleware.
 *
 * `tenantAlias` (es. "bdq") è quello che il registry si aspetta come
 * X-Tenant-Alias. `rawToken` viene passato esplicitamente (estratto da
 * req.headers.authorization in `buildGraphqlContext`).
 */
export function buildRegistryCtx(
  user: CurandisTenantContext,
  rawToken: string,
): RegistryRequestContext {
  return {
    rawToken,
    tenantAlias: user.tenantAlias,
    // orgId può essere null (service-account senza keycloak_org_id nel KV);
    // il RegistryClient omette l'header X-Org-Id quando è null e il registry
    // risolve via X-Tenant-Alias.
    orgId: user.orgId,
    requestId: user.requestId,
  };
}
