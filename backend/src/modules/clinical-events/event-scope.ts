import { AsyncLocalStorage } from 'async_hooks';
import { ClinicalOutboundEventType } from './clinical-events.types';

/**
 * Evento in attesa di publish post-commit.
 *
 * `eventId` viene assegnato già in `add()` (non più al momento del publish):
 * serve al subscriber per scrivere la riga di outbox DENTRO la transazione,
 * con lo stesso id che poi finirà nell'envelope AMQP.
 */
export interface PendingClinicalEvent {
  eventType: ClinicalOutboundEventType;
  payload: unknown;
  tenantAlias: string;
  correlationId?: string;
  eventId?: string;
  /**
   * True quando la riga di outbox è già stata scritta dentro la transazione
   * (dal subscriber). Il publisher allora non la riscrive: gli resta solo da
   * pubblicare e marcare `sent`.
   */
  persisted?: boolean;
}

export interface EventScopeStore {
  events: PendingClinicalEvent[];
  /**
   * EntityManager della transazione attualmente aperta in questa catena
   * async, messo qui dal `TransactionOutboxSubscriber`. È il perno del
   * meccanismo: permette di scrivere l'outbox dentro la transazione senza
   * che il codice di business debba passare nulla.
   */
  txManager?: unknown;
}

/**
 * Scope per-richiesta condiviso fra il buffer degli eventi e il subscriber
 * TypeORM.
 *
 * Vive qui, in un modulo neutro, invece che dentro `ClinicalEventBuffer`,
 * perché il subscriber è istanziato da TypeORM e non da Nest: non può
 * ricevere il service via dependency injection, ma può importare questa
 * costante.
 */
export const eventScope = new AsyncLocalStorage<EventScopeStore>();
