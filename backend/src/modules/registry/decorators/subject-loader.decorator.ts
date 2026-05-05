import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { RegistrySubjectLoader } from '../registry-subject.loader';

/**
 * Estrae il DataLoader del subject dal context GraphQL.
 *
 *   @ResolveField('subject', () => RegistrySubject)
 *   resolveSubject(@Parent() x, @SubjectLoader() loader: RegistrySubjectLoader) {
 *     return loader.load(x.subjectId);
 *   }
 *
 * Il loader è costruito una volta per request nel GraphQL context factory.
 * Se il context non ha un loader (es. utente senza tenant), throwa: in resolver
 * non si dovrebbe arrivare a chiedere subject senza essere autenticati.
 */
export const SubjectLoader = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RegistrySubjectLoader => {
    const ctx = GqlExecutionContext.create(context);
    const gqlCtx = ctx.getContext();
    const loader = gqlCtx?.loaders?.subject;
    if (!loader) {
      throw new Error(
        'SubjectLoader non disponibile: GraphQL context senza loaders (tenantContext mancante?)',
      );
    }
    return loader as RegistrySubjectLoader;
  },
);
