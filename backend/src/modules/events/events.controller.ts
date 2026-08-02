import { Controller, Logger, Sse, MessageEvent } from '@nestjs/common';
import { Observable, map, interval, merge } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TenantCtx, CurandisTenantContext } from '@curandis/auth-core';
import { EventsService } from './events.service';

/**
 * Controller per Server-Sent Events (SSE)
 * Permette al frontend di ricevere notifiche real-time.
 *
 * Autenticato (2026-07-28): la rotta passa dal CurandisTenantContextMiddleware
 * come tutte le altre (niente più esclusione in app.module). Il client deve
 * mandare Authorization: Bearer — per questo il frontend usa un client SSE
 * fetch-based e non l'EventSource nativo. Ogni connessione riceve SOLO gli
 * eventi del proprio tenant (+ quelli mirati al proprio utente).
 */
@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private eventsService: EventsService) {}

  /**
   * Endpoint SSE unificato: eventi calendario + task message + heartbeat.
   * Il client si connette a GET /events/stream e riceve eventi in streaming.
   */
  @Sse('stream')
  stream(@TenantCtx() ctx: CurandisTenantContext): Observable<MessageEvent> {
    return this.buildStream(ctx);
  }

  /**
   * Alias storico di /events/stream (il frontend pre-2026-07-28 puntava qui).
   * Stesso stream, stessa auth.
   */
  @Sse('appointments')
  appointmentEvents(@TenantCtx() ctx: CurandisTenantContext): Observable<MessageEvent> {
    return this.buildStream(ctx);
  }

  private buildStream(ctx: CurandisTenantContext): Observable<MessageEvent> {
    this.logger.log(
      `SSE connesso: tenant="${ctx.tenantAlias}" user="${ctx.userId}" (${ctx.actorType})`,
    );

    // Heartbeat ogni 30 secondi per mantenere la connessione attiva
    // (Cloudflare/proxy chiudono le connessioni idle).
    const heartbeat$ = interval(30000).pipe(
      map(() => ({
        data: JSON.stringify({ type: 'heartbeat', timestamp: new Date() }),
      })),
    );

    // Eventi reali, filtrati per tenant/utente del JWT.
    const events$ = this.eventsService
      .getEventsFor(ctx.tenantAlias, ctx.userId)
      .pipe(map((event) => ({ data: JSON.stringify(event) })));

    return merge(heartbeat$, events$).pipe(
      // Nest fa unsubscribe alla chiusura della response: qui logghiamo
      // il disconnect per avere visibilità sulle connessioni attive.
      finalize(() =>
        this.logger.log(`SSE disconnesso: tenant="${ctx.tenantAlias}" user="${ctx.userId}"`),
      ),
    );
  }
}
