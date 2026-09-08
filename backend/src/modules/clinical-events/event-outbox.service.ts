import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual } from 'typeorm';
import {
  TenantContextService,
  TenantDataSourceManager,
} from '@curandis/tenant-datasource';
import { EventOutbox } from './entities/event-outbox.entity';
import { PendingClinicalEvent } from './clinical-event-buffer.service';

/** Quanti tentativi prima di dichiarare l'evento non recapitabile. */
const MAX_ATTEMPTS = 12;
/** Quante righe per tenant per giro, per non monopolizzare il worker. */
const BATCH_SIZE = 50;
/** Per quanti giorni si tengono le righe già spedite (audit + diagnosi). */
const SENT_RETENTION_DAYS = 7;

/**
 * Outbox degli eventi in uscita: garantisce che un evento sopravviva a un
 * broker irraggiungibile e a un riavvio del backend.
 *
 * Flusso:
 *  1. `enqueue()` scrive la riga `pending` (subito dopo il commit di
 *     business, quando il buffer publish-after-commit fa il flush);
 *  2. il chiamante tenta subito il publish e chiama `markSent()` o
 *     `markFailed()`;
 *  3. `retryPending()` (cron ogni minuto, su tutti i tenant) riprende le
 *     righe rimaste indietro con backoff crescente.
 *
 * Il backoff è esponenziale con tetto a 30 minuti: un broker giù mezza
 * giornata non viene martellato, e quando torna gli eventi ripartono da soli
 * senza che nessuno debba accorgersene.
 */
@Injectable()
export class EventOutboxService {
  private readonly logger = new Logger(EventOutboxService.name);

  /**
   * Iniettato pigramente per evitare la dipendenza circolare con il
   * publisher, che a sua volta usa questo service.
   */
  private deliver?: (row: EventOutbox) => Promise<void>;

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
  ) {}

  /**
   * Il publisher registra qui la propria funzione di consegna. Senza, il
   * worker non ha modo di pubblicare e si limita a non fare nulla.
   */
  registerDeliveryHandler(handler: (row: EventOutbox) => Promise<void>): void {
    this.deliver = handler;
  }

  /** Scrive l'evento in outbox. Idempotente sull'`eventId`. */
  async enqueue(eventId: string, event: PendingClinicalEvent): Promise<EventOutbox | null> {
    const ds = this.tenantContext.getDataSource();
    if (!ds) {
      // Nessun contesto tenant: non c'è tabella dove scrivere. Meglio dirlo
      // forte che perdere l'evento in silenzio.
      this.logger.error(
        `[OUTBOX] Nessun DataSource tenant: evento ${event.eventType} (${eventId}) NON persistito.`,
      );
      return null;
    }
    const repo = ds.getRepository(EventOutbox);
    try {
      return await repo.save(
        repo.create({
          eventId,
          eventType: event.eventType,
          tenantAlias: event.tenantAlias,
          correlationId: event.correlationId,
          payload: event.payload,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
        }),
      );
    } catch (err) {
      // Violazione di unicità = evento già in outbox (retry di un flush):
      // va benissimo, non è un errore.
      this.logger.warn(
        `[OUTBOX] Evento ${eventId} già presente o non scrivibile: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Ritrova la riga scritta dal subscriber dentro la transazione, per poterla
   * marcare `sent` dopo la pubblicazione.
   */
  async findByEventId(eventId: string): Promise<EventOutbox | null> {
    const ds = this.tenantContext.getDataSource();
    if (!ds) return null;
    return ds.getRepository(EventOutbox).findOne({ where: { eventId } });
  }

  async markSent(ds: DataSource, id: string): Promise<void> {
    await ds.getRepository(EventOutbox).update(id, {
      status: 'sent',
      sentAt: new Date(),
      lastError: undefined,
    });
  }

  /**
   * Registra il fallimento e programma il prossimo tentativo. Oltre
   * `MAX_ATTEMPTS` la riga passa a `failed`: non viene più ritentata da
   * sola, ed è quello che il monitor deve mostrare come "richiede
   * intervento".
   */
  async markFailed(ds: DataSource, row: EventOutbox, error: string): Promise<void> {
    const attempts = row.attempts + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    await ds.getRepository(EventOutbox).update(row.id, {
      status: exhausted ? 'failed' : 'pending',
      attempts,
      lastError: error.slice(0, 2000),
      nextAttemptAt: new Date(Date.now() + this.backoffMs(attempts)),
    });
    if (exhausted) {
      this.logger.error(
        `[OUTBOX] Evento ${row.eventType} (${row.eventId}, tenant=${row.tenantAlias}) `
          + `non recapitato dopo ${attempts} tentativi: richiede intervento. Ultimo errore: ${error}`,
      );
    }
  }

  /** Backoff esponenziale 30s → 30min, con tetto. */
  private backoffMs(attempts: number): number {
    return Math.min(30_000 * 2 ** (attempts - 1), 30 * 60_000);
  }

  /**
   * Cron: riprende gli eventi rimasti indietro su tutti i tenant noti.
   * Ogni minuto — abbastanza fitto da non far accumulare ritardo quando il
   * broker torna, abbastanza rado da non pesare quando non c'è nulla.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'eventOutboxRetry' })
  async retryPending(): Promise<void> {
    if (!this.deliver) return;

    let aliases: string[];
    try {
      aliases = await this.tenantDsManager.listKnownTenantAliases();
    } catch (err) {
      this.logger.error(`[OUTBOX] Impossibile elencare i tenant: ${(err as Error).message}`);
      return;
    }

    for (const alias of aliases) {
      try {
        await this.retryTenant(alias);
      } catch (err) {
        this.logger.error(`[OUTBOX] Errore sul tenant "${alias}": ${(err as Error).message}`);
      }
    }
  }

  private async retryTenant(tenantAlias: string): Promise<void> {
    const ds = await this.tenantDsManager.getDataSource(tenantAlias);
    const repo = ds.getRepository(EventOutbox);

    const due = await repo.find({
      where: { status: 'pending', nextAttemptAt: LessThanOrEqual(new Date()) },
      order: { nextAttemptAt: 'ASC' },
      take: BATCH_SIZE,
    });
    if (due.length === 0) {
      await this.purgeSent(ds);
      return;
    }

    this.logger.log(`[OUTBOX] ${tenantAlias}: ${due.length} eventi da recapitare.`);
    let delivered = 0;
    for (const row of due) {
      try {
        await this.deliver!(row);
        await this.markSent(ds, row.id);
        delivered += 1;
      } catch (err) {
        await this.markFailed(ds, row, (err as Error).message);
        // Se il broker è giù fallisce tutto: inutile insistere sul resto
        // del lotto, ci si riprova al giro dopo.
        break;
      }
    }
    if (delivered > 0) {
      this.logger.log(`[OUTBOX] ${tenantAlias}: ${delivered} eventi recapitati in ritardo.`);
    }
    await this.purgeSent(ds);
  }

  /** Le righe già spedite servono solo a capire cos'è successo: si buttano dopo una settimana. */
  private async purgeSent(ds: DataSource): Promise<void> {
    const cutoff = new Date(Date.now() - SENT_RETENTION_DAYS * 24 * 60 * 60_000);
    await ds
      .getRepository(EventOutbox)
      .createQueryBuilder()
      .delete()
      .where('status = :status', { status: 'sent' })
      .andWhere('"sentAt" < :cutoff', { cutoff })
      .execute();
  }

  /**
   * Conteggi per il monitor: quanti eventi sono in ritardo e quanti hanno
   * esaurito i tentativi. Letto dal `DlqMonitorService`, che li affianca
   * alle code del broker.
   */
  async countStuck(tenantAlias: string): Promise<{ pending: number; failed: number }> {
    const ds = await this.tenantDsManager.getDataSource(tenantAlias);
    const repo = ds.getRepository(EventOutbox);
    const [pending, failed] = await Promise.all([
      repo.count({ where: { status: 'pending' } }),
      repo.count({ where: { status: 'failed' } }),
    ]);
    return { pending, failed };
  }
}
