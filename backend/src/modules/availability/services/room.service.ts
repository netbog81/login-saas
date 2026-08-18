import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Room } from '../entities/room.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { TemplateAssignmentRoomOverride } from '../entities/template-assignment-room-override.entity';
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

  private get assignmentRepo() { return this.dataSource.getRepository(TemplateAssignment); }

  private get overrideRepo() { return this.dataSource.getRepository(TemplateAssignmentRoomOverride); }

  async findAll(onlyActive: boolean = false): Promise<Room[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.roomRepo.find({
      where,
      relations: ['chairs'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomRepo.findOne({
      where: { id },
      relations: ['chairs'],
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
    // Uno studio referenziato da assegnazioni template (default o override)
    // non si può eliminare: le sue poltrone andrebbero in cascata e i vincoli
    // RESTRICT farebbero comunque fallire la DELETE con un errore criptico.
    const usedByAssignments = await this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoin('assignment.chair', 'chair')
      .where('assignment.roomId = :id OR chair.roomId = :id', { id })
      .getCount();
    const usedByOverrides = await this.overrideRepo
      .createQueryBuilder('o')
      .leftJoin('o.chair', 'chair')
      .where('o.roomId = :id OR chair.roomId = :id', { id })
      .getCount();
    if (usedByAssignments + usedByOverrides > 0) {
      throw new BadRequestException(
        'Lo studio è utilizzato in assegnazioni template e non può essere eliminato. Disattivalo invece.',
      );
    }
    const result = await this.roomRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
