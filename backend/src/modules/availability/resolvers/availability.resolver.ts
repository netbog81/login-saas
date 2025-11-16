import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AvailabilityService } from '../services/availability.service';
import { AvailabilityTemplate } from '../entities/availability-template.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { CreateAvailabilityTemplateInput } from '../dto/create-availability-template.input';
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
}