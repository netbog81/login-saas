import {
  EntitySubscriberInterface,
  EventSubscriber,
  TransactionCommitEvent,
  TransactionRollbackEvent,
  TransactionStartEvent,
} from 'typeorm';
import { Logger } from '@nestjs/common';
import { eventScope, PendingClinicalEvent } from './event-scope';
import { EventOutbox } from './entities/event-outbox.entity';

/**
 * Rende TRANSAZIONALE l'outbox degli eventi, senza toccare un solo
 * chiamante — né quelli di oggi né quelli che verranno.
 *
 * Il problema che risolve: `eventBuffer.add()` accumula in memoria e la riga
 * di outbox nasceva DOPO il commit. In mezzo c'era una finestra in cui il
 * dato di business era salvato ma non esisteva da nessuna parte la traccia
 * che un evento dovesse partire: un crash lì e l'evento spariva per sempre,
 * senza lasciare niente da guardare.
 *
 * Come funziona: TypeORM chiama `beforeTransactionCommit` DENTRO la
 * transazione, e l'hook può essere asincrono. Qui prendiamo gli eventi
 * accumulati nello scope della richiesta e li scriviamo come righe di
 * outbox usando l'EntityManager della transazione. Da quel momento o
 * committano insieme ai dati di business, o spariscono insieme a loro in
 * caso di rollback. Non esiste più uno stato intermedio.
 *
 * Perché è un subscriber e non un helper da chiamare: intercetta QUALUNQUE
 * transazione, comprese quelle che scriverà qualcun altro fra sei mesi
 * senza sapere che questo file esiste. È l'unico modo di coprire anche il
 * codice futuro.
 *
 * Nota sull'implicito: se `add()` viene chiamato FUORI da una transazione
 * questo hook non scatta, e la riga di outbox la scrive il publisher come
 * prima — durevole ma non atomica. Quel caso viene loggato dal publisher,
 * così resta visibile invece di sembrare identico all'altro.
 */
@EventSubscriber()
export class TransactionOutboxSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(TransactionOutboxSubscriber.name);

  /** Espone il manager della transazione allo scope della richiesta. */
  afterTransactionStart(event: TransactionStartEvent): void {
    const store = eventScope.getStore();
    if (store) store.txManager = event.manager;
  }

  /**
   * Eventi persistiti da CIASCUNA transazione, per poterli rimettere in gioco
   * se proprio quella transazione fallisce. Senza questa mappa il rollback di
   * una transazione qualunque rimetterebbe `persisted = false` anche su
   * eventi già scritti (e committati) da un'altra: al commit successivo la
   * INSERT ripartirebbe e sbatterebbe sull'unicità di `eventId`.
   */
  private readonly persistedByTx = new WeakMap<object, PendingClinicalEvent[]>();

  /**
   * Ultimo istante utile prima del commit: qui gli eventi accumulati
   * diventano righe di outbox, nella stessa transazione.
   *
   * Non solleva MAI: l'outbox è una rete di sicurezza e non deve diventare
   * un nuovo modo di far fallire un'operazione clinica. Se la scrittura non
   * riesce, il commit del business prosegue e l'evento ricade sul percorso
   * non transazionale (riga scritta dal publisher dopo il commit), con un
   * errore ben visibile nei log.
   */
  async beforeTransactionCommit(event: TransactionCommitEvent): Promise<void> {
    const store = eventScope.getStore();
    if (!store) return;

    const toPersist = store.events.filter((e) => !e.persisted);
    if (toPersist.length === 0) return;

    const written: PendingClinicalEvent[] = [];
    try {
      const repo = event.manager.getRepository(EventOutbox);
      for (const pending of toPersist) {
        if (!pending.eventId) continue; // difensivo: add() lo assegna sempre
        await repo.insert({
          eventId: pending.eventId,
          eventType: pending.eventType,
          tenantAlias: pending.tenantAlias,
          correlationId: pending.correlationId,
          payload: pending.payload as object,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
        });
        pending.persisted = true;
        written.push(pending);
      }
      if (event.queryRunner) this.persistedByTx.set(event.queryRunner, written);
      this.logger.debug(
        `[OUTBOX] ${written.length} eventi scritti dentro la transazione.`,
      );
    } catch (err) {
      // Rimettiamo in gioco ciò che avevamo marcato: la INSERT fallita ha
      // già invalidato la transazione per quelle righe.
      for (const p of written) p.persisted = false;
      this.logger.error(
        `[OUTBOX] Scrittura in transazione fallita (${(err as Error).message}). `
          + 'Il commit del business prosegue; gli eventi passano dal percorso non '
          + 'transazionale del publisher.',
      );
    }
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    const store = eventScope.getStore();
    if (store) store.txManager = undefined;
    if (event.queryRunner) this.persistedByTx.delete(event.queryRunner);
  }

  /**
   * Rollback: le righe di outbox sono sparite con la transazione, quindi gli
   * eventi in buffer tornano "non persistiti". Il buffer verrà comunque
   * scartato a fine richiesta (il flush avviene solo dopo un commit
   * riuscito), ma se il chiamante ritenta dentro una nuova transazione
   * devono poter essere riscritti.
   */
  afterTransactionRollback(event: TransactionRollbackEvent): void {
    const store = eventScope.getStore();
    if (!store) return;
    store.txManager = undefined;

    // Solo gli eventi scritti da QUESTA transazione tornano "non persistiti":
    // le loro righe sono sparite col rollback. Quelli di altre transazioni
    // già committate restano tali, altrimenti verrebbero riscritti e la
    // seconda INSERT violerebbe l'unicità di `eventId`.
    const written = event.queryRunner ? this.persistedByTx.get(event.queryRunner) : undefined;
    for (const pending of written ?? []) pending.persisted = false;
    if (event.queryRunner) this.persistedByTx.delete(event.queryRunner);
  }
}
