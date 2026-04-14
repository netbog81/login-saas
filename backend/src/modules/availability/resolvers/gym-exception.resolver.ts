import { Resolver, Query, Mutation, Args, ID, Context, ObjectType, Field } from '@nestjs/graphql';
import { GymException } from '../entities/gym-exception.entity';
import { GymRoom } from '../entities/gym-room.entity';
import { Operator } from '../entities/operator.entity';
import { GymExceptionService } from '../services/gym-exception.service';
import { GymPatternGroupService } from '../services/gym-pattern-group.service';
import {
  CreateGymExceptionInput,
  UpdateGymExceptionInput,
} from '../dto/gym-exception.input';

/**
 * Rappresenta uno slot di disponibilità di un operatore in una palestra in
 * un giorno specifico. Usato dal frontend per popolare la griglia nel modal
 * di creazione eccezione (sostituzione per slot).
 */
@ObjectType()
export class OperatorSlotOnDate {
  @Field(() => GymRoom)
  gymRoom: GymRoom;

  @Field()
  startTime: string;

  @Field()
  endTime: string;
}

@Resolver(() => GymException)
export class GymExceptionResolver {
  constructor(
    private readonly gymExceptionService: GymExceptionService,
    private readonly gymPatternGroupService: GymPatternGroupService,
  ) {}

  /**
   * Eccezioni rilevanti per una palestra in un range di date
   * (include sia scoped sia operator-wide applicabili).
   */
  @Query(() => [GymException], { name: 'gymExceptions' })
  async findByDateRange(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ): Promise<GymException[]> {
    return this.gymExceptionService.findByDateRange(
      gymRoomId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  /**
   * Eccezioni rilevanti per una palestra in una data specifica.
   */
  @Query(() => [GymException], { name: 'gymExceptionsByDate' })
  async findByDate(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('date') date: string,
  ): Promise<GymException[]> {
    return this.gymExceptionService.findByDate(gymRoomId, new Date(date));
  }

  @Query(() => GymException, { name: 'gymException', nullable: true })
  async findOne(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GymException> {
    return this.gymExceptionService.findOne(id);
  }

  /**
   * Lista gli slot (palestra + fascia oraria) in cui un operatore era
   * schedulato in una data specifica, derivandoli dai GymTemplatePattern
   * correnti. Usato dal modal "Nuova eccezione" per popolare la griglia
   * delle caselle di sostituzione.
   */
  @Query(() => [OperatorSlotOnDate], { name: 'operatorPatternsOnDate' })
  async operatorPatternsOnDate(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('date') date: string,
  ): Promise<OperatorSlotOnDate[]> {
    const patterns = await this.gymPatternGroupService.getOperatorPatternsOnDate(
      operatorId,
      new Date(date),
    );
    return patterns.map((p) => ({
      gymRoom: p.gymRoom,
      startTime: p.pattern.startTime,
      endTime: p.pattern.endTime,
    }));
  }

  /**
   * Lista gli operatori GYM_INSTRUCTOR "liberi" in una fascia oraria di una
   * palestra: non hanno pattern che si sovrappone (in qualunque gym) né
   * eccezione OPERATOR_ABSENT attiva in quella fascia.
   */
  @Query(() => [Operator], { name: 'availableOperatorsForSlot' })
  async availableOperatorsForSlot(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('date') date: string,
    @Args('startTime') startTime: string,
    @Args('endTime') endTime: string,
    @Args('excludeOperatorId', { type: () => ID }) excludeOperatorId: string,
  ): Promise<Operator[]> {
    return this.gymExceptionService.findAvailableOperatorsForSlot(
      gymRoomId,
      new Date(date),
      startTime,
      endTime,
      excludeOperatorId,
    );
  }

  @Mutation(() => GymException)
  async createGymException(
    @Args('input') input: CreateGymExceptionInput,
    @Context() context: any,
  ): Promise<GymException> {
    const userId = context?.req?.user?.id || context?.req?.tenantContext?.userId;

    return this.gymExceptionService.create({
      gymRoomId: input.gymRoomId,
      operatorId: input.operatorId,
      exceptionDate: new Date(input.exceptionDate),
      startTime: input.startTime,
      endTime: input.endTime,
      exceptionType: input.exceptionType,
      substituteOperatorId: input.substituteOperatorId,
      substitutes: input.substitutes,
      absenceTypeId: input.absenceTypeId,
      reason: input.reason,
      createdBy: userId,
    });
  }

  @Mutation(() => GymException)
  async updateGymException(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateGymExceptionInput,
  ): Promise<GymException> {
    return this.gymExceptionService.update(id, {
      gymRoomId: input.gymRoomId,
      operatorId: input.operatorId,
      exceptionDate: input.exceptionDate ? new Date(input.exceptionDate) : undefined,
      startTime: input.startTime,
      endTime: input.endTime,
      exceptionType: input.exceptionType,
      substituteOperatorId: input.substituteOperatorId,
      substitutes: input.substitutes,
      absenceTypeId: input.absenceTypeId,
      reason: input.reason,
    });
  }

  @Mutation(() => Boolean)
  async deleteGymException(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.gymExceptionService.delete(id);
  }
}
