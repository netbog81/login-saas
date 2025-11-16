import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OperatorServiceService } from '../services/operator-service.service';
import { OperatorService } from '../entities/operator-service.entity';
// import { GqlAuthGuard } from '../../auth/guards/gql-auth.guard'; // Uncomment when auth is ready

@Resolver(() => OperatorService)
export class OperatorServiceResolver {
  constructor(private readonly operatorServiceService: OperatorServiceService) {}

  // Queries
  @Query(() => [OperatorService], { name: 'operatorServices' })
  // @UseGuards(GqlAuthGuard)
  async getOperatorServices(
    @Args('operatorId', { type: () => ID }) operatorId: string
  ): Promise<OperatorService[]> {
    return this.operatorServiceService.getOperatorServices(operatorId);
  }

  @Query(() => [OperatorService], { name: 'serviceOperators' })
  // @UseGuards(GqlAuthGuard)
  async getServiceOperators(
    @Args('serviceId', { type: () => ID }) serviceId: string
  ): Promise<OperatorService[]> {
    return this.operatorServiceService.getServiceOperators(serviceId);
  }

  @Query(() => [OperatorService], { name: 'allOperatorServices' })
  // @UseGuards(GqlAuthGuard)
  async getAllOperatorServices(): Promise<OperatorService[]> {
    return this.operatorServiceService.getAllOperatorServices();
  }

  // Mutations
  @Mutation(() => OperatorService, { name: 'assignServiceToOperator' })
  // @UseGuards(GqlAuthGuard)
  async assignServiceToOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('serviceId', { type: () => ID }) serviceId: string,
    @Args('customDuration', { type: () => Int, nullable: true }) customDuration?: number,
    @Args('customBufferTime', { type: () => Int, nullable: true }) customBufferTime?: number
  ): Promise<OperatorService> {
    return this.operatorServiceService.assignServiceToOperator(
      operatorId,
      serviceId,
      customDuration,
      customBufferTime
    );
  }

  @Mutation(() => Boolean, { name: 'removeServiceFromOperator' })
  // @UseGuards(GqlAuthGuard)
  async removeServiceFromOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('serviceId', { type: () => ID }) serviceId: string
  ): Promise<boolean> {
    return this.operatorServiceService.removeServiceFromOperator(operatorId, serviceId);
  }

  @Mutation(() => OperatorService, { name: 'updateOperatorService' })
  // @UseGuards(GqlAuthGuard)
  async updateOperatorService(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('serviceId', { type: () => ID }) serviceId: string,
    @Args('customDuration', { type: () => Int, nullable: true }) customDuration?: number,
    @Args('customBufferTime', { type: () => Int, nullable: true }) customBufferTime?: number
  ): Promise<OperatorService> {
    return this.operatorServiceService.updateOperatorService(
      operatorId,
      serviceId,
      customDuration,
      customBufferTime
    );
  }
}