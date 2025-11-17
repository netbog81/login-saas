import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AvailabilityService } from '../services/availability.service';
import { AvailabilityTemplate } from '../entities/availability-template.entity';
import { TemplatePattern } from '../entities/template-pattern.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { GroupException } from '../entities/group-exception.entity';
import { CreateAvailabilityTemplateInput } from '../dto/create-availability-template.input';
import { CreateTemplatePatternInput } from '../dto/create-template-pattern.input';
import { AssignTemplateToOperatorInput } from '../dto/assign-template-to-operator.input';
import { DailyAvailability, AvailabilitySlot } from '../dto/availability-slot.output';
// import { GqlAuthGuard } from '../../auth/guards/gql-auth.guard'; // Uncomment when auth is ready

@Resolver()
export class AvailabilityResolver {
  constructor(private readonly availabilityService: AvailabilityService) {}

  // Queries
  @Query(() => [AvailabilityTemplate], { name: 'availabilityTemplates' })
  // @UseGuards(GqlAuthGuard)
  async getTemplates(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('onlyCurrent', { type: () => Boolean, defaultValue: true }) onlyCurrent: boolean
  ): Promise<AvailabilityTemplate[]> {
    return this.availabilityService.getTemplates(operatorId, onlyCurrent);
  }

  @Query(() => [TemplatePattern], { name: 'allTemplatePatterns' })
  // @UseGuards(GqlAuthGuard)
  async getAllTemplatePatterns(): Promise<TemplatePattern[]> {
    return this.availabilityService.getAllTemplatePatterns();
  }

  @Query(() => [DailyAvailability], { name: 'operatorAvailability' })
  // @UseGuards(GqlAuthGuard)
  async getOperatorAvailability(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string
  ): Promise<DailyAvailability[]> {
    return this.availabilityService.getOperatorAvailability(operatorId, startDate, endDate);
  }

  @Query(() => [AvailabilitySlot], { name: 'availableSlots' })
  // @UseGuards(GqlAuthGuard)
  async getAvailableSlots(
    @Args('date') date: string,
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('serviceId', { type: () => ID, nullable: true }) serviceId?: string
  ): Promise<AvailabilitySlot[]> {
    return this.availabilityService.getAvailableSlots(date, operatorId, serviceId);
  }

  @Query(() => Boolean, { name: 'checkSlotAvailability' })
  // @UseGuards(GqlAuthGuard)
  async checkSlotAvailability(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('date') date: string,
    @Args('startTime') startTime: string,
    @Args('endTime') endTime: string
  ): Promise<boolean> {
    return this.availabilityService.checkSlotAvailability(operatorId, date, startTime, endTime);
  }

  // Mutations
  @Mutation(() => AvailabilityTemplate, { name: 'createAvailabilityTemplate' })
  // @UseGuards(GqlAuthGuard)
  async createTemplate(
    @Args('input') input: CreateAvailabilityTemplateInput
  ): Promise<AvailabilityTemplate> {
    return this.availabilityService.createTemplate(input);
  }

  @Mutation(() => AvailabilityTemplate, { name: 'updateAvailabilityTemplate' })
  // @UseGuards(GqlAuthGuard)
  async updateTemplate(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CreateAvailabilityTemplateInput
  ): Promise<AvailabilityTemplate> {
    return this.availabilityService.updateTemplate(id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteAvailabilityTemplate' })
  // @UseGuards(GqlAuthGuard)
  async deleteTemplate(
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    return this.availabilityService.deleteTemplate(id);
  }

  @Mutation(() => [TemplatePattern], { name: 'createTemplatePattern' })
  // @UseGuards(GqlAuthGuard)
  async createTemplatePattern(
    @Args('input') input: CreateTemplatePatternInput
  ): Promise<TemplatePattern[]> {
    return this.availabilityService.createTemplatePattern(input);
  }

  @Mutation(() => TemplatePattern, { name: 'updateTemplatePattern' })
  // @UseGuards(GqlAuthGuard)
  async updateTemplatePattern(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CreateTemplatePatternInput
  ): Promise<TemplatePattern> {
    return this.availabilityService.updateTemplatePattern(id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteTemplatePattern' })
  // @UseGuards(GqlAuthGuard)
  async deleteTemplatePattern(
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    return this.availabilityService.deleteTemplatePattern(id);
  }

  @Mutation(() => [TemplateAssignment], { name: 'assignTemplateToOperator' })
  // @UseGuards(GqlAuthGuard)
  async assignTemplateToOperator(
    @Args('input') input: AssignTemplateToOperatorInput
  ): Promise<TemplateAssignment[]> {
    return this.availabilityService.assignTemplateToOperator(input);
  }

  @Mutation(() => AvailabilityException, { name: 'createAvailabilityException' })
  // @UseGuards(GqlAuthGuard)
  async createException(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('date') date: string,
    @Args('type') type: string,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('endTime', { nullable: true }) endTime?: string,
    @Args('reason', { nullable: true }) reason?: string
  ): Promise<AvailabilityException> {
    return this.availabilityService.createException({
      operatorId,
      date,
      type,
      startTime,
      endTime,
      reason
    });
  }

  @Mutation(() => Boolean, { name: 'rebuildAvailabilityCache' })
  // @UseGuards(GqlAuthGuard)
  async rebuildCache(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string
  ): Promise<boolean> {
    await this.availabilityService.rebuildCache(operatorId, startDate, endDate);
    return true;
  }

  // Group Exception Mutations
  @Mutation(() => GroupException, { name: 'createGroupException' })
  // @UseGuards(GqlAuthGuard)
  async createGroupException(
    @Args('name') name: string,
    @Args('exceptionDate') exceptionDate: string,
    @Args('exceptionType') exceptionType: string,
    @Args('appliesToAll', { type: () => Boolean, nullable: true }) appliesToAll?: boolean,
    @Args('operatorIds', { type: () => [ID], nullable: true }) operatorIds?: string[],
    @Args('reason', { nullable: true }) reason?: string
  ): Promise<GroupException> {
    return this.availabilityService.createGroupException({
      name,
      exceptionDate,
      exceptionType,
      appliesToAll,
      operatorIds,
      reason
    });
  }

  @Mutation(() => Boolean, { name: 'deleteGroupException' })
  // @UseGuards(GqlAuthGuard)
  async deleteGroupException(
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    return this.availabilityService.deleteGroupException(id);
  }

  @Query(() => [GroupException], { name: 'groupExceptions' })
  // @UseGuards(GqlAuthGuard)
  async getGroupExceptions(): Promise<GroupException[]> {
    return this.availabilityService.getGroupExceptions();
  }
}