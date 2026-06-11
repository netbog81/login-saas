import { Injectable, NotFoundException } from '@nestjs/common';
import { Room } from '../entities/room.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class RoomService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get roomRepo() { return this.dataSource.getRepository(Room); }

  async findAll(onlyActive: boolean = false): Promise<Room[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.roomRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomRepo.findOne({
      where: { id },
    });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }
    return room;
  }

  async create(data: {
    name: string;
    capacity?: number;
    color?: string;
  }): Promise<Room> {
    const room = this.roomRepo.create({
      ...data,
      capacity: data.capacity ?? 1,
      isActive: true,
    });
    return this.roomRepo.save(room);
  }

  async update(
    id: string,
    data: Partial<Pick<Room, 'name' | 'capacity' | 'color' | 'isActive'>>,
  ): Promise<Room> {
    await this.roomRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.roomRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
