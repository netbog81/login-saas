import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantContextService, TenantDataSourceManager } from '@curandis/tenant-datasource';
import { GoogleTokenAlertService } from './google-token-alert.service';
import { isGoogleOauthTestingMode } from '../utils/google-oauth-mode';

/**
 * Controlla ogni ora se qualche autorizzazione Google sta per scadere.
 *
 * Ogni ora e non ogni dieci minuti come la riconciliazione: qui non si
 * recupera niente, si avvisa una persona. Una scadenza a 7 giorni con avviso
 * a 2 giorni ha una finestra larghissima, e controllare piu' spesso
 * significherebbe solo interrogare il database per nulla.
 *
 * Spento del tutto quando l'app Google e' verificata: la scadenza fissa non
 * esiste piu' e non c'e' niente da prevedere.
 */
@Injectable()
export class GoogleTokenAlertJob {
  private readonly logger = new Logger(GoogleTokenAlertJob.name);
  private running = false;

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantDsManager: TenantDataSourceManager,
    private readonly alerts: GoogleTokenAlertService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async check(): Promise<void> {
    if (!isGoogleOauthTestingMode()) return;
    if (this.running) {
      this.logger.warn('[GCAL-ALERT] Controllo precedente ancora in corso: giro saltato');
      return;
    }
    this.running = true;

    try {
      let aliases: string[];
      try {
        aliases = await this.tenantDsManager.listKnownTenantAliases();
      } catch (error) {
        this.logger.error(`[GCAL-ALERT] Impossibile elencare i tenant: ${(error as Error).message}`);
        return;
      }

      for (const alias of aliases) {
        try {
          const ds = await this.tenantDsManager.getDataSource(alias);
          const sent = await this.tenantContext.run(
            { tenantAlias: alias, dataSource: ds, dbName: ds.options.database as string },
            () => this.alerts.checkAndAlert(),
          );
          if (sent) {
            this.logger.log(`[GCAL-ALERT] ${sent} avvisi di scadenza inviati sul tenant "${alias}"`);
          }
        } catch (error) {
          // Un tenant in errore non deve fermare gli altri.
          this.logger.error(
            `[GCAL-ALERT] Controllo fallito sul tenant "${alias}": ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
