import { Injectable, NotFoundException } from '@nestjs/common';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class TemplateAssignmentService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get assignmentRepo() { return this.dataSource.getRepository(TemplateAssignment); }

  async findAll(operatorId?: string, onlyCurrent?: boolean): Promise<TemplateAssignment[]> {
    const where: any = {};
    if (operatorId) where.operatorId = operatorId;
    if (onlyCurrent) where.isCurrent = true;

    return this.assignmentRepo.find({
      where,
      relations: ['operator', 'patternGroup', 'patternGroup.patterns'],
      order: { validFrom: 'DESC' },
    });
  }

  async findOne(id: string): Promise<TemplateAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: ['operator', 'patternGroup', 'patternGroup.patterns'],
    });

    if (!assignment) {
      throw new NotFoundException(`TemplateAssignment with ID ${id} not found`);
    }

    return assignment;
  }

  async findByOperator(operatorId: string, onlyCurrent = true): Promise<TemplateAssignment[]> {
    const where: any = { operatorId };
    if (onlyCurrent) where.isCurrent = true;

    return this.assignmentRepo.find({
      where,
      relations: ['patternGroup', 'patternGroup.patterns'],
      order: { validFrom: 'DESC' },
    });
  }

  async findCurrentByOperator(operatorId: string, date: Date): Promise<TemplateAssignment[]> {
    return this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.patternGroup', 'patternGroup')
      .leftJoinAndSelect('patternGroup.patterns', 'patterns')
      .where('assignment.operatorId = :operatorId', { operatorId })
      .andWhere('assignment.isCurrent = true')
      .andWhere('assignment.validFrom <= :date', { date })
      .andWhere('(assignment.validUntil IS NULL OR assignment.validUntil >= :date)', { date })
      .orderBy('assignment.validFrom', 'DESC')
      .getMany();
  }

  async update(
    id: string,
    data: {
      validFrom?: Date;
      validUntil?: Date;
      patternStartDate?: Date;
      isCurrent?: boolean;
    },
  ): Promise<TemplateAssignment> {
    const assignment = await this.findOne(id);

    if (data.validFrom !== undefined) assignment.validFrom = data.validFrom;
    if (data.validUntil !== undefined) assignment.validUntil = data.validUntil;
    if (data.patternStartDate !== undefined) assignment.patternStartDate = data.patternStartDate;
    if (data.isCurrent !== undefined) assignment.isCurrent = data.isCurrent;

    return this.assignmentRepo.save(assignment);
  }

  async deactivate(id: string): Promise<TemplateAssignment> {
    return this.update(id, { isCurrent: false });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.assignmentRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async deactivateAllForOperator(operatorId: string): Promise<void> {
    await this.assignmentRepo.update(
      { operatorId, isCurrent: true },
      { isCurrent: false },
    );
  }
}
