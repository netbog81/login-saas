import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AvailabilityException, ExceptionType } from '../entities/availability-exception.entity';
import {
  AvailabilityAppointment,
  BookingStatus,
} from '../entities/availability-appointment.entity';
import { Treatment } from '../entities/treatment.entity';
import { AbsenceTypeSnapshot } from '../entities/gym-exception.entity';
import { OperatorAbsenceTypeService } from './operator-absence-type.service';
import { AppointmentConflictService } from './appointment-conflict.service';
import { TenantContextService } from '@curandis/tenant-datasource';
import { toDateString } from '../utils/date-string.util';

/** Input della creazione batch di assenze operatori/medici. */
export interface CreateOperatorAbsencesData {
  operatorIds: string[];
  /** YYYY-MM-DD */
  dateFrom: string;
  /** YYYY-MM-DD (uguale a dateFrom per giorno singolo) */
  dateTo: string;
  /** HH:MM — se assenti entrambi = giornata intera */
  startTime?: string;
  endTime?: string;
  absenceTypeId?: string;
  reason?: string;
  performedBy?: string;
}

export interface OperatorAbsencesResult {
  exceptions: AvailabilityException[];
  conflictCount: number;
  /** Combinazioni operatore+giorno saltate perché già coperte da un'eccezione sovrapposta. */
  skippedOverlaps: number;
  sourceGroupId: string;
}

export interface AbsenceImpactPreview {
  /** Appuntamenti SCHEDULED/CONFIRMED che finirebbero in conflitto. */
  conflicts: AvailabilityAppointment[];
  /**
   * Appuntamenti già ATTENDED nella finestra ma SENZA trattamento aperto
   * (caso "auto-attendance scattata pochi minuti fa"): non diventano
   * conflitti, ma la segreteria deve valutarli manualmente (annullo, ecc.).
   */
  attendedWithoutTreatment: AvailabilityAppointment[];
}

@Injectable()
export class AvailabilityExceptionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly absenceTypeService: OperatorAbsenceTypeService,
    private readonly conflictService: AppointmentConflictService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get exceptionRepo() { return this.dataSource.getRepository(AvailabilityException); }

  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }

  private get treatmentRepo() { return this.dataSource.getRepository(Treatment); }

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
    absenceTypeId?: string;
    absenceTypeSnapshot?: AbsenceTypeSnapshot;
    sourceGroupId?: string;
  }): Promise<AvailabilityException> {
    // Anti-sovrapposizione: più eccezioni nello stesso giorno sono ammesse
    // (granularità a fascia/slot) purché le finestre non si sovrappongano.
    // Un'eccezione giornata-intera (senza orari) è incompatibile con
    // qualsiasi altra dello stesso giorno.
    const overlapping = await this.findOverlappingException(
      data.operatorId,
      data.exceptionDate,
      data.startTime,
      data.endTime,
    );
    if (overlapping) {
      const fascia =
        overlapping.startTime && overlapping.endTime
          ? `${overlapping.startTime}-${overlapping.endTime}`
          : 'giornata intera';
      throw new BadRequestException(
        `Esiste già un'eccezione sovrapposta per questo operatore in questa data (${fascia})`,
      );
    }

    // Normalizza a 'YYYY-MM-DD': il campo GraphQL è String e l'entity
    // restituita da save() conserva il valore passato qui (le query
    // ricevono comunque la stringa dall'idratazione TypeORM).
    const exception = this.exceptionRepo.create({
      ...data,
      exceptionDate: toDateString(data.exceptionDate) as unknown as Date,
    });
    return this.exceptionRepo.save(exception);
  }

  /**
   * Prima eccezione esistente che si sovrappone alla finestra richiesta
   * per (operatorId, date). NULL se non ci sono sovrapposizioni.
   */
  private async findOverlappingException(
    operatorId: string,
    date: Date,
    startTime?: string,
    endTime?: string,
  ): Promise<AvailabilityException | null> {
    const sameDay = await this.exceptionRepo.find({
      where: { operatorId, exceptionDate: date },
    });
    for (const ex of sameDay) {
      const exWholeDay = !ex.startTime || !ex.endTime;
      const reqWholeDay = !startTime || !endTime;
      if (exWholeDay || reqWholeDay) return ex;
      if (
        this.normalizeTime(startTime!) < this.normalizeTime(ex.endTime!) &&
        this.normalizeTime(ex.startTime!) < this.normalizeTime(endTime!)
      ) {
        return ex;
      }
    }
    return null;
  }

  /** Normalizza "HH:MM:SS" / "H:M" a "HH:MM" per confronti omogenei. */
  private normalizeTime(time: string): string {
    const parts = time.split(':');
    return `${parts[0].padStart(2, '0')}:${(parts[1] ?? '00').padStart(2, '0')}`;
  }

  // ==================== ASSENZE OPERATORI/MEDICI (batch) ====================

  /**
   * Crea le assenze per più operatori su un range di giorni (o giorno
   * singolo), con finestra oraria opzionale, e MARCA I CONFLITTI sugli
   * appuntamenti impattati (via AppointmentConflictService, con
   * conflictSourceExceptionId per il ripristino chirurgico).
   *
   * Le combinazioni operatore+giorno già coperte da un'eccezione
   * sovrapposta vengono saltate e conteggiate in skippedOverlaps.
   */
  async createOperatorAbsences(
    data: CreateOperatorAbsencesData,
  ): Promise<OperatorAbsencesResult> {
    if (!data.operatorIds || data.operatorIds.length === 0) {
      throw new BadRequestException('Selezionare almeno un operatore');
    }
    if (!data.dateFrom || !data.dateTo || data.dateFrom > data.dateTo) {
      throw new BadRequestException('Intervallo di date non valido');
    }
    const hasWindow = !!data.startTime || !!data.endTime;
    if (hasWindow) {
      if (!data.startTime || !data.endTime) {
        throw new BadRequestException('Indicare sia ora inizio sia ora fine (o nessuna delle due)');
      }
      if (this.normalizeTime(data.startTime) >= this.normalizeTime(data.endTime)) {
        throw new BadRequestException('L\'ora di inizio deve precedere l\'ora di fine');
      }
    }

    const days = this.enumerateDays(data.dateFrom, data.dateTo);
    if (days.length > 92) {
      throw new BadRequestException('Il range massimo è di 92 giorni');
    }

    // Tipo di assenza → snapshot + ExceptionType (stesso mapping palestra)
    let absenceTypeSnapshot: AbsenceTypeSnapshot | undefined;
    if (data.absenceTypeId) {
      const absenceType = await this.absenceTypeService.findOneOrNull(data.absenceTypeId);
      if (absenceType) {
        absenceTypeSnapshot = {
          id: absenceType.id,
          name: absenceType.name,
          description: absenceType.description,
        };
      }
    }
    const exceptionType = this.mapAbsenceNameToExceptionType(absenceTypeSnapshot?.name);

    const sourceGroupId = uuidv4();
    const created: AvailabilityException[] = [];
    let conflictCount = 0;
    let skippedOverlaps = 0;

    for (const operatorId of data.operatorIds) {
      for (const day of days) {
        const exceptionDate = new Date(day);

        const overlapping = await this.findOverlappingException(
          operatorId,
          exceptionDate,
          data.startTime,
          data.endTime,
        );
        if (overlapping) {
          skippedOverlaps++;
          continue;
        }

        const saved = await this.exceptionRepo.save(
          this.exceptionRepo.create({
            operatorId,
            exceptionDate,
            exceptionType,
            startTime: data.startTime,
            endTime: data.endTime,
            reason: data.reason || absenceTypeSnapshot?.name,
            absenceTypeId: data.absenceTypeId,
            absenceTypeSnapshot,
            sourceGroupId,
          }),
        );
        created.push(saved);

        const check = await this.conflictService.checkConflictsOnException(
          operatorId,
          exceptionDate,
          exceptionType,
          saved.id,
          data.startTime,
          data.endTime,
        );
        if (check.hasConflicts) {
          await this.conflictService.markExceptionConflicts(
            check.conflicts,
            exceptionType,
            data.performedBy,
            saved.id,
          );
          conflictCount += check.totalCount;
        }
      }
    }

    // Ricarica con la relazione operator: il resolver espone operator nel
    // payload di risposta e le entity appena salvate non la avrebbero.
    const createdWithRelations =
      created.length > 0
        ? await this.exceptionRepo.find({
            where: { id: In(created.map((e) => e.id)) },
            relations: ['operator'],
            order: { exceptionDate: 'ASC' },
          })
        : [];

    return {
      exceptions: createdWithRelations,
      conflictCount,
      skippedOverlaps,
      sourceGroupId,
    };
  }

  /**
   * Anteprima (dry-run) degli appuntamenti impattati da un'assenza, PRIMA
   * del salvataggio. Non modifica nulla.
   */
  async previewAbsenceImpact(params: {
    operatorIds: string[];
    dateFrom: string;
    dateTo: string;
    startTime?: string;
    endTime?: string;
  }): Promise<AbsenceImpactPreview> {
    if (!params.operatorIds || params.operatorIds.length === 0) {
      return { conflicts: [], attendedWithoutTreatment: [] };
    }

    const buildQuery = (statuses: BookingStatus[]) => {
      const qb = this.appointmentRepo
        .createQueryBuilder('apt')
        .leftJoinAndSelect('apt.operator', 'operator')
        .leftJoinAndSelect('apt.service', 'service')
        .where('apt.operatorId IN (:...operatorIds)', { operatorIds: params.operatorIds })
        .andWhere('apt.appointmentDate BETWEEN :dateFrom AND :dateTo', {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        })
        .andWhere('apt.bookingStatus IN (:...statuses)', { statuses })
        .andWhere('apt.nonRetribuito IS NOT TRUE');
      if (params.startTime && params.endTime) {
        qb.andWhere('(apt.startTime < :endTime AND apt.endTime > :startTime)', {
          startTime: params.startTime,
          endTime: params.endTime,
        });
      }
      return qb
        .orderBy('apt.appointmentDate', 'ASC')
        .addOrderBy('apt.startTime', 'ASC')
        .getMany();
    };

    const conflicts = await buildQuery([
      BookingStatus.SCHEDULED,
      BookingStatus.CONFIRMED,
    ]);

    // ATTENDED nella finestra: rilevanti solo se NON hanno ancora un
    // trattamento (auto-attendance appena scattata). Con trattamento
    // aperto il lavoro è stato realmente fatto → nessun avviso.
    const attended = await buildQuery([BookingStatus.ATTENDED]);
    let attendedWithoutTreatment: AvailabilityAppointment[] = [];
    if (attended.length > 0) {
      const treatments = await this.treatmentRepo.find({
        where: { appointmentId: In(attended.map((a) => a.id)) },
        select: ['id', 'appointmentId'],
      });
      const withTreatment = new Set(treatments.map((t) => t.appointmentId));
      attendedWithoutTreatment = attended.filter((a) => !withTreatment.has(a.id));
    }

    return { conflicts, attendedWithoutTreatment };
  }

  /**
   * Cancella tutte le eccezioni di un gruppo (range dal…al / multi-operatore)
   * ripulendo chirurgicamente i conflitti generati da ciascuna.
   */
  async deleteAbsenceGroup(sourceGroupId: string): Promise<number> {
    const exceptions = await this.exceptionRepo.find({ where: { sourceGroupId } });
    for (const ex of exceptions) {
      await this.conflictService.clearConflictsBySourceException(ex.id);
    }
    if (exceptions.length === 0) return 0;
    const result = await this.exceptionRepo.delete({ sourceGroupId });
    return result.affected || 0;
  }

  private enumerateDays(dateFrom: string, dateTo: string): string[] {
    const days: string[] = [];
    const cursor = new Date(dateFrom + 'T00:00:00');
    const end = new Date(dateTo + 'T00:00:00');
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  /**
   * Mappa il nome del tipo di assenza sull'ExceptionType (stesso criterio
   * della palestra, per ottenere il ConflictReason coerente).
   */
  private mapAbsenceNameToExceptionType(name?: string): ExceptionType {
    if (!name) return ExceptionType.UNAVAILABLE;
    const normalized = name.toLowerCase();
    if (normalized.includes('malatt')) return ExceptionType.SICK;
    if (normalized.includes('ferie') || normalized.includes('vacanz'))
      return ExceptionType.VACATION;
    if (normalized.includes('permess')) return ExceptionType.PERSONAL_LEAVE;
    return ExceptionType.UNAVAILABLE;
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

    const saved = await this.exceptionRepo.save(exception);

    // Ricalcolo conflitti: ripristina quelli generati dalla versione
    // precedente e ri-marca sulla finestra aggiornata.
    await this.conflictService.clearConflictsBySourceException(id);
    const check = await this.conflictService.checkConflictsOnException(
      saved.operatorId,
      saved.exceptionDate,
      saved.exceptionType,
      saved.id,
      saved.startTime,
      saved.endTime,
    );
    if (check.hasConflicts) {
      await this.conflictService.markExceptionConflicts(
        check.conflicts,
        saved.exceptionType,
        undefined,
        saved.id,
      );
    }

    return saved;
  }

  async delete(id: string): Promise<boolean> {
    // Ripristino chirurgico dei conflitti generati da questa eccezione.
    await this.conflictService.clearConflictsBySourceException(id);
    const result = await this.exceptionRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async deleteByDateRange(
    operatorId: string,
    startDate: Date,
    endDate: Date,
    exceptionType?: ExceptionType,
  ): Promise<number> {
    // Prima il clear dei conflitti generati dalle eccezioni nel range.
    const toDeleteQb = this.exceptionRepo.createQueryBuilder('ex')
      .select(['ex.id'])
      .where('ex.operatorId = :operatorId', { operatorId })
      .andWhere('ex.exceptionDate >= :startDate', { startDate })
      .andWhere('ex.exceptionDate <= :endDate', { endDate });
    if (exceptionType) {
      toDeleteQb.andWhere('ex.exceptionType = :exceptionType', { exceptionType });
    }
    const toDelete = await toDeleteQb.getMany();
    for (const ex of toDelete) {
      await this.conflictService.clearConflictsBySourceException(ex.id);
    }

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
