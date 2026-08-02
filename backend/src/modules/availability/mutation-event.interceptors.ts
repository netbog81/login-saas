import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import { CalendarEventType, EventsService } from '../events/events.service';

/**
 * Base: emette un evento SSE (campanello tenant-wide, senza payload) dopo
 * ogni MUTATION GraphQL andata a buon fine dei resolver a cui la variante
 * concreta è applicata con `@UseInterceptors` a livello di classe.
 *
 * Scelta di altitudine (2026-07-29): il modulo availability ha decine di
 * mutation sparse in una dozzina di resolver. Emettere dal singolo call
 * site — come si fa per i trattamenti — significherebbe ~70 edit e il
 * rischio costante di dimenticare le mutation future. L'interceptor a
 * livello di classe copre tutto, incluse le mutation che verranno aggiunte
 * domani. Il costo dell'over-notification è un refetch in più lato client
 * (economico e debounced); il costo dell'under-notification sarebbe una
 * vista stale — asimmetria che giustifica la copertura larga.
 *
 * Filtri:
 *  - solo operation `mutation` (mai query/subscription);
 *  - solo il field root della mutation (`info.path.prev` undefined): i
 *    @ResolveField eseguiti dentro la stessa operation non ri-emettono;
 *  - solo su successo (tap su next, non su error).
 *
 * Il tenant viene risolto da EventsService.emit() via AsyncLocalStorage
 * (le request GraphQL passano dal CurandisTenantContextMiddleware).
 */
@Injectable()
abstract class GqlMutationEventInterceptor implements NestInterceptor {
  protected abstract readonly eventType: CalendarEventType;

  constructor(private readonly eventsService: EventsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const info = GqlExecutionContext.create(context).getInfo();
    const isRootMutation =
      info?.operation?.operation === 'mutation' && !info?.path?.prev;

    if (!isRootMutation) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() =>
        this.eventsService.emit({
          type: this.eventType,
          timestamp: new Date(),
        }),
      ),
    );
  }
}

/**
 * Struttura degli orari cambiata (template, eccezioni, assenze, festività,
 * palestra, stanze, servizi): i client rifanno il fetch di slot e griglie.
 */
@Injectable()
export class AvailabilityChangedInterceptor extends GqlMutationEventInterceptor {
  protected readonly eventType: CalendarEventType = 'availability_changed';
}

/**
 * Appuntamenti creati/modificati/cancellati (incluse varianti palestra e
 * serie ricorrenti): i calendari ricaricano la vista corrente, in entrambe
 * le modalità (operatori e palestra).
 */
@Injectable()
export class AppointmentChangedInterceptor extends GqlMutationEventInterceptor {
  protected readonly eventType: CalendarEventType = 'appointment_changed';
}
