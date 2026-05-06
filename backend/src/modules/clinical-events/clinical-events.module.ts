import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicalEventsConfig } from './clinical-events.config';
import { ClinicalEventPublisher } from './clinical-event.publisher';
import { AccountingEventConsumer } from './accounting-event.consumer';
import { ProcessedClinicalEvent } from './processed-clinical-event.entity';

/**
 * Modulo eventi clinici:
 *   - PUBLISHER `ClinicalEventPublisher` su `ex.clinical.events` (Step 2).
 *   - CONSUMER `AccountingEventConsumer` su `ex.accounting.events` (Step 3),
 *     6 binding key `billable.*.*`, coda `q.clinical.accounting-feedback`,
 *     DLQ `q.clinical.accounting-feedback.dlq` legata a `ex.dlq`.
 *
 * Idempotency consumer: `processed_clinical_events` (vedi entity).
 *
 * @Global() perché il publisher sarà iniettato in vari moduli (availability
 * per treatment.X / sale.X, ecc.) senza dover importare ovunque.
 * TenantSchemaContextService + TenantOpenbaoResolverService sono già forniti
 * globalmente dall'AppModule.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ProcessedClinicalEvent]),
  ],
  providers: [
    ClinicalEventsConfig,
    ClinicalEventPublisher,
    AccountingEventConsumer,
  ],
  exports: [ClinicalEventPublisher, ClinicalEventsConfig],
})
export class ClinicalEventsModule {}
