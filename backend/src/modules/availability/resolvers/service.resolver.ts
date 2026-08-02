import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { BadRequestException, Logger, NotFoundException, UseInterceptors } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Service } from '../entities/service.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { ClinicalEventBuffer } from '../../clinical-events/clinical-event-buffer.service';
import { flushBufferedEvents } from '../../clinical-events/clinical-event-buffer.helpers';
import { CatalogEventMapper } from '../../clinical-events/mappers/catalog-event.mapper';
import { TenantContextService } from '@curandis/tenant-datasource';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';

/**
 * Resolver del catalogo Service.
 *
 * Sessione 6 Step 7.6: ogni create/update/delete pubblica
 * `service.upserted.<tenant>` o `service.deleted.<tenant>` verso accounting
 * tramite `ex.clinical.events`. Pattern publish-after-commit:
 *  - Tutta la mutazione DB dentro `dataSource.transaction(...)`.
 *  - Dentro la tx: `eventBuffer.add()`.
 *  - Solo dopo il commit OK: `flushBufferedEvents()` emette su EventEmitter2
 *    → @OnEvent listener nel publisher → publish reale.
 *  - Se la tx throw, gli eventi restano nel buffer ALS e vengono droppati.
 *
 * IMPORTANTE: `serviceCode` è obbligatorio in create (UNIQUE per-schema).
 * Lo script `sync:services` ha popolato i 17 service esistenti con
 * `TMP-<id8>`; l'operatore corregge poi via UI.
 */
@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => Service)
export class ServiceResolver {
  private readonly logger = new Logger(ServiceResolver.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly eventBuffer: ClinicalEventBuffer,
    private readonly eventEmitter: EventEmitter2,
    private readonly catalogMapper: CatalogEventMapper,
  ) {}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  /** Repository Service del tenant corrente. */
  private get serviceRepo() {
    return this.dataSource.getRepository(Service);
  }

  // ============================================================================
  // Queries (invariate)
  // ============================================================================

  @Query(() => [Service], { name: 'services' })
  async getServices(
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive?: boolean,
  ): Promise<Service[]> {
    const where: any = {};
    if (macroCategory) where.macroCategory = macroCategory;
    if (onlyActive) where.isActive = true;

    // Ordinamento per codice servizio (richiesta cliente): tutti i moduli che
    // caricano l'elenco servizi lo ricevono già ordinato per serviceCode.
    return this.serviceRepo.find({
      where,
      relations: ['requiredInstruments', 'requiredInstruments.instrumentCategory', 'subcategory'],
      order: { serviceCode: 'ASC' },
    });
  }

  @Query(() => Service, { name: 'service', nullable: true })
  async getService(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Service | null> {
    return this.serviceRepo.findOne({
      where: { id },
      relations: ['requiredInstruments', 'requiredInstruments.instrumentCategory', 'subcategory'],
    });
  }

  // ============================================================================
  // Mutations
  // ============================================================================

  /**
   * Normalizza la scomposizione prezzo (tariffa + extra studio) e ricalcola
   * la somma autoritativa lato server.
   *
   * Regole:
   *  - `null/undefined` su qualsiasi componente della breakdown → 0 (per
   *    evitare `null + number = NaN` nelle somme).
   *  - Se almeno una delle due componenti normali è presente nell'input
   *    → `defaultPrice` viene riscritto come `serviceFee + studioExtra`
   *    (la breakdown è autoritativa e sovrascrive `defaultPrice` ricevuto).
   *  - Se entrambe assenti → si rispetta il `defaultPrice` ricevuto
   *    (retrocompat: vecchio client che non manda la breakdown).
   *  - Stessa logica per la coppia FE → `discountFE`.
   *
   * Ritorna l'oggetto patch da spalmare in `repo.create()` / `repo.update()`.
   */
  private applyPriceBreakdown(input: {
    defaultPrice?: number | null;
    discountFE?: number | null;
    serviceFee?: number | null;
    studioExtra?: number | null;
    serviceFeeFE?: number | null;
    studioExtraFE?: number | null;
  }): {
    defaultPrice?: number;
    discountFE?: number | null;
    serviceFee?: number;
    studioExtra?: number;
    serviceFeeFE?: number | null;
    studioExtraFE?: number | null;
  } {
    const out: ReturnType<ServiceResolver['applyPriceBreakdown']> = {};

    const hasNormalBreakdown =
      input.serviceFee !== undefined || input.studioExtra !== undefined;
    if (hasNormalBreakdown) {
      const fee = Number(input.serviceFee ?? 0);
      const extra = Number(input.studioExtra ?? 0);
      out.serviceFee = fee;
      out.studioExtra = extra;
      out.defaultPrice = fee + extra;
    } else if (input.defaultPrice !== undefined) {
      out.defaultPrice = Number(input.defaultPrice ?? 0);
    }

    const hasFEBreakdown =
      input.serviceFeeFE !== undefined || input.studioExtraFE !== undefined;
    if (hasFEBreakdown) {
      const feeFE = Number(input.serviceFeeFE ?? 0);
      const extraFE = Number(input.studioExtraFE ?? 0);
      out.serviceFeeFE = feeFE;
      out.studioExtraFE = extraFE;
      out.discountFE = feeFE + extraFE;
    } else if (input.discountFE !== undefined) {
      out.discountFE = input.discountFE === null ? null : Number(input.discountFE);
    }

    return out;
  }

  @Mutation(() => Service, { name: 'createService' })
  async createService(
    @Args('name') name: string,
    @Args('serviceCode') serviceCode: string,
    @Args('defaultDuration', { type: () => Int }) defaultDuration: number,
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('description', { nullable: true }) description?: string,
    @Args('defaultPrice', { nullable: true }) defaultPrice?: number,
    @Args('bufferTimeBefore', { type: () => Int, nullable: true }) bufferTimeBefore?: number,
    @Args('bufferTimeAfter', { type: () => Int, nullable: true }) bufferTimeAfter?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('preferredDuration', { type: () => Int, nullable: true }) preferredDuration?: number,
    @Args('instrumentOrderMatters', { nullable: true }) instrumentOrderMatters?: boolean,
    @Args('subcategoryId', { type: () => ID, nullable: true }) subcategoryId?: string,
    @Args('discountFE', { nullable: true }) discountFE?: number,
    @Args('serviceFee', { nullable: true }) serviceFee?: number,
    @Args('studioExtra', { nullable: true }) studioExtra?: number,
    @Args('serviceFeeFE', { nullable: true }) serviceFeeFE?: number,
    @Args('studioExtraFE', { nullable: true }) studioExtraFE?: number,
  ): Promise<Service> {
    if (!serviceCode || serviceCode.trim().length === 0) {
      throw new BadRequestException('serviceCode è obbligatorio.');
    }

    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const priceFields = this.applyPriceBreakdown({
      defaultPrice,
      discountFE,
      serviceFee,
      studioExtra,
      serviceFeeFE,
      studioExtraFE,
    });

    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Service);
      const service = repo.create({
        name,
        serviceCode: serviceCode.trim(),
        description,
        defaultDuration,
        defaultPrice: priceFields.defaultPrice ?? 0,
        bufferTimeBefore: bufferTimeBefore || 0,
        bufferTimeAfter: bufferTimeAfter || 0,
        color,
        isActive: isActive !== false,
        macroCategory,
        preferredDuration,
        instrumentOrderMatters: instrumentOrderMatters || false,
        subcategoryId,
        discountFE: priceFields.discountFE ?? undefined,
        serviceFee: priceFields.serviceFee,
        studioExtra: priceFields.studioExtra,
        serviceFeeFE: priceFields.serviceFeeFE ?? undefined,
        studioExtraFE: priceFields.studioExtraFE ?? undefined,
      });
      const result = await repo.save(service);

      if (tenantAlias) {
        this.eventBuffer.add({
          eventType: 'service.upserted',
          // Variante async: include invoiceLineDescriptionDefault (descrizione
          // riga fattura service-level, prefill per righe manuali accounting).
          payload: await this.catalogMapper.mapServiceUpsertedWithDefaults(result, manager),
          tenantAlias,
          correlationId,
        });
      }

      return result;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    return saved;
  }

  @Mutation(() => Service, { name: 'updateService' })
  async updateService(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('serviceCode', { nullable: true }) serviceCode?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('defaultDuration', { type: () => Int, nullable: true }) defaultDuration?: number,
    @Args('defaultPrice', { nullable: true }) defaultPrice?: number,
    @Args('bufferTimeBefore', { type: () => Int, nullable: true }) bufferTimeBefore?: number,
    @Args('bufferTimeAfter', { type: () => Int, nullable: true }) bufferTimeAfter?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('preferredDuration', { type: () => Int, nullable: true }) preferredDuration?: number,
    @Args('instrumentOrderMatters', { nullable: true }) instrumentOrderMatters?: boolean,
    @Args('subcategoryId', { type: () => ID, nullable: true }) subcategoryId?: string,
    @Args('discountFE', { nullable: true }) discountFE?: number,
    @Args('serviceFee', { nullable: true }) serviceFee?: number,
    @Args('studioExtra', { nullable: true }) studioExtra?: number,
    @Args('serviceFeeFE', { nullable: true }) serviceFeeFE?: number,
    @Args('studioExtraFE', { nullable: true }) studioExtraFE?: number,
  ): Promise<Service> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const priceFields = this.applyPriceBreakdown({
      defaultPrice,
      discountFE,
      serviceFee,
      studioExtra,
      serviceFeeFE,
      studioExtraFE,
    });

    const updated = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Service);
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Service ${id} non trovato`);
      }

      await repo.update(id, {
        ...(name !== undefined && { name }),
        ...(serviceCode !== undefined && { serviceCode: serviceCode.trim() }),
        ...(description !== undefined && { description }),
        ...(defaultDuration !== undefined && { defaultDuration }),
        ...(priceFields.defaultPrice !== undefined && { defaultPrice: priceFields.defaultPrice }),
        ...(bufferTimeBefore !== undefined && { bufferTimeBefore }),
        ...(bufferTimeAfter !== undefined && { bufferTimeAfter }),
        ...(color !== undefined && { color }),
        ...(isActive !== undefined && { isActive }),
        ...(macroCategory !== undefined && { macroCategory }),
        ...(preferredDuration !== undefined && { preferredDuration }),
        ...(instrumentOrderMatters !== undefined && { instrumentOrderMatters }),
        ...(subcategoryId !== undefined && { subcategoryId }),
        ...(priceFields.discountFE !== undefined && { discountFE: priceFields.discountFE }),
        ...(priceFields.serviceFee !== undefined && { serviceFee: priceFields.serviceFee }),
        ...(priceFields.studioExtra !== undefined && { studioExtra: priceFields.studioExtra }),
        ...(priceFields.serviceFeeFE !== undefined && { serviceFeeFE: priceFields.serviceFeeFE }),
        ...(priceFields.studioExtraFE !== undefined && { studioExtraFE: priceFields.studioExtraFE }),
      });

      const reloaded = await repo.findOne({
        where: { id },
        relations: ['requiredInstruments', 'requiredInstruments.instrumentCategory', 'subcategory'],
      });
      if (!reloaded) {
        throw new NotFoundException(`Service ${id} sparito durante l'update`);
      }

      if (tenantAlias) {
        this.eventBuffer.add({
          eventType: 'service.upserted',
          payload: await this.catalogMapper.mapServiceUpsertedWithDefaults(reloaded, manager),
          tenantAlias,
          correlationId,
        });
      }
      return reloaded;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    return updated;
  }

  /**
   * Soft-delete logico: marca `isActive=false` invece di rimuovere fisicamente.
   * Pubblica `service.deleted.<tenant>` per informare accounting che il
   * servizio non sarà più offerto.
   *
   * Hard-delete intenzionalmente NON supportato qui: i trattamenti storici
   * fanno FK al service e perderemmo l'audit. Per cleanup database, script
   * separato dedicato.
   */
  @Mutation(() => Boolean, { name: 'deleteService' })
  async deleteService(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Service);
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        return false;
      }
      // Soft-delete = isActive=false. Niente DELETE fisica per preservare FK.
      if (existing.isActive) {
        await repo.update(id, { isActive: false });
      } else {
        // Idempotenza mantenuta (return true), ma logghiamo per distinguere
        // "cancellato adesso" da "era già cancellato" (utile in audit).
        this.logger.warn(
          `[ServiceResolver] deleteService no-op: service ${id} già isActive=false`,
        );
      }
      const deletedAt = new Date();

      if (tenantAlias) {
        this.eventBuffer.add({
          eventType: 'service.deleted',
          payload: this.catalogMapper.mapServiceDeleted(id, deletedAt),
          tenantAlias,
          correlationId,
        });
      }
      return true;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    return result;
  }

  /**
   * 2026-07-07 — Ri-pubblica `service.upserted.<tenant>` per TUTTI i service
   * del tenant corrente (attivi e non). Serve per backfillare lato accounting
   * il nuovo campo `invoiceLineDescriptionDefault` sulla mapping table
   * `clinical_service_mapping` (e in generale per riallineare il catalogo
   * dopo cambi di config prefissi/template).
   *
   * Idempotente lato accounting: l'upsert del consumer aggiorna solo i campi
   * `clinical*` e NON tocca la config fiscale. Sostituisce lo script legacy
   * `sync:services` (escluso dal build post-containerizzazione).
   */
  @Mutation(() => Int, { name: 'resyncServicesToAccounting' })
  async resyncServicesToAccounting(): Promise<number> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    if (!tenantAlias) {
      throw new BadRequestException('Tenant non risolto nel contesto corrente.');
    }
    const correlationId = this.tenantContext.getContext()?.requestId;

    const services = await this.serviceRepo.find({
      relations: ['subcategory'],
      order: { serviceCode: 'ASC' },
    });

    for (const service of services) {
      this.eventBuffer.add({
        eventType: 'service.upserted',
        payload: await this.catalogMapper.mapServiceUpsertedWithDefaults(
          service,
          this.dataSource.manager,
        ),
        tenantAlias,
        correlationId,
      });
    }

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    this.logger.log(
      `[ServiceResolver] resyncServicesToAccounting: ri-emessi ${services.length} service.upserted (tenant=${tenantAlias})`,
    );
    return services.length;
  }
}
