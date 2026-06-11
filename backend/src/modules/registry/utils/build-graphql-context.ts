import { Request } from 'express';
import { CurandisTenantContext } from '@curandis/auth-core';

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
 * Estrae il JWT raw dall'header Authorization. Restituisce '' se mancante.
 * Forma attesa: "Bearer <token>".
 */
function extractRawToken(req: Request): string {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

/**
 * Factory invocata da GraphQLModule.forRoot.context: costruisce il context
 * Apollo a partire dalla request Express. Il tenantContext è già stato
 * popolato dal CurandisTenantContextMiddleware (eccetto sui path esclusi).
 */
export function buildGraphqlContext(
  req: Request,
  registryClient: RegistryClient,
): GraphqlContext {
  const tenantContext = (req as Request & { tenantContext?: CurandisTenantContext & { rawToken?: string } }).tenantContext;
  if (!tenantContext) {
    return { req };
  }

  // Inietta il rawToken sul contesto runtime così i resolver che usano
  // @CurrentUser() lo trovano già pronto (vedi CurrentUserContext).
  const rawToken = extractRawToken(req);
  tenantContext.rawToken = rawToken;

  const registryCtx = buildRegistryCtx(tenantContext, rawToken);

  return {
    req,
    loaders: {
      subject: createSubjectLoader(registryClient, registryCtx),
    },
  };
}
