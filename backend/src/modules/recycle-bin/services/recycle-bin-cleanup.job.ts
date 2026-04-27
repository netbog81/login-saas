import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecycleBinService } from './recycle-bin.service';

/**
 * Cron job giornaliero che applica la retention del cestino.
 *
 * NOTA multi-tenant: oggi opera sullo schema PostgreSQL di default
 * (allineato a `auto-attendance.service.ts`). Quando il sistema avrà più
 * tenant attivi simultanei, andrà esteso iterando sugli schemi e
 * impostando il search_path per ognuno; l'enumerazione tenant non è
 * ancora centralizzata nel progetto.
 */
@Injectable()
export class RecycleBinCleanupJob {
  private readonly logger = new Logger(RecycleBinCleanupJob.name);

  constructor(private readonly recycleBinService: RecycleBinService) {}

  /**
   * Eseguito ogni giorno alle 03:00 (ora server). Pulisce gli elementi
   * più vecchi della retention configurata. Se la retention è null
   * (indefinita), non fa nulla.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'recycleBinCleanup' })
  async handleCleanup(): Promise<void> {
    try {
      const purged = await this.recycleBinService.runRetentionCleanup(false);
      if (purged > 0) {
        this.logger.log(
          `RecycleBin cleanup giornaliero: ${purged} record eliminati definitivamente`,
        );
      }
    } catch (error) {
      this.logger.error('Errore durante RecycleBin cleanup cron', error);
    }
  }
}
