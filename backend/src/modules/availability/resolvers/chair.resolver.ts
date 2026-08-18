import { UseInterceptors } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Chair } from '../entities/chair.entity';
import { ChairService } from '../services/chair.service';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';

@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => Chair)
export class ChairResolver {
  constructor(private readonly chairService: ChairService) {}

  @Query(() => [Chair], { name: 'chairs' })
  async getChairs(
    @Args('roomId', { type: () => ID, nullable: true }) roomId?: string,
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive?: boolean,
  ): Promise<Chair[]> {
    return this.chairService.findAll(roomId, onlyActive);
  }

  @Query(() => Chair, { name: 'chair', nullable: true })
  async getChair(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Chair> {
    return this.chairService.findOne(id);
  }

  @Mutation(() => Chair, { name: 'createChair' })
  async createChair(
    @Args('roomId', { type: () => ID }) roomId: string,
    @Args('name') name: string,
    @Args('color', { nullable: true }) color?: string,
  ): Promise<Chair> {
    return this.chairService.create({ roomId, name, color });
  }

  @Mutation(() => Chair, { name: 'updateChair' })
  async updateChair(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('roomId', { type: () => ID, nullable: true }) roomId?: string,
  ): Promise<Chair> {
    return this.chairService.update(id, {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(isActive !== undefined && { isActive }),
      ...(roomId !== undefined && { roomId }),
    });
  }

  @Mutation(() => Boolean, { name: 'deleteChair' })
  async deleteChair(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.chairService.delete(id);
  }
}
