import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { GymException } from '../entities/gym-exception.entity';
import { GymExceptionService } from '../services/gym-exception.service';
import { CreateGymExceptionInput, UpdateGymExceptionInput } from '../dto/gym-exception.input';

@Resolver(() => GymException)
export class GymExceptionResolver {
  constructor(
    private readonly gymExceptionService: GymExceptionService,
  ) {}

  /**
   * Recupera le eccezioni per una palestra in un range di date
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
   * Recupera le eccezioni per una palestra in una data specifica
   */
  @Query(() => [GymException], { name: 'gymExceptionsByDate' })
  async findByDate(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('date') date: string,
  ): Promise<GymException[]> {
    return this.gymExceptionService.findByDate(gymRoomId, new Date(date));
  }

  /**
   * Recupera un'eccezione per ID
   */
  @Query(() => GymException, { name: 'gymException', nullable: true })
  async findOne(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GymException> {
    return this.gymExceptionService.findOne(id);
  }

  /**
   * Crea una nuova eccezione per la palestra
   */
  @Mutation(() => GymException)
  async createGymException(
    @Args('input') input: CreateGymExceptionInput,
    @Context() context: any,
  ): Promise<GymException> {
    // Ottieni l'ID dell'utente dal contesto se disponibile
    const userId = context?.req?.user?.id;

    return this.gymExceptionService.create({
      gymRoomId: input.gymRoomId,
      operatorId: input.operatorId,
      exceptionDate: new Date(input.exceptionDate),
      startTime: input.startTime,
      endTime: input.endTime,
      exceptionType: input.exceptionType,
      substituteOperatorId: input.substituteOperatorId,
      reason: input.reason,
      createdBy: userId,
    });
  }

  /**
   * Aggiorna un'eccezione esistente
   */
  @Mutation(() => GymException)
  async updateGymException(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateGymExceptionInput,
  ): Promise<GymException> {
    return this.gymExceptionService.update(id, {
      operatorId: input.operatorId,
      exceptionDate: input.exceptionDate ? new Date(input.exceptionDate) : undefined,
      startTime: input.startTime,
      endTime: input.endTime,
      exceptionType: input.exceptionType,
      substituteOperatorId: input.substituteOperatorId,
      reason: input.reason,
    });
  }

  /**
   * Elimina un'eccezione
   */
  @Mutation(() => Boolean)
  async deleteGymException(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.gymExceptionService.delete(id);
  }
}
