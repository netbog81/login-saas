import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ClinicalEventsConfig } from './clinical-events.config';
import { ClinicalEventPublisher } from './clinical-event.publisher';
import { ClinicalEventBuffer } from './clinical-event-buffer.service';
import { ClinicalEventBufferMiddleware } from './clinical-event-buffer.middleware';
import { AccountingEventConsumer } from './accounting-event.consumer';
import { TreatmentEventMapper } from './mappers/treatment-event.mapper';
import { CatalogEventMapper } from './mappers/catalog-event.mapper';
import { DlqMonitorService } from './dlq-monitor.service';
import { DlqMonitorResolver } from './dlq-monitor.resolver';
import { AppUsersModule } from '../users/app-users.module';

/**
 * Modulo eventi clinici:
 *   - PUBLISHER `ClinicalEventPublisher` su `ex.clinical.events` (Step 2).
 *   - CONSUMER `AccountingEventConsumer` su `ex.accounting.events` (Step 3),
 *     6 binding key `billable.*.*`, coda `q.clinical.accounting-feedback`,
 *     DLQ `q.clinical.accounting-feedback.dlq` legata a `ex.dlq`.
 *
 * Idempotency consumer: `processed_clinical_events` (registrata in ALL_ENTITIES
 * di AppModule, accessibile via manager.getRepository(ProcessedClinicalEvent)
 * dentro le transazioni del consumer).
 *
 * @Global() perché il publisher sarà iniettato in vari moduli (availability
 * per treatment.X / sale.X, ecc.) senza dover importare ovunque.
 * TenantContextService + TenantDataSourceManager sono forniti globalmente
 * da @curandis/tenant-datasource (TenantDataSourceModule.forRoot in AppModule).
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    // AppUsersModule serve a DlqMonitorResolver per il guard AuthorizationGuard
    // (che inietta AppUserService). Aggiunto sessione 7 col widget admin DLQ.
    AppUsersModule,
  ],
  providers: [
    ClinicalEventsConfig,
    ClinicalEventPublisher,
    ClinicalEventBuffer,
    ClinicalEventBufferMiddleware,
    AccountingEventConsumer,
    TreatmentEventMapper,
    CatalogEventMapper,
    DlqMonitorService,
    DlqMonitorResolver,
  ],
  exports: [
    ClinicalEventPublisher,
    ClinicalEventBuffer,
    ClinicalEventBufferMiddleware,
    ClinicalEventsConfig,
    TreatmentEventMapper,
    CatalogEventMapper,
  ],
})
export class ClinicalEventsModule {}
