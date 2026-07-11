import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceSubcategory } from '../entities/service-subcategory.entity';
import { Service } from '../entities/service.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { ClinicalEventBuffer } from '../../clinical-events/clinical-event-buffer.service';
import { flushBufferedEvents } from '../../clinical-events/clinical-event-buffer.helpers';
import { CatalogEventMapper } from '../../clinical-events/mappers/catalog-event.mapper';
import { TenantContextService } from '@curandis/tenant-datasource';

@Resolver(() => ServiceSubcategory)
export class ServiceSubcategoryResolver {
  private readonly logger = new Logger(ServiceSubcategoryResolver.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly eventBuffer: ClinicalEventBuffer,
    private readonly eventEmitter: EventEmitter2,
    private readonly catalogMapper: CatalogEventMapper,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get subcategoryRepo() { return this.dataSource.getRepository(ServiceSubcategory); }

  // Queries
  @Query(() => [ServiceSubcategory], { name: 'serviceSubcategories' })
  async getServiceSubcategories(
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive?: boolean,
  ): Promise<ServiceSubcategory[]> {
    const where: any = {};
    if (macroCategory) where.macroCategory = macroCategory;
    if (onlyActive) where.isActive = true;

    return this.subcategoryRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  @Query(() => ServiceSubcategory, { name: 'serviceSubcategory', nullable: true })
  async getServiceSubcategory(
    @Args('id', { type: () => ID }) id: string
  ): Promise<ServiceSubcategory | null> {
    return this.subcategoryRepo.findOne({
      where: { id },
    });
  }

  // Mutations
  @Mutation(() => ServiceSubcategory, { name: 'createServiceSubcategory' })
  async createServiceSubcategory(
    @Args('macroCategory', { type: () => OperatorMacroCategory }) macroCategory: OperatorMacroCategory,
    @Args('name') name: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('invoiceLineDescription', { nullable: true }) invoiceLineDescription?: string,
  ): Promise<ServiceSubcategory> {
    const subcategory = this.subcategoryRepo.create({
      macroCategory,
      name,
      description,
      invoiceLineDescription,
      isActive: true,
    });

    return this.subcategoryRepo.save(subcategory);
  }

  @Mutation(() => ServiceSubcategory, { name: 'updateServiceSubcategory' })
  async updateServiceSubcategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('invoiceLineDescription', { nullable: true }) invoiceLineDescription?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<ServiceSubcategory> {
    await this.subcategoryRepo.update(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(invoiceLineDescription !== undefined && { invoiceLineDescription }),
      ...(isActive !== undefined && { isActive }),
    });

    const subcategory = await this.subcategoryRepo.findOne({ where: { id } });
    if (!subcategory) {
      throw new Error('Sottocategoria non trovata');
    }

    // 2026-07-07 — {descrizione_fattura_sottocategoria} entra nel calcolo di
    // `invoiceLineDescriptionDefault` sincronizzato verso accounting: se la
    // descrizione fattura è cambiata, ri-emetti service.upserted per i
    // service di questa sottocategoria.
    if (invoiceLineDescription !== undefined) {
      await this.resyncServicesForSubcategory(id);
    }

    return subcategory;
  }

  /**
   * Ri-pubblica `service.upserted` per tutti i service della sottocategoria,
   * così accounting riceve il nuovo `invoiceLineDescriptionDefault`.
   * Best-effort: un errore qui non deve far fallire l'update.
   */
  private async resyncServicesForSubcategory(subcategoryId: string): Promise<void> {
    try {
      const tenantAlias = this.tenantContext.getTenantAlias();
      const ds = this.tenantContext.getDataSource();
      if (!tenantAlias || !ds) return;
      const correlationId = this.tenantContext.getContext()?.requestId;

      const services = await ds.getRepository(Service).find({
        where: { subcategoryId },
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
        `[ServiceSubcategoryResolver] resync ${services.length} service.upserted dopo update sottocategoria ${subcategoryId}`,
      );
    } catch (err) {
      this.logger.warn(
        `[ServiceSubcategoryResolver] resync post-update fallito (subcategory=${subcategoryId}): ${(err as Error).message}`,
      );
    }
  }

  @Mutation(() => Boolean, { name: 'deleteServiceSubcategory' })
  async deleteServiceSubcategory(
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    const result = await this.subcategoryRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
