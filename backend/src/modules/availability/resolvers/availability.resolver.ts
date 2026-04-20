import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AvailabilityService } from '../services/availability.service';
import { PhysiotherapistAvailabilityService } from '../services/physiotherapist-availability.service';
import { GymAvailabilityService } from '../services/gym-availability.service';
import { AvailabilityTemplate } from '../entities/availability-template.entity';
import { TemplatePattern } from '../entities/template-pattern.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { GroupException } from '../entities/group-exception.entity';
import { CreateAvailabilityTemplateInput } from '../dto/create-availability-template.input';
import { CreateTemplatePatternInput } from '../dto/create-template-pattern.input';
import { AssignTemplateToOperatorInput } from '../dto/assign-template-to-operator.input';
import { DailyAvailability, AvailabilitySlot, OperatorAvailabilityResult } from '../dto/availability-slot.output';
import { PhysiotherapistSlotBatchOutput } from '../dto/physiotherapist-slot.output';
import { CheckPhysiotherapistAvailabilityInput } from '../dto/check-physiotherapist-availability.input';
import { PhysiotherapistSlotOutput } from '../dto/physiotherapist-slot.output';
import { GymSlotOutput } from '../dto/gym-slot.output';
// import { GqlAuthGuard } from '../../auth/guards/gql-auth.guard'; // Uncomment when auth is ready

@Resolver()
export class AvailabilityResolver {
  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly physiotherapistAvailabilityService: PhysiotherapistAvailabilityService,
    private readonly gymAvailabilityService: GymAvailabilityService,
  ) {}

  // Queries
  @Query(() => [AvailabilityTemplate], { name: 'availabilityTemplates' })
  // @UseGuards(GqlAuthGuard)
  async getTemplates(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('onlyCurrent', { type: () => Boolean, defaultValue: true }) onlyCurrent: boolean
  ): Promise<AvailabilityTemplate[]> {
    return this.availabilityService.getTemplates(operatorId, onlyCurrent);
  }

  /**
   * @deprecated Use patternGroups query from PatternGroupResolver instead
   */
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

  /**
   * Bulk: Ottiene la disponibilità per più operatori in un range di date.
   */
  @Query(() => [OperatorAvailabilityResult], { name: 'operatorsAvailability' })
  async getOperatorsAvailability(
    @Args('operatorIds', { type: () => [ID] }) operatorIds: string[],
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ): Promise<OperatorAvailabilityResult[]> {
    // Usa il metodo diretto (~4 query totali) invece di quello con cache (~34 query × N operatori)
    return this.availabilityService.getOperatorsAvailabilityDirect(operatorIds, startDate, endDate);
  }

  /**
   * Batch: Trova slot disponibili per fisioterapisti in un range di date.
   * ~5 query DB totali per tutti gli operatori e date.
   */
  @Query(() => [PhysiotherapistSlotBatchOutput], { name: 'physiotherapistAvailableSlotsBatch' })
  async getPhysiotherapistAvailableSlotsBatch(
    @Args('operatorIds', { type: () => [ID] }) operatorIds: string[],
    @Args('dates', { type: () => [String] }) dates: string[],
    @Args('durationMinutes', { type: () => Int }) durationMinutes: number,
  ): Promise<PhysiotherapistSlotBatchOutput[]> {
    return this.physiotherapistAvailabilityService.getAvailableSlotsBatch(operatorIds, dates, durationMinutes);
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

  @Query(() => [PhysiotherapistSlotOutput], { name: 'physiotherapistAvailableSlots' })
  // @UseGuards(GqlAuthGuard)
  async getPhysiotherapistAvailableSlots(
    @Args('input') input: CheckPhysiotherapistAvailabilityInput
  ): Promise<PhysiotherapistSlotOutput[]> {
    // Fix timezone: parse date as local midnight to avoid UTC offset issues
    // Input format: "YYYY-MM-DD"
    const [year, month, day] = input.date.split('-').map(Number);
    const date = new Date(year, month - 1, day); // Local timezone

    console.log('[AvailabilityResolver] getPhysiotherapistAvailableSlots:', {
      inputDate: input.date,
      parsedDate: date.toISOString(),
      localDate: date.toLocaleDateString('it-IT'),
      operatorId: input.operatorId,
    });

    // Convert InstrumentSlotInput to InstrumentSlot (add placeholder categoryName)
    const customSlots = input.customInstrumentSlots?.map(slot => ({
      ...slot,
      categoryName: '', // Will be populated by the service
    }));

    const slots = await this.physiotherapistAvailabilityService.getAvailableSlots(
      input.operatorId,
      date,
      input.durationMinutes,
      input.serviceId,
      customSlots,
    );

    // Convert internal format to output format
    return slots.map(slot => ({
      startTime: `${slot.startTime.getHours().toString().padStart(2, '0')}:${slot.startTime.getMinutes().toString().padStart(2, '0')}`,
      endTime: `${slot.endTime.getHours().toString().padStart(2, '0')}:${slot.endTime.getMinutes().toString().padStart(2, '0')}`,
      available: slot.available,
      reason: slot.reason,
      suggestedInstruments: slot.instrumentSlots,
    }));
  }

  @Query(() => [GymSlotOutput], { name: 'gymAvailableSlots' })
  // @UseGuards(GqlAuthGuard)
  async getGymAvailableSlots(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('date') dateStr: string
  ): Promise<GymSlotOutput[]> {
    const date = new Date(dateStr);
    const slots = await this.gymAvailabilityService.getAvailableSlots(gymRoomId, date);

    return slots.map(slot => ({
      startTime: `${slot.startTime.getHours().toString().padStart(2, '0')}:${slot.startTime.getMinutes().toString().padStart(2, '0')}`,
      endTime: `${slot.endTime.getHours().toString().padStart(2, '0')}:${slot.endTime.getMinutes().toString().padStart(2, '0')}`,
      availableCapacity: slot.maxCapacity - slot.currentBookings,
      totalCapacity: slot.maxCapacity,
      operatorName: slot.operatorName,
    }));
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

  /**
   * @deprecated Use createPatternGroup from PatternGroupResolver instead
   * This method is kept for backward compatibility but creates a PatternGroup behind the scenes
   */
  @Mutation(() => [TemplatePattern], { name: 'createTemplatePattern' })
  // @UseGuards(GqlAuthGuard)
  async createTemplatePattern(
    @Args('input') input: CreateTemplatePatternInput
  ): Promise<TemplatePattern[]> {
    return this.availabilityService.createTemplatePattern(input);
  }

  /**
   * @deprecated Use updatePatternGroup from PatternGroupResolver instead
   */
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