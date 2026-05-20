import { Resolver, Query, Mutation, Args, ID, Float } from '@nestjs/graphql';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Product } from '../entities/product.entity';
import { ClinicalEventBuffer } from '../../clinical-events/clinical-event-buffer.service';
import { flushBufferedEvents } from '../../clinical-events/clinical-event-buffer.helpers';
import { CatalogEventMapper } from '../../clinical-events/mappers/catalog-event.mapper';
import { TenantSchemaContextService } from '../../../database/tenant-schema-context.service';

/**
 * Resolver del catalogo Product (vendita rapida).
 *
 * Step 7.6: ogni create/update/delete pubblica `product.upserted.<tenant>`
 * o `product.deleted.<tenant>` verso accounting tramite `ex.clinical.events`.
 * Pattern publish-after-commit identico a `ServiceResolver`.
 *
 * Soft-delete logico (isActive=false) per delete: i payload storici delle
 * `sale.completed` referenziano `productId` come FK logica → non vogliamo
 * record orfani lato accounting.
 */
@Resolver(() => Product)
export class ProductResolver {
  private readonly logger = new Logger(ProductResolver.name);

  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectDataSource()
    private dataSource: DataSource,
    private readonly eventBuffer: ClinicalEventBuffer,
    private readonly eventEmitter: EventEmitter2,
    private readonly catalogMapper: CatalogEventMapper,
    private readonly tenantContext: TenantSchemaContextService,
  ) {}

  // ============================================================================
  // Queries
  // ============================================================================

  @Query(() => [Product], { name: 'products' })
  async getProducts(
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive?: boolean,
  ): Promise<Product[]> {
    const where: any = {};
    if (onlyActive) where.isActive = true;
    return this.productRepo.find({ where, order: { name: 'ASC' } });
  }

  @Query(() => Product, { name: 'product', nullable: true })
  async getProduct(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Product | null> {
    return this.productRepo.findOne({ where: { id } });
  }

  // ============================================================================
  // Mutations
  // ============================================================================

  @Mutation(() => Product, { name: 'createProduct' })
  async createProduct(
    @Args('productCode') productCode: string,
    @Args('name') name: string,
    @Args('defaultPrice', { type: () => Float }) defaultPrice: number,
    @Args('description', { nullable: true }) description?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('isActive', { nullable: true, defaultValue: true }) isActive?: boolean,
  ): Promise<Product> {
    if (!productCode || productCode.trim().length === 0) {
      throw new BadRequestException('productCode è obbligatorio.');
    }
    if (defaultPrice < 0) {
      throw new BadRequestException('defaultPrice non può essere negativo.');
    }

    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Product);
      const product = repo.create({
        productCode: productCode.trim(),
        name,
        description,
        defaultPrice,
        category,
        isActive: isActive !== false,
      });
      const result = await repo.save(product);

      if (tenantAlias) {
        this.eventBuffer.add({
          eventType: 'product.upserted',
          payload: this.catalogMapper.mapProductUpserted(result),
          tenantAlias,
          correlationId,
        });
      }
      return result;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    return saved;
  }

  @Mutation(() => Product, { name: 'updateProduct' })
  async updateProduct(
    @Args('id', { type: () => ID }) id: string,
    @Args('productCode', { nullable: true }) productCode?: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('defaultPrice', { type: () => Float, nullable: true }) defaultPrice?: number,
    @Args('description', { nullable: true }) description?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<Product> {
    if (defaultPrice !== undefined && defaultPrice < 0) {
      throw new BadRequestException('defaultPrice non può essere negativo.');
    }

    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const updated = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Product);
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException(`Product ${id} non trovato`);
      }

      await repo.update(id, {
        ...(productCode !== undefined && { productCode: productCode.trim() }),
        ...(name !== undefined && { name }),
        ...(defaultPrice !== undefined && { defaultPrice }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
      });

      const reloaded = await repo.findOne({ where: { id } });
      if (!reloaded) {
        throw new NotFoundException(`Product ${id} sparito durante l'update`);
      }

      if (tenantAlias) {
        this.eventBuffer.add({
          eventType: 'product.upserted',
          payload: this.catalogMapper.mapProductUpserted(reloaded),
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
   * Soft-delete logico (isActive=false). Vedi commento ServiceResolver:
   * niente hard-delete per non orfanare i payload `sale.completed` storici
   * lato accounting.
   */
  @Mutation(() => Boolean, { name: 'deleteProduct' })
  async deleteProduct(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const tenantAlias = this.tenantContext.getTenantAlias();
    const correlationId = this.tenantContext.getContext()?.requestId;

    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Product);
      const existing = await repo.findOne({ where: { id } });
      if (!existing) return false;
      if (existing.isActive) {
        await repo.update(id, { isActive: false });
      } else {
        this.logger.warn(
          `[ProductResolver] deleteProduct no-op: product ${id} già isActive=false`,
        );
      }
      const deletedAt = new Date();

      if (tenantAlias) {
        this.eventBuffer.add({
          eventType: 'product.deleted',
          payload: this.catalogMapper.mapProductDeleted(id, deletedAt),
          tenantAlias,
          correlationId,
        });
      }
      return true;
    });

    flushBufferedEvents(this.eventBuffer, this.eventEmitter);
    return result;
  }
}
