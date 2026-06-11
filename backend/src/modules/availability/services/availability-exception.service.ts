import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AvailabilityException, ExceptionType } from '../entities/availability-exception.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class AvailabilityExceptionService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get exceptionRepo() { return this.dataSource.getRepository(AvailabilityException); }

  async findAll(
    operatorId?: string,
    exceptionType?: ExceptionType,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AvailabilityException[]> {
    const query = this.exceptionRepo.createQueryBuilder('exception')
      .leftJoinAndSelect('exception.operator', 'operator')
      .leftJoinAndSelect('exception.groupException', 'groupException');

    if (operatorId) {
      query.andWhere('exception.operatorId = :operatorId', { operatorId });
    }

    if (exceptionType) {
      query.andWhere('exception.exceptionType = :exceptionType', { exceptionType });
    }

    if (startDate) {
      query.andWhere('exception.exceptionDate >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('exception.exceptionDate <= :endDate', { endDate });
    }

    return query.orderBy('exception.exceptionDate', 'ASC').getMany();
  }

  async findOne(id: string): Promise<AvailabilityException> {
    const exception = await this.exceptionRepo.findOne({
      where: { id },
      relations: ['operator', 'groupException'],
    });

    if (!exception) {
      throw new NotFoundException(`Exception with ID ${id} not found`);
    }

    return exception;
  }

  async findByOperator(
    operatorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AvailabilityException[]> {
    const query = this.exceptionRepo.createQueryBuilder('exception')
      .leftJoinAndSelect('exception.groupException', 'groupException')
      .where('exception.operatorId = :operatorId', { operatorId });

    if (startDate) {
      query.andWhere('exception.exceptionDate >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('exception.exceptionDate <= :endDate', { endDate });
    }

    return query.orderBy('exception.exceptionDate', 'ASC').getMany();
  }

  async findByDate(date: Date, operatorId?: string): Promise<AvailabilityException[]> {
    const where: any = { exceptionDate: date };
    if (operatorId) where.operatorId = operatorId;

    return this.exceptionRepo.find({
      where,
      relations: ['operator'],
    });
  }

  async create(data: {
    operatorId: string;
    exceptionDate: Date;
    exceptionType: ExceptionType;
    startTime?: string;
    endTime?: string;
    reason?: string;
    groupExceptionId?: string;
  }): Promise<AvailabilityException> {
    // Check if exception already exists for this operator and date
    const existing = await this.exceptionRepo.findOne({
      where: {
        operatorId: data.operatorId,
        exceptionDate: data.exceptionDate,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Eccezione già esistente per questo operatore in data ${data.exceptionDate.toISOString().split('T')[0]}`,
      );
    }

    const exception = this.exceptionRepo.create(data);
    return this.exceptionRepo.save(exception);
  }

  async createVacation(
    operatorId: string,
    startDate: Date,
    endDate: Date,
    reason?: string,
  ): Promise<AvailabilityException[]> {
    const exceptions: AvailabilityException[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      try {
        const exception = await this.create({
          operatorId,
          exceptionDate: new Date(currentDate),
          exceptionType: ExceptionType.VACATION,
          reason: reason || 'Ferie',
        });
        exceptions.push(exception);
      } catch (e) {
        // Skip if already exists
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return exceptions;
  }

  async createSickLeave(
    operatorId: string,
    startDate: Date,
    endDate: Date,
    reason?: string,
  ): Promise<AvailabilityException[]> {
    const exceptions: AvailabilityException[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      try {
        const exception = await this.create({
          operatorId,
          exceptionDate: new Date(currentDate),
          exceptionType: ExceptionType.SICK,
          reason: reason || 'Malattia',
        });
        exceptions.push(exception);
      } catch (e) {
        // Skip if already exists
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return exceptions;
  }

  async update(
    id: string,
    data: {
      exceptionType?: ExceptionType;
      startTime?: string;
      endTime?: string;
      reason?: string;
    },
  ): Promise<AvailabilityException> {
    const exception = await this.findOne(id);

    if (data.exceptionType !== undefined) exception.exceptionType = data.exceptionType;
    if (data.startTime !== undefined) exception.startTime = data.startTime;
    if (data.endTime !== undefined) exception.endTime = data.endTime;
    if (data.reason !== undefined) exception.reason = data.reason;

    return this.exceptionRepo.save(exception);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.exceptionRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async deleteByDateRange(
    operatorId: string,
    startDate: Date,
    endDate: Date,
    exceptionType?: ExceptionType,
  ): Promise<number> {
    const query = this.exceptionRepo.createQueryBuilder()
      .delete()
      .where('operatorId = :operatorId', { operatorId })
      .andWhere('exceptionDate >= :startDate', { startDate })
      .andWhere('exceptionDate <= :endDate', { endDate });

    if (exceptionType) {
      query.andWhere('exceptionType = :exceptionType', { exceptionType });
    }

    const result = await query.execute();
    return result.affected || 0;
  }

  async hasException(operatorId: string, date: Date): Promise<AvailabilityException | null> {
    return this.exceptionRepo.findOne({
      where: { operatorId, exceptionDate: date },
    });
  }
}
