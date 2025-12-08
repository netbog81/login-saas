import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { GymRoom } from '../entities/gym-room.entity';
import { GymRoomService } from '../services/gym-room.service';

@Resolver(() => GymRoom)
export class GymRoomResolver {
  constructor(private readonly gymRoomService: GymRoomService) {}

  @Query(() => [GymRoom], { name: 'gymRooms' })
  async getGymRooms(
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive: boolean,
  ): Promise<GymRoom[]> {
    return this.gymRoomService.findAll(onlyActive);
  }

  @Query(() => GymRoom, { name: 'gymRoom', nullable: true })
  async getGymRoom(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<GymRoom> {
    return this.gymRoomService.findOne(id);
  }

  @Mutation(() => GymRoom, { name: 'createGymRoom' })
  async createGymRoom(
    @Args('name') name: string,
    @Args('maxCapacity', { type: () => Int, nullable: true }) maxCapacity?: number,
    @Args('slotDuration', { type: () => Int, nullable: true }) slotDuration?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('defaultStartTime', { nullable: true }) defaultStartTime?: string,
    @Args('defaultEndTime', { nullable: true }) defaultEndTime?: string,
  ): Promise<GymRoom> {
    return this.gymRoomService.create({
      name,
      maxCapacity,
      slotDuration,
      color,
      defaultStartTime,
      defaultEndTime,
    });
  }

  @Mutation(() => GymRoom, { name: 'updateGymRoom' })
  async updateGymRoom(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('maxCapacity', { type: () => Int, nullable: true }) maxCapacity?: number,
    @Args('slotDuration', { type: () => Int, nullable: true }) slotDuration?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('defaultStartTime', { nullable: true }) defaultStartTime?: string,
    @Args('defaultEndTime', { nullable: true }) defaultEndTime?: string,
  ): Promise<GymRoom> {
    return this.gymRoomService.update(id, {
      ...(name !== undefined && { name }),
      ...(maxCapacity !== undefined && { maxCapacity }),
      ...(slotDuration !== undefined && { slotDuration }),
      ...(color !== undefined && { color }),
      ...(isActive !== undefined && { isActive }),
      ...(defaultStartTime !== undefined && { defaultStartTime }),
      ...(defaultEndTime !== undefined && { defaultEndTime }),
    });
  }

  @Mutation(() => Boolean, { name: 'deleteGymRoom' })
  async deleteGymRoom(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.gymRoomService.delete(id);
  }
}
