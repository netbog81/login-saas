import { Request } from 'express';

import { TenantContext } from '../../../middleware/tenant-context.middleware';
import { RegistryClient } from '../registry.client';
import { createSubjectLoader, RegistrySubjectLoader } from '../registry-subject.loader';
import { buildRegistryCtx } from './build-registry-context';

/**
 * Forma del context GraphQL del clinico.
 * - req: usato per estrarre il tenantContext nei decorator @CurrentUser/@SubjectLoader
 * - loaders: DataLoader per-request, presenti solo se la request è autenticata
 */
export interface GraphqlContext {
  req: Request;
  loaders?: {
    subject: RegistrySubjectLoader;
  };
}

/**
 * Factory invocata da GraphQLModule.forRoot.context: costruisce il context
 * Apollo a partire dalla request Express. Il tenantContext è già stato
 * popolato dal TenantContextMiddleware (eccetto sui path esclusi).
 */
export function buildGraphqlContext(
  req: Request,
  registryClient: RegistryClient,
): GraphqlContext {
  const tenantContext = (req as Request & { tenantContext?: TenantContext }).tenantContext;
  if (!tenantContext) {
    return { req };
  }

  const userCtx = {
    userId: tenantContext.userId,
    email: tenantContext.email,
    name: tenantContext.name,
    roles: tenantContext.roles,
    tenantId: tenantContext.tenantId,
    orgId: tenantContext.orgId,
    orgAlias: tenantContext.orgAlias,
    schemaName: tenantContext.schemaName,
    requestId: tenantContext.requestId,
    rawToken: tenantContext.rawToken,
    actorType: tenantContext.actorType,
    isServiceAccount: tenantContext.isServiceAccount,
  };

  const registryCtx = buildRegistryCtx(userCtx);

  return {
    req,
    loaders: {
      subject: createSubjectLoader(registryClient, registryCtx),
    },
  };
}
