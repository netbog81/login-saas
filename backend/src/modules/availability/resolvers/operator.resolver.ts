import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';

@Resolver(() => Operator)
export class OperatorResolver {
  constructor(
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
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
    const where: any = {};
    if (macroCategory) where.macroCategory = macroCategory;
    if (categoryId) where.categoryId = categoryId;
    if (onlyActive) where.isActive = true;

    return this.operatorRepo.find({
      where,
      relations: ['category', 'availabilityTemplates', 'availabilityExceptions', 'gymSchedules'],
      order: { surname: 'ASC', name: 'ASC' },
    });
  }

  @Query(() => Operator, { name: 'operator', nullable: true })
  async getOperator(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Operator | null> {
    return this.operatorRepo.findOne({
      where: { id },
      relations: ['category', 'availabilityTemplates', 'availabilityExceptions', 'gymSchedules'],
    });
  }

  // Mutations
  @Mutation(() => Operator, { name: 'createOperator' })
  async createOperator(
    @Args('name') name: string,
    @Args('macroCategory', { type: () => OperatorMacroCategory, defaultValue: OperatorMacroCategory.PHYSIOTHERAPIST })
    macroCategory: OperatorMacroCategory,
    @Args('maxConcurrentAppointments', { type: () => Int, defaultValue: 1 })
    maxConcurrentAppointments: number,
    @Args('surname', { nullable: true }) surname?: string,
    @Args('email', { nullable: true }) email?: string,
    @Args('phone', { nullable: true }) phone?: string,
    @Args('color', { nullable: true }) color?: string,
    @Args('categoryId', { type: () => ID, nullable: true }) categoryId?: string,
    @Args('preferredDurations', { type: () => [Int], nullable: true }) preferredDurations?: number[],
    @Args('legacyUserId', { type: () => Int, nullable: true }) legacyUserId?: number,
  ): Promise<Operator> {
    const operator = this.operatorRepo.create({
      name,
      surname,
      email,
      phone,
      macroCategory,
      categoryId,
      maxConcurrentAppointments,
      color,
      preferredDurations,
      legacyUserId,
      isActive: true,
    });

    return this.operatorRepo.save(operator);
  }

  @Mutation(() => Operator, { name: 'updateOperator' })
  async updateOperator(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('surname', { nullable: true }) surname?: string,
    @Args('email', { nullable: true }) email?: string,
    @Args('phone', { nullable: true }) phone?: string,
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true }) macroCategory?: OperatorMacroCategory,
    @Args('categoryId', { type: () => ID, nullable: true }) categoryId?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('maxConcurrentAppointments', { type: () => Int, nullable: true }) maxConcurrentAppointments?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('preferredDurations', { type: () => [Int], nullable: true }) preferredDurations?: number[],
    @Args('legacyUserId', { type: () => Int, nullable: true }) legacyUserId?: number,
  ): Promise<Operator> {
    await this.operatorRepo.update(id, {
      ...(name !== undefined && { name }),
      ...(surname !== undefined && { surname }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(macroCategory !== undefined && { macroCategory }),
      ...(categoryId !== undefined && { categoryId }),
      ...(isActive !== undefined && { isActive }),
      ...(maxConcurrentAppointments !== undefined && { maxConcurrentAppointments }),
      ...(color !== undefined && { color }),
      ...(preferredDurations !== undefined && { preferredDurations }),
      ...(legacyUserId !== undefined && { legacyUserId }),
    });

    const operator = await this.operatorRepo.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!operator) {
      throw new Error('Operator not found');
    }

    return operator;
  }

  @Mutation(() => Boolean, { name: 'deleteOperator' })
  async deleteOperator(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const result = await this.operatorRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
