import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { OperatorService } from '../services/operator.service';
import { CreateOperatorInput } from '../dto/create-operator.input';
import { UpdateOperatorInput } from '../dto/update-operator.input';
import { AppUser } from '../../users/entities/app-user.entity';

@Resolver(() => Operator)
export class OperatorResolver {
  private readonly logger = new Logger(OperatorResolver.name);

  constructor(
    private readonly operatorService: OperatorService,
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
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

  @Query(() => Operator, { name: 'myOperator', nullable: true })
  async getMyOperator(
    @Context() context: any,
  ): Promise<Operator | null> {
    const keycloakId = context.req?.tenantContext?.userId;
    if (!keycloakId) {
      this.logger.warn('[myOperator] No keycloakId in tenant context');
      return null;
    }

    const appUser = await this.appUserRepo.findOne({
      where: { keycloakId },
    });
    if (!appUser) {
      this.logger.warn(`[myOperator] No AppUser found for keycloakId ${keycloakId}`);
      return null;
    }

    return this.operatorService.findByAppUserId(appUser.id);
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
