import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { GymSchedule } from '../entities/gym-schedule.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class GymScheduleService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get scheduleRepo() { return this.dataSource.getRepository(GymSchedule); }

  async findAll(gymRoomId?: string, operatorId?: string): Promise<GymSchedule[]> {
    const where: any = {};
    if (gymRoomId) where.gymRoomId = gymRoomId;
    if (operatorId) where.operatorId = operatorId;

    return this.scheduleRepo.find({
      where,
      relations: ['gymRoom', 'operator'],
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async findOne(id: string): Promise<GymSchedule> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id },
      relations: ['gymRoom', 'operator'],
    });
    if (!schedule) {
      throw new NotFoundException(`GymSchedule with ID ${id} not found`);
    }
    return schedule;
  }

  async findByRoomAndDay(gymRoomId: string, dayOfWeek: number): Promise<GymSchedule[]> {
    return this.scheduleRepo.find({
      where: { gymRoomId, dayOfWeek, isCurrent: true },
      relations: ['operator'],
      order: { startTime: 'ASC' },
    });
  }

  async findOperatorAtTime(gymRoomId: string, dayOfWeek: number, time: string): Promise<GymSchedule | null> {
    const schedules = await this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.operator', 'operator')
      .where('schedule.gymRoomId = :gymRoomId', { gymRoomId })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .andWhere('schedule.isCurrent = :isCurrent', { isCurrent: true })
      .andWhere('schedule.startTime <= :time', { time })
      .andWhere('schedule.endTime > :time', { time })
      .getOne();

    return schedules;
  }

  async checkOverlap(
    gymRoomId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<GymSchedule[]> {
    const query = this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.operator', 'operator')
      .where('schedule.gymRoomId = :gymRoomId', { gymRoomId })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .andWhere('schedule.isCurrent = :isCurrent', { isCurrent: true })
      .andWhere(
        '(schedule.startTime < :endTime AND schedule.endTime > :startTime)',
        { startTime, endTime },
      );

    if (excludeId) {
      query.andWhere('schedule.id != :excludeId', { excludeId });
    }

    return query.getMany();
  }

  async create(data: {
    gymRoomId: string;
    operatorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    validFrom?: Date;
    validUntil?: Date;
  }): Promise<GymSchedule> {
    if (data.dayOfWeek < 0 || data.dayOfWeek > 6) {
      throw new BadRequestException('dayOfWeek must be between 0 and 6');
    }

    // Check for overlapping schedules
    const overlaps = await this.checkOverlap(
      data.gymRoomId,
      data.dayOfWeek,
      data.startTime,
      data.endTime,
    );

    if (overlaps.length > 0) {
      const overlapInfo = overlaps
        .map(o => `${o.operator?.name || 'Unknown'} (${o.startTime}-${o.endTime})`)
        .join(', ');
      throw new BadRequestException(
        `Schedule overlaps with existing schedules: ${overlapInfo}`,
      );
    }

    const schedule = this.scheduleRepo.create({
      ...data,
      isCurrent: true,
    });
    return this.scheduleRepo.save(schedule);
  }

  async update(
    id: string,
    data: Partial<Pick<GymSchedule, 'operatorId' | 'dayOfWeek' | 'startTime' | 'endTime' | 'validFrom' | 'validUntil' | 'isCurrent'>>,
  ): Promise<GymSchedule> {
    if (data.dayOfWeek !== undefined && (data.dayOfWeek < 0 || data.dayOfWeek > 6)) {
      throw new BadRequestException('dayOfWeek must be between 0 and 6');
    }

    // Check for overlapping schedules if time or day is changing
    if (data.dayOfWeek !== undefined || data.startTime !== undefined || data.endTime !== undefined) {
      const existing = await this.findOne(id);
      const checkDay = data.dayOfWeek ?? existing.dayOfWeek;
      const checkStart = data.startTime ?? existing.startTime;
      const checkEnd = data.endTime ?? existing.endTime;

      const overlaps = await this.checkOverlap(
        existing.gymRoomId,
        checkDay,
        checkStart,
        checkEnd,
        id, // exclude current schedule from overlap check
      );

      if (overlaps.length > 0) {
        const overlapInfo = overlaps
          .map(o => `${o.operator?.name || 'Unknown'} (${o.startTime}-${o.endTime})`)
          .join(', ');
        throw new BadRequestException(
          `Schedule overlaps with existing schedules: ${overlapInfo}`,
        );
      }
    }

    await this.scheduleRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.scheduleRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
