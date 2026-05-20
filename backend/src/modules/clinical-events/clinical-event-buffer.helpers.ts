import { EventEmitter2 } from '@nestjs/event-emitter';

import { ClinicalEventBuffer } from './clinical-event-buffer.service';
import { CLINICAL_PUBLISH_PENDING_EVENT } from './clinical-event.publisher';

/**
 * Helper per il pattern publish-after-commit lato service business.
 *
 * USO TIPICO:
 *   await this.dataSource.transaction(async (tx) => {
 *     // ... business logic
 *     this.eventBuffer.add({ eventType: 'treatment.closed', payload, ... });
 *   });
 *   // ↑ se la tx fa rollback, gli eventi restano nel buffer e vengono
 *   //   droppati alla fine della request (mai pubblicati).
 *   await flushBufferedEvents(this.eventBuffer, this.eventEmitter);
 *   // ↑ chiamato solo se la transaction è ritornata senza throw.
 *
 * Drainato in array, emesso evento-per-evento sul bus EventEmitter2 con
 * routing `CLINICAL_PUBLISH_PENDING_EVENT`. Il `ClinicalEventPublisher`
 * ha un `@OnEvent` listener che fa il publish reale + log
 * `[OUTBOX-MISSING]` su error (vedi `clinical-event.publisher.ts`).
 */
export function flushBufferedEvents(
  buffer: ClinicalEventBuffer,
  emitter: EventEmitter2,
): void {
  const pending = buffer.drain();
  for (const evt of pending) {
    emitter.emit(CLINICAL_PUBLISH_PENDING_EVENT, evt);
  }
}
