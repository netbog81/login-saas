import { UseInterceptors } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { GymSchedule } from '../entities/gym-schedule.entity';
import { GymScheduleService } from '../services/gym-schedule.service';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';

@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => GymSchedule)
export class GymScheduleResolver {
  constructor(private readonly scheduleService: GymScheduleService) {}

  @Query(() => [GymSchedule], { name: 'gymSchedules' })
  async getGymSchedules(
    @Args('gymRoomId', { type: () => ID, nullable: true }) gymRoomId?: string,
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
  ): Promise<GymSchedule[]> {
    return this.scheduleService.findAll(gymRoomId, operatorId);
  }

  @Query(() => GymSchedule, { name: 'gymSchedule', nullable: true })
  async getGymSchedule(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GymSchedule> {
    return this.scheduleService.findOne(id);
  }

  @Query(() => [GymSchedule], { name: 'gymSchedulesByRoomAndDay' })
  async getGymSchedulesByRoomAndDay(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('dayOfWeek', { type: () => Int }) dayOfWeek: number,
  ): Promise<GymSchedule[]> {
    return this.scheduleService.findByRoomAndDay(gymRoomId, dayOfWeek);
  }

  @Query(() => GymSchedule, { name: 'gymOperatorAtTime', nullable: true })
  async getGymOperatorAtTime(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('dayOfWeek', { type: () => Int }) dayOfWeek: number,
    @Args('time') time: string,
  ): Promise<GymSchedule | null> {
    return this.scheduleService.findOperatorAtTime(gymRoomId, dayOfWeek, time);
  }

  @Mutation(() => GymSchedule, { name: 'createGymSchedule' })
  async createGymSchedule(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('dayOfWeek', { type: () => Int }) dayOfWeek: number,
    @Args('startTime') startTime: string,
    @Args('endTime') endTime: string,
    @Args('validFrom', { nullable: true }) validFrom?: Date,
    @Args('validUntil', { nullable: true }) validUntil?: Date,
  ): Promise<GymSchedule> {
    return this.scheduleService.create({
      gymRoomId,
      operatorId,
      dayOfWeek,
      startTime,
      endTime,
      validFrom,
      validUntil,
    });
  }

  @Mutation(() => GymSchedule, { name: 'updateGymSchedule' })
  async updateGymSchedule(
    @Args('id', { type: () => ID }) id: string,
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('dayOfWeek', { type: () => Int, nullable: true }) dayOfWeek?: number,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('endTime', { nullable: true }) endTime?: string,
    @Args('validFrom', { nullable: true }) validFrom?: Date,
    @Args('validUntil', { nullable: true }) validUntil?: Date,
    @Args('isCurrent', { nullable: true }) isCurrent?: boolean,
  ): Promise<GymSchedule> {
    return this.scheduleService.update(id, {
      ...(operatorId !== undefined && { operatorId }),
      ...(dayOfWeek !== undefined && { dayOfWeek }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(validFrom !== undefined && { validFrom }),
      ...(validUntil !== undefined && { validUntil }),
      ...(isCurrent !== undefined && { isCurrent }),
    });
  }

  @Mutation(() => Boolean, { name: 'deleteGymSchedule' })
  async deleteGymSchedule(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.scheduleService.delete(id);
  }
}
