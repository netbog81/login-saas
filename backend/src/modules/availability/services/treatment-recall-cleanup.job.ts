import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Treatment } from '../entities/treatment.entity';

/**
 * Sessione 7 — Server-side cleanup dei recall "stuck".
 *
 * Quando un operatore clinico clicca "Richiama indietro", il service
 * `requestTreatmentRecall` salva `recallRequestId` + `recallRequestedAt` e
 * pubblica `treatment.recall-requested` su accounting. Accounting risponde
 * tipicamente entro 1-2 secondi con `billable.recall-accepted/rejected`,
 * il cui handler azzera `recallRequestId`/`recallRequestedAt`.
 *
 * Se per qualunque motivo la risposta non arriva (broker giù, consumer
 * accounting fermo, message in DLQ, ecc.) il treatment resta con un recall
 * "in volo" indefinitamente, bloccando ulteriori tentativi (la mutation
 * `requestTreatmentRecall` rifiuta con 409 se `recallRequestId IS NOT NULL`).
 *
 * Questo job ogni 5 minuti azzera `recallRequestId`/`recallRequestedAt`
 * per i treatment con `recallRequestedAt < NOW - RECALL_TIMEOUT_MINUTES`,
 * sbloccando il caso. UI client-side ha già un timeout simile per il
 * feedback immediato (spinner che si chiude); questo è il backstop server.
 *
 * NOTA: stesso scope multi-tenant di `recycle-bin-cleanup.job` e
 * `auto-attendance.service` — opera sullo schema PostgreSQL di default.
 * Quando ci saranno più tenant attivi simultanei, andrà esteso iterando
 * sugli schemi (todo cross-cutting non ancora centralizzato).
 */
@Injectable()
export class TreatmentRecallCleanupJob {
  private readonly logger = new Logger(TreatmentRecallCleanupJob.name);

  /** Timeout dopo il quale un recall "in volo" è considerato perso. */
  private static readonly RECALL_TIMEOUT_MINUTES = 5;

  constructor(
    @InjectRepository(Treatment)
    private readonly treatmentRepo: Repository<Treatment>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'treatmentRecallCleanup' })
  async handleCleanup(): Promise<void> {
    const threshold = new Date(
      Date.now() - TreatmentRecallCleanupJob.RECALL_TIMEOUT_MINUTES * 60 * 1000,
    );

    try {
      const stuck = await this.treatmentRepo.find({
        where: {
          recallRequestedAt: LessThan(threshold),
        },
        select: ['id', 'recallRequestId', 'recallRequestedAt'],
      });

      if (stuck.length === 0) return;

      for (const t of stuck) {
        this.logger.warn(
          `Recall stuck per treatment ${t.id} (requestId=${t.recallRequestId}, ` +
            `requestedAt=${t.recallRequestedAt?.toISOString()}). Azzero per consentire retry.`,
        );
        t.recallRequestId = undefined;
        t.recallRequestedAt = undefined;
        await this.treatmentRepo.save(t);
      }

      this.logger.log(
        `TreatmentRecallCleanup: ${stuck.length} recall stuck azzerati (timeout ` +
          `${TreatmentRecallCleanupJob.RECALL_TIMEOUT_MINUTES} min).`,
      );
    } catch (err) {
      this.logger.error('Errore durante TreatmentRecallCleanup cron', err);
    }
  }
}
