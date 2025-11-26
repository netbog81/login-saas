import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { OperatorCategory } from '../entities/operator-category.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { OperatorCategoryService } from '../services/operator-category.service';

@Resolver(() => OperatorCategory)
export class OperatorCategoryResolver {
  constructor(private readonly categoryService: OperatorCategoryService) {}

  @Query(() => [OperatorCategory], { name: 'operatorCategories' })
  async getOperatorCategories(
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
  ): Promise<OperatorCategory[]> {
    return this.categoryService.findAll(macroCategory);
  }

  @Query(() => OperatorCategory, { name: 'operatorCategory', nullable: true })
  async getOperatorCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<OperatorCategory> {
    return this.categoryService.findOne(id);
  }

  @Mutation(() => OperatorCategory, { name: 'createOperatorCategory' })
  async createOperatorCategory(
    @Args('macroCategory', { type: () => OperatorMacroCategory }) macroCategory: OperatorMacroCategory,
    @Args('name') name: string,
    @Args('description', { nullable: true }) description?: string,
  ): Promise<OperatorCategory> {
    return this.categoryService.create(macroCategory, name, description);
  }

  @Mutation(() => OperatorCategory, { name: 'updateOperatorCategory' })
  async updateOperatorCategory(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true }) macroCategory?: OperatorMacroCategory,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<OperatorCategory> {
    return this.categoryService.update(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(macroCategory !== undefined && { macroCategory }),
      ...(isActive !== undefined && { isActive }),
    });
  }

  @Mutation(() => Boolean, { name: 'deleteOperatorCategory' })
  async deleteOperatorCategory(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.categoryService.delete(id);
  }
}
