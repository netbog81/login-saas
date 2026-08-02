import { UseInterceptors } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { GymPatternGroup } from '../entities/gym-pattern-group.entity';
import { GymPatternGroupService } from '../services/gym-pattern-group.service';
import { CreateGymPatternGroupInput, UpdateGymPatternGroupInput } from '../dto/gym-pattern-group.input';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';

@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => GymPatternGroup)
export class GymPatternGroupResolver {
  constructor(
    private readonly gymPatternGroupService: GymPatternGroupService,
  ) {}

  /**
   * Recupera tutti i template palestra, opzionalmente filtrati per palestra
   */
  @Query(() => [GymPatternGroup], { name: 'gymPatternGroups' })
  async findAll(
    @Args('gymRoomId', { type: () => ID, nullable: true }) gymRoomId?: string,
  ): Promise<GymPatternGroup[]> {
    return this.gymPatternGroupService.findAll(gymRoomId);
  }

  /**
   * Recupera un template per ID
   */
  @Query(() => GymPatternGroup, { name: 'gymPatternGroup', nullable: true })
  async findOne(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GymPatternGroup> {
    return this.gymPatternGroupService.findOne(id);
  }

  /**
   * Recupera il template corrente per una palestra
   */
  @Query(() => GymPatternGroup, { name: 'currentGymPatternGroup', nullable: true })
  async findCurrentByGymRoom(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
  ): Promise<GymPatternGroup | null> {
    return this.gymPatternGroupService.findCurrentByGymRoom(gymRoomId);
  }

  /**
   * Crea un nuovo template palestra
   */
  @Mutation(() => GymPatternGroup)
  async createGymPatternGroup(
    @Args('input') input: CreateGymPatternGroupInput,
  ): Promise<GymPatternGroup> {
    return this.gymPatternGroupService.create({
      gymRoomId: input.gymRoomId,
      name: input.name,
      description: input.description,
      patternDuration: input.patternDuration || 7,
      patternStartDate: new Date(input.patternStartDate),
      validFrom: new Date(input.validFrom),
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      patterns: input.patterns,
    });
  }

  /**
   * Aggiorna un template palestra esistente
   */
  @Mutation(() => GymPatternGroup)
  async updateGymPatternGroup(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateGymPatternGroupInput,
  ): Promise<GymPatternGroup> {
    return this.gymPatternGroupService.update(id, {
      name: input.name,
      description: input.description,
      patternDuration: input.patternDuration,
      patternStartDate: input.patternStartDate ? new Date(input.patternStartDate) : undefined,
      validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      isActive: input.isActive,
      patterns: input.patterns,
    });
  }

  /**
   * Elimina un template palestra
   */
  @Mutation(() => Boolean)
  async deleteGymPatternGroup(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.gymPatternGroupService.delete(id);
  }

  /**
   * Attiva un template palestra (e disattiva gli altri per la stessa palestra)
   */
  @Mutation(() => GymPatternGroup)
  async activateGymPatternGroup(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GymPatternGroup> {
    return this.gymPatternGroupService.activate(id);
  }

  /**
   * Disattiva un template palestra
   */
  @Mutation(() => GymPatternGroup)
  async deactivateGymPatternGroup(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GymPatternGroup> {
    return this.gymPatternGroupService.deactivate(id);
  }

  /**
   * Duplica un template palestra
   */
  @Mutation(() => GymPatternGroup)
  async duplicateGymPatternGroup(
    @Args('id', { type: () => ID }) id: string,
    @Args('newName') newName: string,
  ): Promise<GymPatternGroup> {
    return this.gymPatternGroupService.duplicate(id, newName);
  }
}
