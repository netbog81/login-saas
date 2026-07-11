import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsNull } from 'typeorm';

import { ServiceInvoicePrefix } from '../entities/service-invoice-prefix.entity';
import { InvoiceLineSettings } from '../entities/invoice-line-settings.entity';
import { Service } from '../entities/service.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { ServiceInvoicePrefixService } from '../services/service-invoice-prefix.service';
import { UpsertServiceInvoicePrefixInput } from '../dto/service-invoice-prefix.input';
import { ClinicalEventBuffer } from '../../clinical-events/clinical-event-buffer.service';
import { flushBufferedEvents } from '../../clinical-events/clinical-event-buffer.helpers';
import { CatalogEventMapper } from '../../clinical-events/mappers/catalog-event.mapper';
import { TenantContextService } from '@curandis/tenant-datasource';

@Resolver(() => ServiceInvoicePrefix)
export class ServiceInvoicePrefixResolver {
  private readonly logger = new Logger(ServiceInvoicePrefixResolver.name);

  constructor(
    private readonly service: ServiceInvoicePrefixService,
    private readonly tenantContext: TenantContextService,
    private readonly eventBuffer: ClinicalEventBuffer,
    private readonly eventEmitter: EventEmitter2,
    private readonly catalogMapper: CatalogEventMapper,
  ) {}

  @Query(() => [ServiceInvoicePrefix], { name: 'serviceInvoicePrefixes' })
  getAll(): Promise<ServiceInvoicePrefix[]> {
    return this.service.findAll();
  }

  @Mutation(() => ServiceInvoicePrefix, { name: 'upsertServiceInvoicePrefix' })
  async upsert(
    @Args('input') input: UpsertServiceInvoicePrefixInput,
  ): Promise<ServiceInvoicePrefix> {
    const saved = await this.service.upsert(input.macroCategory, input.prefix, input.template);
    // 2026-07-07 — la config macro (prefisso/template) entra nel calcolo di
    // `invoiceLineDescriptionDefault` sincronizzato verso accounting: dopo
    // l'update ri-emettiamo service.upserted per i service della categoria.
    await this.resyncServicesForCategory(input.macroCategory);
    return saved;
  }

  /**
   * Impostazioni globali della composizione descrizione righe fattura
   * (toggle "abilita sottocategorie operatori").
   */
  @Query(() => InvoiceLineSettings, { name: 'invoiceLineSettings' })
  getSettings(): Promise<InvoiceLineSettings> {
    return this.service.getSettings();
  }

  @Mutation(() => InvoiceLineSettings, { name: 'setInvoiceLineUseOperatorCategories' })
  setUseOperatorCategories(
    @Args('useOperatorCategories') useOperatorCategories: boolean,
  ): Promise<InvoiceLineSettings> {
    // NB: il toggle riguarda solo il contesto operatore, che NON entra nella
    // descrizione default service-level → nessun resync necessario qui.
    return this.service.setUseOperatorCategories(useOperatorCategories);
  }

  /**
   * Ri-pubblica `service.upserted` per tutti i service della macro-categoria
   * aggiornata, così accounting riceve il nuovo
   * `invoiceLineDescriptionDefault`. Per OTHER include anche i service senza
   * macroCategory (fallback di resolveConfig).
   *
   * Best-effort: un errore qui non deve far fallire l'upsert del prefisso.
   */
  private async resyncServicesForCategory(category: OperatorMacroCategory): Promise<void> {
    try {
      const tenantAlias = this.tenantContext.getTenantAlias();
      const ds = this.tenantContext.getDataSource();
      if (!tenantAlias || !ds) return;
      const correlationId = this.tenantContext.getContext()?.requestId;

      const where =
        category === OperatorMacroCategory.OTHER
          ? [{ macroCategory: category }, { macroCategory: IsNull() }]
          : [{ macroCategory: category }];
      const services = await ds.getRepository(Service).find({
        where,
        relations: ['subcategory'],
      });

      for (const service of services) {
        this.eventBuffer.add({
          eventType: 'service.upserted',
          payload: await this.catalogMapper.mapServiceUpsertedWithDefaults(service, ds.manager),
          tenantAlias,
          correlationId,
        });
      }
      flushBufferedEvents(this.eventBuffer, this.eventEmitter);
      this.logger.log(
        `[ServiceInvoicePrefixResolver] resync ${services.length} service.upserted dopo update prefisso macro=${category}`,
      );
    } catch (err) {
      this.logger.warn(
        `[ServiceInvoicePrefixResolver] resync post-upsert fallito (macro=${category}): ${(err as Error).message}`,
      );
    }
  }
}
