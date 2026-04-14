import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { OperatorAbsenceType } from '../entities/operator-absence-type.entity';
import { OperatorAbsenceTypeService } from '../services/operator-absence-type.service';
import {
  CreateOperatorAbsenceTypeInput,
  UpdateOperatorAbsenceTypeInput,
} from '../dto/operator-absence-type.input';

@Resolver(() => OperatorAbsenceType)
export class OperatorAbsenceTypeResolver {
  constructor(private readonly absenceTypeService: OperatorAbsenceTypeService) {}

  @Query(() => [OperatorAbsenceType], { name: 'operatorAbsenceTypes' })
  async getOperatorAbsenceTypes(
    @Args('onlyActive', { type: () => Boolean, nullable: true }) onlyActive?: boolean,
  ): Promise<OperatorAbsenceType[]> {
    return this.absenceTypeService.findAll(onlyActive);
  }

  @Query(() => OperatorAbsenceType, { name: 'operatorAbsenceType', nullable: true })
  async getOperatorAbsenceType(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<OperatorAbsenceType> {
    return this.absenceTypeService.findOne(id);
  }

  @Mutation(() => OperatorAbsenceType, { name: 'createOperatorAbsenceType' })
  async createOperatorAbsenceType(
    @Args('input') input: CreateOperatorAbsenceTypeInput,
  ): Promise<OperatorAbsenceType> {
    return this.absenceTypeService.create(input);
  }

  @Mutation(() => OperatorAbsenceType, { name: 'updateOperatorAbsenceType' })
  async updateOperatorAbsenceType(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateOperatorAbsenceTypeInput,
  ): Promise<OperatorAbsenceType> {
    return this.absenceTypeService.update(id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteOperatorAbsenceType' })
  async deleteOperatorAbsenceType(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.absenceTypeService.delete(id);
  }
}
