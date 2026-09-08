import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantContextService, TenantDataSourceManager } from '@curandis/tenant-datasource';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';

/**
 * Riallinea periodicamente i calendari Google collegati.
 *
 * Il push immediato è fire-and-forget — non deve mai far aspettare chi salva
 * un appuntamento — e per questo può perdersi qualcosa: una richiesta fallita
 * dopo i tentativi, un riavvio a metà, una modifica passata da un percorso di
 * scrittura che non abbiamo agganciato (spostamenti di serie, operazioni
 * massive, cambi di stato automatici).
 *
 * Questo job è ciò che rende la correttezza **indipendente dall'aver
 * intercettato ogni singola scrittura**: al massimo l'operatore vede una
 * modifica con qualche minuto di ritardo, mai un calendario che resta
 * sbagliato per sempre.
 *
 * Ogni 15 minuti: abbastanza spesso da recuperare in fretta, abbastanza raro
 * da non tempestare Google — una riversata tocca tutti gli appuntamenti della
 * finestra di ogni operatore collegato.
 */
@Injectable()
export class GoogleCalendarReconcileJob {
  private readonly logger = new Logger(GoogleCalendarReconcileJob.name);

  /** Evita che due esecuzioni si accavallino se una è ancora in corso. */
  private running = false;

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
    private readonly sync: GoogleCalendarSyncService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcile(): Promise<void> {
    if (this.running) {
      this.logger.warn('[GCAL] Riconciliazione precedente ancora in corso: giro saltato');
      return;
    }
    this.running = true;

    try {
      let aliases: string[];
      try {
        aliases = await this.tenantDsManager.listKnownTenantAliases();
      } catch (error) {
        this.logger.error(`[GCAL] Impossibile elencare i tenant: ${(error as Error).message}`);
        return;
      }

      for (const alias of aliases) {
        try {
          const ds = await this.tenantDsManager.getDataSource(alias);
          await this.tenantContext.run(
            { tenantAlias: alias, dataSource: ds, dbName: ds.options.database as string },
            () => this.sync.reconcileTenant(),
          );
        } catch (error) {
          // Un tenant in errore non deve fermare gli altri.
          this.logger.error(
            `[GCAL] Riconciliazione fallita sul tenant "${alias}": ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
