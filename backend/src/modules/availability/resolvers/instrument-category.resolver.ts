import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { InstrumentCategory } from '../entities/instrument-category.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { InstrumentCategoryService } from '../services/instrument-category.service';

@Resolver(() => InstrumentCategory)
export class InstrumentCategoryResolver {
  constructor(private readonly categoryService: InstrumentCategoryService) {}

  @Query(() => [InstrumentCategory], { name: 'instrumentCategories' })
  async getInstrumentCategories(
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
  ): Promise<InstrumentCategory[]> {
    return this.categoryService.findAll(macroCategory);
  }

  @Query(() => InstrumentCategory, { name: 'instrumentCategory', nullable: true })
  async getInstrumentCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<InstrumentCategory> {
    return this.categoryService.findOne(id);
  }

  @Mutation(() => InstrumentCategory, { name: 'createInstrumentCategory' })
  async createInstrumentCategory(
    @Args('name') name: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
  ): Promise<InstrumentCategory> {
    return this.categoryService.create(name, description, macroCategory);
  }

  @Mutation(() => InstrumentCategory, { name: 'updateInstrumentCategory' })
  async updateInstrumentCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<InstrumentCategory> {
    return this.categoryService.update(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(macroCategory !== undefined && { macroCategory }),
      ...(isActive !== undefined && { isActive }),
    });
  }

  @Mutation(() => Boolean, { name: 'deleteInstrumentCategory' })
  async deleteInstrumentCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.categoryService.delete(id);
  }
}
