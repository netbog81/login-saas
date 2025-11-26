import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { AvailabilityException, ExceptionType } from '../entities/availability-exception.entity';
import { AvailabilityExceptionService } from '../services/availability-exception.service';
import { HolidayService, Holiday } from '../services/holiday.service';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class HolidayInfo {
  @Field()
  date: Date;

  @Field()
  name: string;
}

@Resolver(() => AvailabilityException)
export class AvailabilityExceptionResolver {
  constructor(
    private readonly exceptionService: AvailabilityExceptionService,
    private readonly holidayService: HolidayService,
  ) {}

  // Queries
  @Query(() => [AvailabilityException], { name: 'availabilityExceptions' })
  async getExceptions(
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('exceptionType', { type: () => ExceptionType, nullable: true }) exceptionType?: ExceptionType,
    @Args('startDate', { nullable: true }) startDateStr?: string,
    @Args('endDate', { nullable: true }) endDateStr?: string,
  ): Promise<AvailabilityException[]> {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    return this.exceptionService.findAll(operatorId, exceptionType, startDate, endDate);
  }

  @Query(() => AvailabilityException, { name: 'availabilityException', nullable: true })
  async getException(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityException> {
    return this.exceptionService.findOne(id);
  }

  @Query(() => [AvailabilityException], { name: 'operatorExceptions' })
  async getOperatorExceptions(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate', { nullable: true }) startDateStr?: string,
    @Args('endDate', { nullable: true }) endDateStr?: string,
  ): Promise<AvailabilityException[]> {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    return this.exceptionService.findByOperator(operatorId, startDate, endDate);
  }

  @Query(() => [HolidayInfo], { name: 'holidays' })
  async getHolidays(
    @Args('year', { type: () => Int }) year: number,
  ): Promise<HolidayInfo[]> {
    const holidays = this.holidayService.getHolidaysForYear(year);
    return holidays.map(h => ({ date: h.date, name: h.name }));
  }

  @Query(() => Boolean, { name: 'isHoliday' })
  async checkIsHoliday(
    @Args('date') dateStr: string,
  ): Promise<boolean> {
    const date = new Date(dateStr);
    return this.holidayService.isHoliday(date) !== null;
  }

  // Mutations
  @Mutation(() => AvailabilityException, { name: 'createException' })
  async createException(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('exceptionDate') exceptionDateStr: string,
    @Args('exceptionType', { type: () => ExceptionType }) exceptionType: ExceptionType,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('endTime', { nullable: true }) endTime?: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<AvailabilityException> {
    return this.exceptionService.create({
      operatorId,
      exceptionDate: new Date(exceptionDateStr),
      exceptionType,
      startTime,
      endTime,
      reason,
    });
  }

  @Mutation(() => [AvailabilityException], { name: 'createVacation' })
  async createVacation(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDateStr: string,
    @Args('endDate') endDateStr: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<AvailabilityException[]> {
    return this.exceptionService.createVacation(
      operatorId,
      new Date(startDateStr),
      new Date(endDateStr),
      reason,
    );
  }

  @Mutation(() => [AvailabilityException], { name: 'createSickLeave' })
  async createSickLeave(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDateStr: string,
    @Args('endDate') endDateStr: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<AvailabilityException[]> {
    return this.exceptionService.createSickLeave(
      operatorId,
      new Date(startDateStr),
      new Date(endDateStr),
      reason,
    );
  }

  @Mutation(() => AvailabilityException, { name: 'updateException' })
  async updateException(
    @Args('id', { type: () => ID }) id: string,
    @Args('exceptionType', { type: () => ExceptionType, nullable: true }) exceptionType?: ExceptionType,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('endTime', { nullable: true }) endTime?: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<AvailabilityException> {
    return this.exceptionService.update(id, {
      exceptionType,
      startTime,
      endTime,
      reason,
    });
  }

  @Mutation(() => Boolean, { name: 'deleteException' })
  async deleteException(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.exceptionService.delete(id);
  }

  @Mutation(() => Int, { name: 'deleteExceptionsByDateRange' })
  async deleteExceptionsByDateRange(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDateStr: string,
    @Args('endDate') endDateStr: string,
    @Args('exceptionType', { type: () => ExceptionType, nullable: true }) exceptionType?: ExceptionType,
  ): Promise<number> {
    return this.exceptionService.deleteByDateRange(
      operatorId,
      new Date(startDateStr),
      new Date(endDateStr),
      exceptionType,
    );
  }

  @Mutation(() => Int, { name: 'generateHolidaysForYear' })
  async generateHolidaysForYear(
    @Args('year', { type: () => Int }) year: number,
  ): Promise<number> {
    return this.holidayService.generateHolidaysForYear(year);
  }

  @Mutation(() => Int, { name: 'generateHolidaysForOperator' })
  async generateHolidaysForOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('year', { type: () => Int }) year: number,
  ): Promise<number> {
    return this.holidayService.generateHolidaysForOperator(operatorId, year);
  }

  @Mutation(() => Int, { name: 'deleteHolidaysForYear' })
  async deleteHolidaysForYear(
    @Args('year', { type: () => Int }) year: number,
  ): Promise<number> {
    return this.holidayService.deleteHolidaysForYear(year);
  }
}
