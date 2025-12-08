import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GymRoom } from '../entities/gym-room.entity';

@Injectable()
export class GymRoomService {
  constructor(
    @InjectRepository(GymRoom)
    private gymRoomRepo: Repository<GymRoom>,
  ) {}

  async findAll(onlyActive: boolean = false): Promise<GymRoom[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.gymRoomRepo.find({
      where,
      relations: ['schedules', 'schedules.operator'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<GymRoom> {
    const room = await this.gymRoomRepo.findOne({
      where: { id },
      relations: ['schedules', 'schedules.operator'],
    });
    if (!room) {
      throw new NotFoundException(`GymRoom with ID ${id} not found`);
    }
    return room;
  }

  async create(data: {
    name: string;
    maxCapacity?: number;
    slotDuration?: number;
    color?: string;
    defaultStartTime?: string;
    defaultEndTime?: string;
  }): Promise<GymRoom> {
    const room = this.gymRoomRepo.create({
      ...data,
      maxCapacity: data.maxCapacity ?? 4,
      slotDuration: data.slotDuration ?? 60,
      isActive: true,
    });
    return this.gymRoomRepo.save(room);
  }

  async update(
    id: string,
    data: Partial<Pick<GymRoom, 'name' | 'maxCapacity' | 'slotDuration' | 'color' | 'isActive' | 'defaultStartTime' | 'defaultEndTime'>>,
  ): Promise<GymRoom> {
    await this.gymRoomRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.gymRoomRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
