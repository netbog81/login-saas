import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context.middleware';
import { TenantSchemaContextService } from '../database/tenant-schema-context.service';

/**
 * Riattiva l'AsyncLocalStorage del tenant attorno all'esecuzione di ogni
 * resolver GraphQL / handler HTTP.
 *
 * Perché serve: il TenantContextMiddleware avvolge `next()` in
 * `tenantSchemaContext.run(...)`, ma Apollo Server risolve il body della
 * query GraphQL in catene async (resolver, @ResolveField, DataLoader) che
 * non sono sempre continuazioni dirette di quel `next()`. Quando la
 * propagazione ALS si spezza, `TenantSchemaContextService.getSchemaName()`
 * ritorna null, il TenantSchemaSubscriber salta il `SET search_path`, e le
 * query TypeORM finiscono sullo schema `public` invece che sullo schema del
 * tenant → lookup falliti (es. AppUser non trovato per keycloakId).
 *
 * Questo interceptor ristabilisce il contesto leggendolo da
 * `req.tenantContext`, che il middleware ha già popolato in modo sincrono
 * sulla request Express. La request è la fonte affidabile: sopravvive alla
 * frammentazione async di Apollo.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    private readonly tenantSchemaContext: TenantSchemaContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = this.extractRequest(context);
    const tenantContext = req?.tenantContext as TenantContext | undefined;

    if (!tenantContext?.schemaName || tenantContext.schemaName === 'pending') {
      return next.handle();
    }

    // Riattiva l'ALS per tutta la durata dell'handler/resolver. Se l'ALS
    // era già attivo (handler HTTP non-GraphQL), questo run() annidato è
    // innocuo: imposta lo stesso schema.
    return new Observable((subscriber) => {
      this.tenantSchemaContext.run(
        {
          schemaName: tenantContext.schemaName,
          tenantId: tenantContext.tenantId,
          tenantAlias: tenantContext.orgAlias,
          userId: tenantContext.userId,
          requestId: tenantContext.requestId,
        },
        () => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        },
      );
    });
  }

  /**
   * Estrae la request Express sia da contesti HTTP che GraphQL.
   */
  private extractRequest(context: ExecutionContext): any {
    if (context.getType<string>() === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context);
      return gqlCtx.getContext()?.req;
    }
    return context.switchToHttp().getRequest();
  }
}
