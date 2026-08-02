import { UseInterceptors } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { Room } from '../entities/room.entity';
import { RoomService } from '../services/room.service';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';

@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => Room)
export class RoomResolver {
  constructor(private readonly roomService: RoomService) {}

  @Query(() => [Room], { name: 'rooms' })
  async getRooms(
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive: boolean,
  ): Promise<Room[]> {
    return this.roomService.findAll(onlyActive);
  }

  @Query(() => Room, { name: 'room', nullable: true })
  async getRoom(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Room> {
    return this.roomService.findOne(id);
  }

  @Mutation(() => Room, { name: 'createRoom' })
  async createRoom(
    @Args('name') name: string,
    @Args('capacity', { type: () => Int, nullable: true }) capacity?: number,
    @Args('color', { nullable: true }) color?: string,
  ): Promise<Room> {
    return this.roomService.create({
      name,
      capacity,
      color,
    });
  }

  @Mutation(() => Room, { name: 'updateRoom' })
  async updateRoom(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('capacity', { type: () => Int, nullable: true }) capacity?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<Room> {
    return this.roomService.update(id, {
      ...(name !== undefined && { name }),
      ...(capacity !== undefined && { capacity }),
      ...(color !== undefined && { color }),
      ...(isActive !== undefined && { isActive }),
    });
  }

  @Mutation(() => Boolean, { name: 'deleteRoom' })
  async deleteRoom(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.roomService.delete(id);
  }
}
