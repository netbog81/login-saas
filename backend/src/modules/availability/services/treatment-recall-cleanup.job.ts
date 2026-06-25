import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan } from 'typeorm';
import { Treatment } from '../entities/treatment.entity';
import { TenantContextService, TenantDataSourceManager } from '@curandis/tenant-datasource';

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
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
  ){}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'treatmentRecallCleanup' })
  async handleCleanup(): Promise<void> {
    let aliases: string[];
    try {
      aliases = await this.tenantDsManager.listKnownTenantAliases();
    } catch (err) {
      this.logger.error('TreatmentRecallCleanup: impossibile elencare tenant', err as Error);
      return;
    }

    for (const alias of aliases) {
      try {
        await this.processTenant(alias);
      } catch (err) {
        this.logger.error(`TreatmentRecallCleanup: errore su tenant="${alias}"`, err as Error);
      }
    }
  }

  private async processTenant(tenantAlias: string): Promise<void> {
    const ds = await this.tenantDsManager.getDataSource(tenantAlias);

    await this.tenantContext.run(
      { tenantAlias, dataSource: ds, dbName: ds.options.database as string },
      async () => {
        const threshold = new Date(
          Date.now() - TreatmentRecallCleanupJob.RECALL_TIMEOUT_MINUTES * 60 * 1000,
        );

        const treatmentRepo = ds.getRepository(Treatment);
        const stuck = await treatmentRepo.find({
          where: {
            recallRequestedAt: LessThan(threshold),
          },
          select: ['id', 'recallRequestId', 'recallRequestedAt'],
        });

        if (stuck.length === 0) return;

        for (const t of stuck) {
          this.logger.warn(
            `[tenant=${tenantAlias}] Recall stuck per treatment ${t.id} ` +
              `(requestId=${t.recallRequestId}, requestedAt=${t.recallRequestedAt?.toISOString()}). ` +
              `Azzero per consentire retry.`,
          );
          // NB: `repo.update()` con `null` esplicito è necessario per
          // forzare la UPDATE a NULL. Setting `= undefined` + `save()` viene
          // ignorato da TypeORM ("non includere il campo nell'UPDATE") —
          // bug scoperto in produzione 2026-05-25.
          await treatmentRepo.update(t.id, {
            recallRequestId: null as unknown as string,
            recallRequestedAt: null as unknown as Date,
          });
        }

        this.logger.log(
          `TreatmentRecallCleanup [tenant=${tenantAlias}]: ${stuck.length} recall stuck ` +
            `azzerati (timeout ${TreatmentRecallCleanupJob.RECALL_TIMEOUT_MINUTES} min).`,
        );
      },
    );
  }
}
