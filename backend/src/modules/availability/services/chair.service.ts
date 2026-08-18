import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Chair } from '../entities/chair.entity';
import { Room } from '../entities/room.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { TemplateAssignmentRoomOverride } from '../entities/template-assignment-room-override.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class ChairService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get chairRepo() { return this.dataSource.getRepository(Chair); }

  private get roomRepo() { return this.dataSource.getRepository(Room); }

  private get assignmentRepo() { return this.dataSource.getRepository(TemplateAssignment); }

  private get overrideRepo() { return this.dataSource.getRepository(TemplateAssignmentRoomOverride); }

  async findAll(roomId?: string, onlyActive: boolean = false): Promise<Chair[]> {
    const where: any = {};
    if (roomId) where.roomId = roomId;
    if (onlyActive) where.isActive = true;
    return this.chairRepo.find({
      where,
      relations: ['room'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Chair> {
    const chair = await this.chairRepo.findOne({
      where: { id },
      relations: ['room'],
    });
    if (!chair) {
      throw new NotFoundException(`Chair with ID ${id} not found`);
    }
    return chair;
  }

  async create(data: {
    roomId: string;
    name: string;
    color?: string;
  }): Promise<Chair> {
    const room = await this.roomRepo.findOne({ where: { id: data.roomId } });
    if (!room) {
      throw new NotFoundException(`Room with ID ${data.roomId} not found`);
    }
    const chair = this.chairRepo.create({
      ...data,
      isActive: true,
    });
    const saved = await this.chairRepo.save(chair);
    return this.findOne(saved.id);
  }

  async update(
    id: string,
    data: Partial<Pick<Chair, 'name' | 'color' | 'isActive' | 'roomId'>>,
  ): Promise<Chair> {
    if (data.roomId) {
      const room = await this.roomRepo.findOne({ where: { id: data.roomId } });
      if (!room) {
        throw new NotFoundException(`Room with ID ${data.roomId} not found`);
      }
    }
    await this.chairRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const usedByAssignments = await this.assignmentRepo.count({
      where: { chairId: id },
    });
    const usedByOverrides = await this.overrideRepo.count({
      where: { chairId: id },
    });
    if (usedByAssignments + usedByOverrides > 0) {
      throw new BadRequestException(
        'La poltrona è utilizzata in assegnazioni template e non può essere eliminata. Disattivala invece.',
      );
    }
    const result = await this.chairRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
