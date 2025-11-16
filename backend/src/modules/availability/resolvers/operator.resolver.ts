import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Operator, OperatorType } from '../entities/operator.entity';
// import { GqlAuthGuard } from '../../auth/guards/gql-auth.guard'; // Uncomment when auth is ready

@Resolver(() => Operator)
export class OperatorResolver {
  constructor(
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
  ) {}

  // Queries
  @Query(() => [Operator], { name: 'operators' })
  // @UseGuards(GqlAuthGuard)
  async getOperators(): Promise<Operator[]> {
    return this.operatorRepo.find({
      relations: ['availabilityTemplates', 'availabilityExceptions'],
    });
  }

  @Query(() => Operator, { name: 'operator', nullable: true })
  // @UseGuards(GqlAuthGuard)
  async getOperator(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Operator | null> {
    return this.operatorRepo.findOne({
      where: { id },
      relations: ['availabilityTemplates', 'availabilityExceptions'],
    });
  }

  // Mutations
  @Mutation(() => Operator, { name: 'createOperator' })
  // @UseGuards(GqlAuthGuard)
  async createOperator(
    @Args('name') name: string,
    @Args('operatorType', { type: () => OperatorType, defaultValue: OperatorType.STANDARD })
      operatorType: OperatorType,
    @Args('maxConcurrentAppointments', { type: () => Number, defaultValue: 1 })
      maxConcurrentAppointments: number,
    @Args('surname', { nullable: true }) surname?: string,
    @Args('email', { nullable: true }) email?: string,
    @Args('phone', { nullable: true }) phone?: string,
    @Args('color', { nullable: true }) color?: string,
  ): Promise<Operator> {
    const operator = this.operatorRepo.create({
      name,
      surname,
      email,
      phone,
      operatorType,
      maxConcurrentAppointments,
      color,
      isActive: true,
    });

    return this.operatorRepo.save(operator);
  }

  @Mutation(() => Operator, { name: 'updateOperator' })
  // @UseGuards(GqlAuthGuard)
  async updateOperator(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('surname', { nullable: true }) surname?: string,
    @Args('email', { nullable: true }) email?: string,
    @Args('phone', { nullable: true }) phone?: string,
    @Args('operatorType', { type: () => OperatorType, nullable: true }) operatorType?: OperatorType,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('maxConcurrentAppointments', { nullable: true }) maxConcurrentAppointments?: number,
  ): Promise<Operator> {
    await this.operatorRepo.update(id, {
      ...(name !== undefined && { name }),
      ...(surname !== undefined && { surname }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(operatorType !== undefined && { operatorType }),
      ...(isActive !== undefined && { isActive }),
      ...(maxConcurrentAppointments !== undefined && { maxConcurrentAppointments }),
    });

    const operator = await this.operatorRepo.findOne({ where: { id } });
    if (!operator) {
      throw new Error('Operator not found');
    }

    return operator;
  }

  @Mutation(() => Boolean, { name: 'deleteOperator' })
  // @UseGuards(GqlAuthGuard)
  async deleteOperator(
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    const result = await this.operatorRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}