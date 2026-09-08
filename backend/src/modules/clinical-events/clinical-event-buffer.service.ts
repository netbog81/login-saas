import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { eventScope, PendingClinicalEvent } from './event-scope';

export { PendingClinicalEvent } from './event-scope';

/**
 * Buffer per il pattern publish-after-commit lato clinico.
 *
 * USO:
 *   1. Entry-point (HTTP middleware, smoke script, consumer) chiama:
 *        await buffer.runInScope(() => doWorkThatMayCallAdd());
 *      Senza `runInScope`, gli `add()` esplodono (non silently — meglio
 *      rumoroso al boot che silenzioso in produzione).
 *
 *   2. Service business (es. TreatmentService) dentro la transazione:
 *        await this.dataSource.transaction(async (tx) => {
 *          ... // save treatment
 *          this.eventBuffer.add({ eventType: 'treatment.closed', payload, ... });
 *        });
 *      // SOLO dopo il return della transaction (= commit OK):
 *        await this.eventBuffer.flush();
 *
 *   3. `flush()` emette un `'clinical.publish-pending'` per ogni evento
 *      sul bus EventEmitter2; il `ClinicalEventPublisher` ha un
 *      `@OnEvent('clinical.publish-pending')` che invoca `publish()` reale.
 *
 * SCOPE: AsyncLocalStorage (consistente con `TenantContextService` di tenant-datasource).
 * Niente request-scoped DI di NestJS che forzerebbe tutto il chain a essere
 * request-scoped.
 *
 * THREAD-SAFETY: ALS isola lo store per ogni catena async; richieste
 * concorrenti non interferiscono.
 */
@Injectable()
export class ClinicalEventBuffer {
  private readonly logger = new Logger(ClinicalEventBuffer.name);
  /**
   * Scope condiviso col `TransactionOutboxSubscriber`: sta in `event-scope.ts`
   * perché il subscriber è istanziato da TypeORM e non può ricevere questo
   * service via DI.
   */
  private readonly storage = eventScope;

  /**
   * Inizializza un nuovo buffer per la durata di `fn`. Ogni entry-point
   * non-HTTP (smoke script, consumer accounting → clinico, cron) DEVE
   * wrappare il proprio handler con questo metodo, altrimenti `add()`
   * fallisce. Per HTTP è chiamato dal middleware
   * `ClinicalEventBufferMiddleware` (vedi clinical-events.module).
   */
  runInScope<T>(fn: () => Promise<T>): Promise<T> {
    return this.storage.run({ events: [] }, fn);
  }

  /**
   * Inserisce un evento nel buffer della request corrente.
   *
   * @throws Error se chiamato fuori da un contesto `runInScope` attivo.
   *   (Difensivo per design: se uno script/cron dimentica di wrappare,
   *   gli `add()` non devono scomparire silenziosamente — il bug deve
   *   esplodere subito al primo invio.)
   */
  add(event: PendingClinicalEvent): void {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error(
        `ClinicalEventBuffer.add() chiamato fuori da runInScope(). ` +
          `Wrappare l'entry-point (HTTP middleware / script / consumer) con ` +
          `eventBuffer.runInScope(() => ...). Evento droppato: ${event.eventType}`,
      );
    }
    // L'eventId si assegna QUI e non al publish: il subscriber lo usa per
    // scrivere la riga di outbox dentro la transazione, e deve coincidere
    // con quello che finirà nell'envelope AMQP (è la chiave di idempotenza
    // del consumer).
    if (!event.eventId) event.eventId = randomUUID();
    store.events.push(event);
  }

  /**
   * Estrae tutti gli eventi accumulati e svuota il buffer. Da chiamare
   * SOLO dopo che la transazione DB ha committato. Ritorna gli eventi al
   * caller che li passerà all'emitter (separato per evitare dipendenza
   * circolare con EventEmitter2 + più testabile).
   *
   * Idempotente: chiamarlo due volte la seconda restituisce array vuoto.
   * Chiamarlo fuori da runInScope ritorna array vuoto + warn (NON throw:
   * il flush è sempre safe-to-call, l'errore semantico è add senza scope,
   * non flush senza eventi).
   */
  drain(): PendingClinicalEvent[] {
    const store = this.storage.getStore();
    if (!store) {
      this.logger.warn(
        `ClinicalEventBuffer.drain() chiamato fuori da runInScope(). ` +
          `Niente da flushare. Probabilmente bug nel chiamante.`,
      );
      return [];
    }
    return store.events.splice(0);
  }

  /**
   * Conta degli eventi pending (utile per test e debug).
   */
  size(): number {
    return this.storage.getStore()?.events.length ?? 0;
  }
}
