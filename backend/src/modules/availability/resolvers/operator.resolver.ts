import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { OperatorService } from '../services/operator.service';
import { CreateOperatorInput } from '../dto/create-operator.input';
import { UpdateOperatorInput } from '../dto/update-operator.input';

@Resolver(() => Operator)
export class OperatorResolver {
  constructor(
    private readonly operatorService: OperatorService,
  ) {}

  // Queries
  @Query(() => [Operator], { name: 'operators' })
  async getOperators(
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('categoryId', { type: () => ID, nullable: true })
    categoryId?: string,
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive?: boolean,
  ): Promise<Operator[]> {
    return this.operatorService.findAll({
      macroCategory,
      categoryId,
      onlyActive,
    });
  }

  @Query(() => Operator, { name: 'operator', nullable: true })
  async getOperator(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Operator | null> {
    try {
      return await this.operatorService.findOne(id);
    } catch (error) {
      return null;
    }
  }

  @Query(() => [Operator], { name: 'checkDuplicateOperator' })
  async checkDuplicateOperator(
    @Args('name') name: string,
    @Args('surname', { nullable: true }) surname?: string,
  ): Promise<Operator[]> {
    return this.operatorService.findSimilarOperators(name, surname);
  }

  // Mutations
  @Mutation(() => Operator, { name: 'createOperator' })
  async createOperator(
    @Args('input') input: CreateOperatorInput,
  ): Promise<Operator> {
    return this.operatorService.create(input);
  }

  @Mutation(() => Operator, { name: 'updateOperator' })
  async updateOperator(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateOperatorInput,
  ): Promise<Operator> {
    return this.operatorService.update(id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteOperator' })
  async deleteOperator(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.operatorService.delete(id);
  }
}
