import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { TemplateAssignmentRoomOverride } from '../entities/template-assignment-room-override.entity';
import { AssignmentRoomOverrideInput } from '../dto/assign-template-to-operator.input';
import { RoomConflictService } from './room-conflict.service';
import { TenantContextService } from '@curandis/tenant-datasource';
import { toDateString } from '../utils/date-string.util';

/** Relazioni caricate su tutte le letture delle assegnazioni. */
const ASSIGNMENT_RELATIONS = [
  'operator',
  'patternGroup',
  'patternGroup.patterns',
  'room',
  'chair',
  'roomOverrides',
  'roomOverrides.room',
  'roomOverrides.chair',
];

@Injectable()
export class TemplateAssignmentService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly roomConflictService: RoomConflictService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get assignmentRepo() { return this.dataSource.getRepository(TemplateAssignment); }

  private get overrideRepo() { return this.dataSource.getRepository(TemplateAssignmentRoomOverride); }

  async findAll(operatorId?: string, onlyCurrent?: boolean): Promise<TemplateAssignment[]> {
    const where: any = {};
    if (operatorId) where.operatorId = operatorId;
    if (onlyCurrent) where.isCurrent = true;

    return this.assignmentRepo.find({
      where,
      relations: ASSIGNMENT_RELATIONS,
      order: { validFrom: 'DESC' },
    });
  }

  async findOne(id: string): Promise<TemplateAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id },
      relations: ASSIGNMENT_RELATIONS,
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
      relations: ASSIGNMENT_RELATIONS,
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

  /**
   * Assegnazioni non revocate (isCurrent=true) dello stesso operatore la cui
   * validità si sovrappone, a livello di giorno, al periodo indicato.
   * `validUntil = null` vale "senza scadenza". Le date sono 'YYYY-MM-DD'.
   */
  async findOverlapping(
    operatorId: string,
    validFrom: string,
    validUntil: string | null,
    excludeId?: string,
  ): Promise<TemplateAssignment[]> {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.patternGroup', 'patternGroup')
      .where('assignment.operatorId = :operatorId', { operatorId })
      .andWhere('assignment.isCurrent = true')
      .andWhere(
        '(assignment.validUntil IS NULL OR CAST(assignment.validUntil AS date) >= :validFrom)',
        { validFrom },
      );

    if (validUntil) {
      qb.andWhere('CAST(assignment.validFrom AS date) <= :validUntil', { validUntil });
    }
    if (excludeId) {
      qb.andWhere('assignment.id != :excludeId', { excludeId });
    }

    return qb.orderBy('assignment.validFrom', 'ASC').getMany();
  }

  /**
   * Errore uniforme di sovrapposizione validità, con l'elenco leggibile
   * delle assegnazioni in conflitto.
   */
  buildOverlapError(overlapping: TemplateAssignment[]): BadRequestException {
    const fmtIt = (value: Date | string) => {
      const [y, m, d] = toDateString(value).split('-');
      return `${d}/${m}/${y}`;
    };
    const list = overlapping
      .map((a) => {
        const until = a.validUntil ? fmtIt(a.validUntil) : 'senza scadenza';
        return `"${a.patternGroup?.name ?? 'template'}" (${fmtIt(a.validFrom)} → ${until})`;
      })
      .join(', ');
    return new BadRequestException(
      `Il periodo si sovrappone a un'assegnazione esistente: ${list}. ` +
        `Modifica o chiudi prima quell'assegnazione, oppure usa l'opzione "chiudi la precedente".`,
    );
  }

  async update(
    id: string,
    data: {
      validFrom?: Date;
      validUntil?: Date | null;
      patternStartDate?: Date;
      isCurrent?: boolean;
      roomId?: string | null;
      chairId?: string | null;
    },
  ): Promise<TemplateAssignment> {
    const assignment = await this.findOne(id);

    if (data.validFrom !== undefined) assignment.validFrom = data.validFrom;
    if (data.validUntil !== undefined) assignment.validUntil = data.validUntil as any;
    if (data.patternStartDate !== undefined) assignment.patternStartDate = data.patternStartDate;
    if (data.isCurrent !== undefined) assignment.isCurrent = data.isCurrent;
    if (data.roomId !== undefined) assignment.roomId = data.roomId as any;
    if (data.chairId !== undefined) assignment.chairId = data.chairId as any;
    if (data.roomId === null) assignment.chairId = null as any;

    const from = toDateString(assignment.validFrom);
    const until = assignment.validUntil ? toDateString(assignment.validUntil) : null;

    if (until && until < from) {
      throw new BadRequestException(
        'La data di fine validità non può precedere quella di inizio.',
      );
    }

    // La timeline dell'operatore non ammette validità sovrapposte tra
    // assegnazioni non revocate.
    if (assignment.isCurrent) {
      const overlapping = await this.findOverlapping(
        assignment.operatorId,
        from,
        until,
        assignment.id,
      );
      if (overlapping.length > 0) {
        throw this.buildOverlapError(overlapping);
      }

      // Validità o studio/poltrona cambiati: ricontrolla i conflitti di
      // occupazione con le assegnazioni degli altri operatori.
      const candidate = this.toRoomCandidate(assignment);
      await this.roomConflictService.validateRoomChairCoherence(candidate);
      const conflicts = await this.roomConflictService.validateAssignment(candidate, id);
      if (conflicts.blocking.length > 0) {
        throw new BadRequestException(
          `Conflitti di occupazione studi/poltrone:\n- ${conflicts.blocking.join('\n- ')}`,
        );
      }
    }

    // Le relazioni caricate non vanno risalvate (save cascata su roomOverrides
    // rigenererebbe le righe): si aggiornano solo le colonne.
    await this.assignmentRepo.update(id, {
      validFrom: assignment.validFrom,
      validUntil: assignment.validUntil ?? (null as any),
      patternStartDate: assignment.patternStartDate,
      isCurrent: assignment.isCurrent,
      roomId: assignment.roomId ?? (null as any),
      chairId: assignment.chairId ?? (null as any),
    });
    return this.findOne(id);
  }

  /**
   * Sostituisce integralmente gli override studio/poltrona di
   * un'assegnazione, dopo la validazione di coerenza e conflitti.
   */
  async setRoomOverrides(
    assignmentId: string,
    overrides: AssignmentRoomOverrideInput[],
  ): Promise<TemplateAssignment> {
    const assignment = await this.findOne(assignmentId);

    const candidate = {
      ...this.toRoomCandidate(assignment),
      roomOverrides: overrides.map((o) => ({
        dayInPattern: o.dayInPattern,
        startTime: o.startTime ?? null,
        endTime: o.endTime ?? null,
        roomId: o.roomId,
        chairId: o.chairId ?? null,
      })),
    };
    await this.roomConflictService.validateRoomChairCoherence(candidate);
    if (assignment.isCurrent) {
      const conflicts = await this.roomConflictService.validateAssignment(
        candidate,
        assignmentId,
      );
      if (conflicts.blocking.length > 0) {
        throw new BadRequestException(
          `Conflitti di occupazione studi/poltrone:\n- ${conflicts.blocking.join('\n- ')}`,
        );
      }
    }

    await this.overrideRepo.delete({ assignmentId });
    if (overrides.length > 0) {
      await this.overrideRepo.save(
        overrides.map((o) =>
          this.overrideRepo.create({
            assignmentId,
            dayInPattern: o.dayInPattern,
            startTime: o.startTime ?? undefined,
            endTime: o.endTime ?? undefined,
            roomId: o.roomId,
            chairId: o.chairId ?? undefined,
          }),
        ),
      );
    }

    return this.findOne(assignmentId);
  }

  private toRoomCandidate(assignment: TemplateAssignment) {
    return {
      operatorId: assignment.operatorId,
      patternStartDate: new Date(assignment.patternStartDate),
      validFrom: new Date(assignment.validFrom),
      validUntil: assignment.validUntil ? new Date(assignment.validUntil) : null,
      roomId: assignment.roomId ?? null,
      chairId: assignment.chairId ?? null,
      patternGroup: assignment.patternGroup,
      roomOverrides: (assignment.roomOverrides ?? []).map((o) => ({
        dayInPattern: o.dayInPattern,
        startTime: o.startTime ?? null,
        endTime: o.endTime ?? null,
        roomId: o.roomId,
        chairId: o.chairId ?? null,
      })),
    };
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
