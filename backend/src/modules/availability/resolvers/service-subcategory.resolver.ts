import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ServiceSubcategory } from '../entities/service-subcategory.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { TenantContextService } from '@curandis/tenant-datasource';

@Resolver(() => ServiceSubcategory)
export class ServiceSubcategoryResolver {
  constructor(
    private readonly tenantContext: TenantContextService,
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
  ): Promise<ServiceSubcategory> {
    const subcategory = this.subcategoryRepo.create({
      macroCategory,
      name,
      description,
      isActive: true,
    });

    return this.subcategoryRepo.save(subcategory);
  }

  @Mutation(() => ServiceSubcategory, { name: 'updateServiceSubcategory' })
  async updateServiceSubcategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<ServiceSubcategory> {
    await this.subcategoryRepo.update(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    });

    const subcategory = await this.subcategoryRepo.findOne({ where: { id } });
    if (!subcategory) {
      throw new Error('Sottocategoria non trovata');
    }

    return subcategory;
  }

  @Mutation(() => Boolean, { name: 'deleteServiceSubcategory' })
  async deleteServiceSubcategory(
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    const result = await this.subcategoryRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
