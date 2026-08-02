import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Between, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AvailabilityException, ExceptionType } from '../entities/availability-exception.entity';
import {
  AvailabilityAppointment,
  BookingStatus,
  ConflictReason,
} from '../entities/availability-appointment.entity';
import { Treatment } from '../entities/treatment.entity';
import { AbsenceTypeSnapshot } from '../entities/gym-exception.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { Operator } from '../entities/operator.entity';
import { GymTemplatePattern } from '../entities/gym-template-pattern.entity';
import { GymExceptionSubstitute } from '../entities/gym-exception-substitute.entity';
import { OperatorAbsenceTypeService } from './operator-absence-type.service';
import { AppointmentConflictService } from './appointment-conflict.service';
import { AvailabilityService } from './availability.service';
import { TenantContextService } from '@curandis/tenant-datasource';
import { toDateString } from '../utils/date-string.util';
import { getPatternDay } from '../utils/pattern-day.util';
import {
  applyDayExceptions,
  classifyDayExceptions,
  hhmmToMinutes,
  isCoveredByBands,
  mergeIntervals,
  minutesToHHmm,
  normalizeTime,
  subtractWindows,
  timesOverlap,
} from '../utils/day-exception-semantics.util';

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
  /** Giorni della settimana da includere (0=Lun … 6=Dom). Vuoto/assente = tutti. */
  weekdays?: number[];
  performedBy?: string;
}

export interface OperatorAbsencesResult {
  exceptions: AvailabilityException[];
  conflictCount: number;
  /** Combinazioni operatore+giorno saltate perché già coperte da un'altra ASSENZA sovrapposta. */
  skippedOverlaps: number;
  /**
   * Disponibilità straordinarie rimosse perché soppiantate dall'assenza
   * (l'assenza ha la precedenza: chi è in ferie non resta prenotabile).
   */
  removedAvailabilityCount: number;
  sourceGroupId: string;
}

/** Input della creazione batch di disponibilità straordinarie. */
export interface CreateOperatorAvailabilityData {
  operatorIds: string[];
  /** YYYY-MM-DD */
  dateFrom: string;
  /** YYYY-MM-DD (uguale a dateFrom per giorno singolo) */
  dateTo: string;
  /** HH:MM — obbligatori: una disponibilità senza estremi non ha senso. */
  startTime: string;
  endTime: string;
  reason?: string;
  /** Giorni della settimana da includere (0=Lun … 6=Dom). Vuoto/assente = tutti. */
  weekdays?: number[];
  performedBy?: string;
}

/** Motivo per cui un giorno non può ricevere la disponibilità richiesta. */
export interface AvailabilityBlocker {
  operatorId: string;
  operatorName: string;
  /** YYYY-MM-DD */
  date: string;
  reason: string;
}

/** Porzione della finestra richiesta che l'operatore ha già disponibile. */
export interface AvailabilityAlreadyCovered {
  operatorId: string;
  operatorName: string;
  /** YYYY-MM-DD */
  date: string;
  /** Fasce già coperte da template, in formato "HH:MM–HH:MM". */
  windows: string[];
}

export interface AvailabilityImpactPreview {
  /** Giorni che verranno effettivamente creati. */
  creatableCount: number;
  /** Giorni scartati, con il perché. */
  blockers: AvailabilityBlocker[];
  /** Sovrapposizioni con il template: non bloccanti, solo informative. */
  alreadyCovered: AvailabilityAlreadyCovered[];
}

export interface OperatorAvailabilityResult {
  exceptions: AvailabilityException[];
  createdCount: number;
  blockers: AvailabilityBlocker[];
  alreadyCovered: AvailabilityAlreadyCovered[];
  sourceGroupId: string;
}

/** Una fascia oraria del nuovo orario di giornata. */
export interface ScheduleWindow {
  /** HH:MM */
  startTime: string;
  /** HH:MM */
  endTime: string;
}

/**
 * Input del cambio orario: per i giorni indicati il nuovo orario SOSTITUISCE
 * quello da template. Più finestre = turno spezzato (es. 07–15 e 16–20).
 */
export interface CreateScheduleChangeData {
  operatorIds: string[];
  /** YYYY-MM-DD */
  dateFrom: string;
  /** YYYY-MM-DD (uguale a dateFrom per giorno singolo) */
  dateTo: string;
  windows: ScheduleWindow[];
  reason?: string;
  /** Giorni della settimana da includere (0=Lun … 6=Dom). Vuoto/assente = tutti. */
  weekdays?: number[];
  performedBy?: string;
}

/** Confronto orario abituale / nuovo orario per un giorno. */
export interface ScheduleChangePreviewDay {
  operatorId: string;
  operatorName: string;
  /** YYYY-MM-DD */
  date: string;
  /** Fasce da template, "HH:MM–HH:MM". Vuoto = quel giorno non lavora. */
  currentWindows: string[];
  /** Fasce che si perdono rispetto all'orario abituale. */
  lostWindows: string[];
  /** Fasce guadagnate rispetto all'orario abituale. */
  gainedWindows: string[];
}

export interface ScheduleChangeImpactPreview {
  creatableCount: number;
  blockers: AvailabilityBlocker[];
  days: ScheduleChangePreviewDay[];
  /** Appuntamenti che finirebbero fuori dal nuovo orario. */
  conflicts: AvailabilityAppointment[];
}

export interface ScheduleChangeResult {
  exceptions: AvailabilityException[];
  createdCount: number;
  conflictCount: number;
  blockers: AvailabilityBlocker[];
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
  /**
   * Disponibilità straordinarie che verrebbero rimosse perché l'assenza ha
   * la precedenza. Va mostrato: è l'unico effetto distruttivo del salvataggio.
   */
  removedAvailabilityCount: number;
}

@Injectable()
export class AvailabilityExceptionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly absenceTypeService: OperatorAbsenceTypeService,
    private readonly conflictService: AppointmentConflictService,
    private readonly availabilityService: AvailabilityService,
  ){}

  /**
   * Ricostruisce la cache disponibilità per l'operatore nel range indicato.
   * Va chiamato dopo OGNI modifica alle eccezioni: la cache alimenta gli
   * slot proposti in prenotazione — senza rebuild un'assenza appena creata
   * lascerebbe visibili gli slot del template (bug testato: ferie 1-4/09
   * con slot ancora prenotabili).
   */
  private async rebuildCacheRange(
    operatorId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<void> {
    await this.availabilityService.rebuildCache(operatorId, dateFrom, dateTo);
  }

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get exceptionRepo() { return this.dataSource.getRepository(AvailabilityException); }

  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }

  private get treatmentRepo() { return this.dataSource.getRepository(Treatment); }

  private get assignmentRepo() { return this.dataSource.getRepository(TemplateAssignment); }

  private get gymPatternRepo() { return this.dataSource.getRepository(GymTemplatePattern); }

  private get gymSubstituteRepo() { return this.dataSource.getRepository(GymExceptionSubstitute); }

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
    const saved = await this.exceptionRepo.save(exception);

    const dateStr = toDateString(data.exceptionDate);
    await this.rebuildCacheRange(data.operatorId, dateStr, dateStr);

    return saved;
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
    const all = await this.findOverlappingExceptions(operatorId, date, startTime, endTime);
    return all[0] ?? null;
  }

  /**
   * TUTTE le eccezioni che si sovrappongono alla finestra richiesta.
   * Un'eccezione a giornata intera (senza orari) è incompatibile con
   * qualsiasi finestra dello stesso giorno, e viceversa.
   */
  private async findOverlappingExceptions(
    operatorId: string,
    date: Date,
    startTime?: string,
    endTime?: string,
  ): Promise<AvailabilityException[]> {
    const sameDay = await this.exceptionRepo.find({
      where: { operatorId, exceptionDate: date },
    });
    const reqWholeDay = !startTime || !endTime;
    return sameDay.filter((ex) => {
      const exWholeDay = !ex.startTime || !ex.endTime;
      if (exWholeDay || reqWholeDay) return true;
      return (
        this.normalizeTime(startTime!) < this.normalizeTime(ex.endTime!) &&
        this.normalizeTime(ex.startTime!) < this.normalizeTime(endTime!)
      );
    });
  }

  /** Normalizza "HH:MM:SS" / "H:M" a "HH:MM" per confronti omogenei. */
  private normalizeTime(time: string): string {
    return normalizeTime(time);
  }

  // ============ DISPONIBILITÀ STRAORDINARIE (batch) ============

  /**
   * Valida gli input comuni a preview e creazione di una disponibilità
   * straordinaria, restituendo i giorni da elaborare.
   */
  private validateAvailabilityInput(data: {
    operatorIds: string[];
    dateFrom: string;
    dateTo: string;
    startTime: string;
    endTime: string;
    weekdays?: number[];
  }): string[] {
    if (!data.operatorIds || data.operatorIds.length === 0) {
      throw new BadRequestException('Selezionare almeno un operatore');
    }
    if (!data.dateFrom || !data.dateTo || data.dateFrom > data.dateTo) {
      throw new BadRequestException('Intervallo di date non valido');
    }
    if (!data.startTime || !data.endTime) {
      throw new BadRequestException(
        'Indicare ora di inizio e ora di fine: una disponibilità a giornata intera non è ammessa',
      );
    }
    if (this.normalizeTime(data.startTime) >= this.normalizeTime(data.endTime)) {
      throw new BadRequestException("L'ora di inizio deve precedere l'ora di fine");
    }

    // Filtro giorni della settimana: il caso d'uso tipico è "tutti i mercoledì
    // di settembre pomeriggio", non 30 giorni consecutivi.
    return this.validateAvailabilityInputDays(
      data.dateFrom,
      data.dateTo,
      data.weekdays,
    );
  }

  /**
   * Fasce di template (in minuti) dell'operatore in un giorno, senza tenere
   * conto delle eccezioni. Serve a dire all'utente quanta parte della
   * finestra che sta inserendo era già coperta.
   */
  private async getTemplateBandsForDay(
    assignments: TemplateAssignment[],
    date: Date,
  ): Promise<{ start: number; end: number }[]> {
    const bands: { start: number; end: number }[] = [];
    for (const assignment of assignments) {
      const validFrom = new Date(assignment.validFrom);
      const validUntil = assignment.validUntil ? new Date(assignment.validUntil) : null;
      if (date < validFrom || (validUntil && date > validUntil)) continue;

      const pg = assignment.patternGroup;
      if (!pg?.patterns) continue;

      const patternStart =
        assignment.patternStartDate instanceof Date
          ? assignment.patternStartDate
          : new Date(assignment.patternStartDate);
      const patternDay = getPatternDay(date, patternStart, pg.patternDuration);

      for (const pattern of pg.patterns) {
        if (pattern.dayInPattern === patternDay) {
          bands.push({
            start: hhmmToMinutes(pattern.startTime),
            end: hhmmToMinutes(pattern.endTime),
          });
        }
      }
    }
    return bands;
  }

  /**
   * Impegni palestra dell'operatore in un giorno: pattern propri e slot in
   * cui figura come SOSTITUTO di un collega.
   *
   * Oggi la pagina esclude gli istruttori palestra e `validateGymOperator`
   * impedisce di nominare sostituto chi non è istruttore, quindi in pratica
   * questo controllo non scatta quasi mai. Resta come presidio: è
   * esattamente il caso che il committente ha chiesto di non lasciare
   * scoperto ("non deve stare già sostituendo un altro operatore").
   */
  private async findGymCommitment(
    operatorId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<string | null> {
    // 1. Sostituzioni palestra accettate per quel giorno.
    const substitutions = await this.gymSubstituteRepo
      .createQueryBuilder('sub')
      .innerJoin('sub.gymException', 'ex')
      .where('sub.substituteOperatorId = :operatorId', { operatorId })
      .andWhere('ex.exceptionDate = :date', { date: toDateString(date) })
      .select(['sub.startTime', 'sub.endTime'])
      .getMany();
    const overlappingSub = substitutions.find((s) =>
      timesOverlap(startTime, endTime, s.startTime, s.endTime),
    );
    if (overlappingSub) {
      return `sta sostituendo un collega in palestra ${this.normalizeTime(
        overlappingSub.startTime,
      )}–${this.normalizeTime(overlappingSub.endTime)}`;
    }

    // 2. Pattern palestra propri (lezioni sue in calendario quel giorno).
    const gymPatterns = await this.gymPatternRepo.find({
      where: { operatorId },
      relations: ['patternGroup'],
    });
    for (const p of gymPatterns) {
      const group: any = p.patternGroup;
      if (!group || group.isActive === false) continue;
      const patternStart =
        group.patternStartDate instanceof Date
          ? group.patternStartDate
          : new Date(group.patternStartDate);
      const dayInPattern = getPatternDay(date, patternStart, group.patternDuration);
      if (p.dayInPattern !== dayInPattern) continue;
      if (timesOverlap(startTime, endTime, p.startTime, p.endTime)) {
        return `ha già una lezione in palestra ${this.normalizeTime(
          p.startTime,
        )}–${this.normalizeTime(p.endTime)}`;
      }
    }

    return null;
  }

  /**
   * Verifica incrociata di un singolo giorno: l'operatore è DAVVERO libero
   * nella finestra richiesta?
   *
   * Restituisce il motivo del blocco (stringa) oppure null. Le
   * sovrapposizioni con il PROPRIO template non bloccano: sono riportate a
   * parte come "già coperto".
   */
  private async findAvailabilityBlocker(
    operatorId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<string | null> {
    // 1. Assenze / orari modificati / altre disponibilità sullo stesso giorno.
    //    findOverlappingException tratta la giornata intera come incompatibile
    //    con qualsiasi finestra: è esattamente la regola voluta (assenza a
    //    giornata intera → blocco; assenza a fascia → blocco solo se si
    //    sovrappone davvero).
    const overlapping = await this.findOverlappingException(
      operatorId,
      date,
      startTime,
      endTime,
    );
    if (overlapping) {
      const isWholeDay = !overlapping.startTime || !overlapping.endTime;
      const fascia = isWholeDay
        ? 'giornata intera'
        : `${this.normalizeTime(overlapping.startTime!)}–${this.normalizeTime(overlapping.endTime!)}`;
      const label =
        overlapping.absenceTypeSnapshot?.name ||
        this.exceptionTypeLabel(overlapping.exceptionType);
      return `${label} (${fascia}) già presente`;
    }

    // 2. Impegni palestra.
    const gym = await this.findGymCommitment(operatorId, date, startTime, endTime);
    if (gym) return gym;

    return null;
  }

  private exceptionTypeLabel(type: ExceptionType): string {
    const labels: Record<string, string> = {
      [ExceptionType.SICK]: 'Malattia',
      [ExceptionType.VACATION]: 'Ferie',
      [ExceptionType.HOLIDAY]: 'Festività',
      [ExceptionType.PERSONAL_LEAVE]: 'Permesso',
      [ExceptionType.UNAVAILABLE]: 'Assenza',
      [ExceptionType.MODIFIED]: 'Orario modificato',
      [ExceptionType.EXTRA]: 'Disponibilità straordinaria',
    };
    return labels[type] || 'Eccezione';
  }

  // ============ CAMBIO ORARIO (batch) ============

  /**
   * Valida gli input del cambio orario e restituisce giorni e finestre
   * normalizzate (ordinate, senza sovrapposizioni).
   */
  private validateScheduleChangeInput(data: {
    operatorIds: string[];
    dateFrom: string;
    dateTo: string;
    windows: ScheduleWindow[];
    weekdays?: number[];
  }): { days: string[]; windows: ScheduleWindow[] } {
    if (!data.operatorIds || data.operatorIds.length === 0) {
      throw new BadRequestException('Selezionare almeno un operatore');
    }
    if (!data.dateFrom || !data.dateTo || data.dateFrom > data.dateTo) {
      throw new BadRequestException('Intervallo di date non valido');
    }
    if (!data.windows || data.windows.length === 0) {
      throw new BadRequestException('Indicare almeno una fascia oraria');
    }

    const windows = [...data.windows]
      .map((w) => ({
        startTime: this.normalizeTime(w.startTime || ''),
        endTime: this.normalizeTime(w.endTime || ''),
      }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (const w of windows) {
      if (!w.startTime || !w.endTime) {
        throw new BadRequestException('Ogni fascia deve avere ora di inizio e di fine');
      }
      if (w.startTime >= w.endTime) {
        throw new BadRequestException(
          `Fascia ${w.startTime}–${w.endTime}: l'ora di inizio deve precedere l'ora di fine`,
        );
      }
    }
    // Le fasce del nuovo orario non possono accavallarsi: sarebbero
    // ambigue da leggere e non aggiungerebbero nulla (l'unione è la stessa).
    for (let i = 1; i < windows.length; i++) {
      if (windows[i].startTime < windows[i - 1].endTime) {
        throw new BadRequestException(
          `Le fasce ${windows[i - 1].startTime}–${windows[i - 1].endTime} e ${windows[i].startTime}–${windows[i].endTime} si sovrappongono`,
        );
      }
    }

    const days = this.validateAvailabilityInputDays(
      data.dateFrom,
      data.dateTo,
      data.weekdays,
    );
    return { days, windows };
  }

  /** Giorni del range, filtrati sui giorni della settimana richiesti. */
  private validateAvailabilityInputDays(
    dateFrom: string,
    dateTo: string,
    weekdays?: number[],
  ): string[] {
    const days = this.enumerateDays(dateFrom, dateTo);
    if (days.length > 92) {
      throw new BadRequestException('Il range massimo è di 92 giorni');
    }
    if (weekdays && weekdays.length > 0) {
      const wanted = new Set(weekdays);
      return days.filter((day) => {
        const jsDay = new Date(day + 'T00:00:00').getDay();
        return wanted.has(jsDay === 0 ? 6 : jsDay - 1);
      });
    }
    return days;
  }

  /**
   * Motivo per cui un giorno non può ricevere un cambio orario, o null.
   *
   * Regole diverse dalla disponibilità straordinaria: il cambio orario
   * ridefinisce l'INTERA giornata, quindi non può convivere con altre
   * eccezioni che pretendono di definirla a loro volta.
   */
  private async findScheduleChangeBlocker(
    operatorId: string,
    date: Date,
    windows: ScheduleWindow[],
  ): Promise<string | null> {
    const dayExceptions = await this.exceptionRepo.find({
      where: { operatorId, exceptionDate: date },
    });

    const wholeDayAbsence = dayExceptions.find(
      (ex) =>
        ex.exceptionType !== ExceptionType.EXTRA &&
        ex.exceptionType !== ExceptionType.MODIFIED &&
        (!ex.startTime || !ex.endTime),
    );
    if (wholeDayAbsence) {
      const label =
        wholeDayAbsence.absenceTypeSnapshot?.name ||
        this.exceptionTypeLabel(wholeDayAbsence.exceptionType);
      return `${label} (giornata intera): non ha senso cambiare l'orario di un giorno non lavorato`;
    }

    const existingModified = dayExceptions.find(
      (ex) => ex.exceptionType === ExceptionType.MODIFIED,
    );
    if (existingModified) {
      return 'esiste già un cambio orario per questo giorno: eliminalo prima di inserirne un altro';
    }

    const existingExtra = dayExceptions.find(
      (ex) => ex.exceptionType === ExceptionType.EXTRA,
    );
    if (existingExtra) {
      return 'esiste già una disponibilità straordinaria per questo giorno: il cambio orario la sostituirebbe in modo ambiguo, eliminala prima';
    }

    // Impegni palestra dentro le nuove fasce.
    for (const w of windows) {
      const gym = await this.findGymCommitment(operatorId, date, w.startTime, w.endTime);
      if (gym) return gym;
    }

    return null;
  }

  /** Etichette "HH:MM–HH:MM" per un elenco di intervalli in minuti. */
  private formatBands(bands: { start: number; end: number }[]): string[] {
    return mergeIntervals(bands).map(
      (b) => `${minutesToHHmm(b.start)}–${minutesToHHmm(b.end)}`,
    );
  }

  /**
   * Anteprima del cambio orario: confronto orario abituale / nuovo per ogni
   * giorno, giorni scartati con motivo, e appuntamenti che finirebbero fuori
   * dal nuovo orario. Non modifica nulla.
   */
  async previewScheduleChangeImpact(
    data: CreateScheduleChangeData,
  ): Promise<ScheduleChangeImpactPreview> {
    const { days, windows } = this.validateScheduleChangeInput(data);
    const operatorNames = await this.getOperatorNames(data.operatorIds);
    const newBands = windows.map((w) => ({
      start: hhmmToMinutes(w.startTime),
      end: hhmmToMinutes(w.endTime),
    }));

    const blockers: AvailabilityBlocker[] = [];
    const previewDays: ScheduleChangePreviewDay[] = [];
    const conflicts: AvailabilityAppointment[] = [];
    let creatableCount = 0;

    for (const operatorId of data.operatorIds) {
      const assignments = await this.assignmentRepo.find({
        where: { operatorId, isCurrent: true },
        relations: ['patternGroup', 'patternGroup.patterns'],
      });

      for (const day of days) {
        const date = new Date(day + 'T00:00:00');
        const blocker = await this.findScheduleChangeBlocker(operatorId, date, windows);
        if (blocker) {
          blockers.push({
            operatorId,
            operatorName: operatorNames.get(operatorId) || '',
            date: day,
            reason: blocker,
          });
          continue;
        }

        creatableCount++;

        const currentBands = await this.getTemplateBandsForDay(assignments, date);
        previewDays.push({
          operatorId,
          operatorName: operatorNames.get(operatorId) || '',
          date: day,
          currentWindows: this.formatBands(currentBands),
          lostWindows: this.formatBands(subtractWindows(currentBands, newBands)),
          gainedWindows: this.formatBands(subtractWindows(newBands, currentBands)),
        });

        conflicts.push(
          ...(await this.findAppointmentsOutsideWindows(operatorId, day, newBands)),
        );
      }
    }

    return { creatableCount, blockers, days: previewDays, conflicts };
  }

  /**
   * Appuntamenti attivi del giorno che NON stanno interamente dentro le
   * nuove fasce: sono quelli che il cambio orario lascia fuori.
   */
  private async findAppointmentsOutsideWindows(
    operatorId: string,
    dateStr: string,
    newBands: { start: number; end: number }[],
  ): Promise<AvailabilityAppointment[]> {
    const appointments = await this.appointmentRepo
      .createQueryBuilder('apt')
      .leftJoinAndSelect('apt.operator', 'operator')
      .leftJoinAndSelect('apt.service', 'service')
      .where('apt.operatorId = :operatorId', { operatorId })
      .andWhere('apt.appointmentDate = :date', { date: dateStr })
      .andWhere('apt.bookingStatus IN (:...statuses)', {
        statuses: [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED],
      })
      .andWhere('apt.nonRetribuito IS NOT TRUE')
      .orderBy('apt.startTime', 'ASC')
      .getMany();

    return appointments.filter(
      (apt) =>
        !isCoveredByBands(
          newBands,
          hhmmToMinutes(apt.startTime),
          hhmmToMinutes(apt.endTime),
        ),
    );
  }

  /**
   * Applica il cambio orario: per ogni giorno valido crea una riga MODIFIED
   * per fascia (turno spezzato = più righe, stesso sourceGroupId) e marca in
   * conflitto gli appuntamenti che restano fuori dal nuovo orario.
   */
  async createScheduleChange(
    data: CreateScheduleChangeData,
  ): Promise<ScheduleChangeResult> {
    const { days, windows } = this.validateScheduleChangeInput(data);
    const operatorNames = await this.getOperatorNames(data.operatorIds);
    const newBands = windows.map((w) => ({
      start: hhmmToMinutes(w.startTime),
      end: hhmmToMinutes(w.endTime),
    }));

    const sourceGroupId = uuidv4();
    const created: AvailabilityException[] = [];
    const blockers: AvailabilityBlocker[] = [];
    let conflictCount = 0;

    for (const operatorId of data.operatorIds) {
      for (const day of days) {
        const date = new Date(day + 'T00:00:00');
        const blocker = await this.findScheduleChangeBlocker(operatorId, date, windows);
        if (blocker) {
          blockers.push({
            operatorId,
            operatorName: operatorNames.get(operatorId) || '',
            date: day,
            reason: blocker,
          });
          continue;
        }

        const savedForDay: AvailabilityException[] = [];
        for (const w of windows) {
          const saved = await this.exceptionRepo.save(
            this.exceptionRepo.create({
              operatorId,
              exceptionDate: day as unknown as Date,
              exceptionType: ExceptionType.MODIFIED,
              startTime: w.startTime,
              endTime: w.endTime,
              reason: data.reason,
              sourceGroupId,
            }),
          );
          savedForDay.push(saved);
        }
        created.push(...savedForDay);

        // Appuntamenti fuori dal nuovo orario → conflitto, attribuito alla
        // PRIMA riga del giorno: la cancellazione del gruppo passa comunque
        // per il clear su tutte le righe, e così il ripristino è chirurgico.
        const outside = await this.findAppointmentsOutsideWindows(
          operatorId,
          day,
          newBands,
        );
        if (outside.length > 0) {
          await this.appointmentRepo.update(
            { id: In(outside.map((a) => a.id)) },
            {
              hasConflict: true,
              conflictReason: ConflictReason.OPERATOR_UNAVAILABLE,
              conflictDetectedAt: new Date(),
              conflictSourceExceptionId: savedForDay[0].id,
            },
          );
          conflictCount += outside.length;
        }
      }
    }

    if (created.length === 0) {
      throw new BadRequestException(
        blockers.length > 0
          ? `Nessun cambio orario applicato: ${blockers[0].reason}${blockers.length > 1 ? ` (e altri ${blockers.length - 1} giorni)` : ''}`
          : 'Nessun giorno selezionato',
      );
    }

    const operatorsToRebuild = new Set(created.map((e) => e.operatorId));
    for (const opId of operatorsToRebuild) {
      await this.rebuildCacheRange(opId, days[0], days[days.length - 1]);
    }

    const createdWithRelations = await this.exceptionRepo.find({
      where: { id: In(created.map((e) => e.id)) },
      relations: ['operator'],
      order: { exceptionDate: 'ASC', startTime: 'ASC' },
    });

    return {
      exceptions: createdWithRelations,
      createdCount: created.length,
      conflictCount,
      blockers,
      sourceGroupId,
    };
  }

  /**
   * Anteprima (dry-run) dell'inserimento di disponibilità straordinarie:
   * quanti giorni verrebbero creati, quali scartati e perché, e quali fasce
   * risultano già coperte dal template. Non modifica nulla.
   */
  async previewAvailabilityImpact(
    data: CreateOperatorAvailabilityData,
  ): Promise<AvailabilityImpactPreview> {
    const days = this.validateAvailabilityInput(data);
    const operatorNames = await this.getOperatorNames(data.operatorIds);

    const blockers: AvailabilityBlocker[] = [];
    const alreadyCovered: AvailabilityAlreadyCovered[] = [];
    let creatableCount = 0;

    for (const operatorId of data.operatorIds) {
      const assignments = await this.assignmentRepo.find({
        where: { operatorId, isCurrent: true },
        relations: ['patternGroup', 'patternGroup.patterns'],
      });

      for (const day of days) {
        const date = new Date(day + 'T00:00:00');
        const blocker = await this.findAvailabilityBlocker(
          operatorId,
          date,
          data.startTime,
          data.endTime,
        );
        if (blocker) {
          blockers.push({
            operatorId,
            operatorName: operatorNames.get(operatorId) || '',
            date: day,
            reason: blocker,
          });
          continue;
        }

        creatableCount++;

        const covered = await this.findCoveredWindows(
          assignments,
          date,
          data.startTime,
          data.endTime,
        );
        if (covered.length > 0) {
          alreadyCovered.push({
            operatorId,
            operatorName: operatorNames.get(operatorId) || '',
            date: day,
            windows: covered,
          });
        }
      }
    }

    return { creatableCount, blockers, alreadyCovered };
  }

  /**
   * Porzioni della finestra richiesta già coperte dal template, come
   * etichette "HH:MM–HH:MM". Vuoto se la finestra è tutta nuova.
   */
  private async findCoveredWindows(
    assignments: TemplateAssignment[],
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<string[]> {
    const templateBands = await this.getTemplateBandsForDay(assignments, date);
    if (templateBands.length === 0) return [];

    const reqStart = hhmmToMinutes(startTime);
    const reqEnd = hhmmToMinutes(endTime);

    // Intersezione fra la finestra richiesta e ogni fascia di template.
    return templateBands
      .map((b) => ({
        start: Math.max(b.start, reqStart),
        end: Math.min(b.end, reqEnd),
      }))
      .filter((b) => b.end > b.start)
      .sort((a, b) => a.start - b.start)
      .map((b) => `${minutesToHHmm(b.start)}–${minutesToHHmm(b.end)}`);
  }

  private async getOperatorNames(operatorIds: string[]): Promise<Map<string, string>> {
    if (operatorIds.length === 0) return new Map();
    const rows = await this.dataSource.getRepository(Operator).find({
      where: { id: In(operatorIds) },
      select: ['id', 'name', 'surname'],
    });
    return new Map(
      rows.map((o) => [o.id, `${o.name ?? ''} ${o.surname ?? ''}`.trim()]),
    );
  }

  /**
   * Crea le disponibilità straordinarie per più operatori su un range di
   * giorni. I giorni non validi vengono saltati e riportati in `blockers`:
   * un mercoledì di ferie in mezzo a un mese non deve far fallire l'intera
   * operazione.
   *
   * La finestra viene salvata PER INTERO come l'ha digitata l'utente, anche
   * se in parte già coperta dal template: nel calcolo disponibilità la
   * porzione ridondante viene ignorata (vedi day-exception-semantics.util),
   * ma in elenco l'utente ritrova quello che ha scritto.
   */
  async createOperatorAvailability(
    data: CreateOperatorAvailabilityData,
  ): Promise<OperatorAvailabilityResult> {
    const days = this.validateAvailabilityInput(data);
    const operatorNames = await this.getOperatorNames(data.operatorIds);

    const sourceGroupId = uuidv4();
    const created: AvailabilityException[] = [];
    const blockers: AvailabilityBlocker[] = [];
    const alreadyCovered: AvailabilityAlreadyCovered[] = [];

    for (const operatorId of data.operatorIds) {
      const assignments = await this.assignmentRepo.find({
        where: { operatorId, isCurrent: true },
        relations: ['patternGroup', 'patternGroup.patterns'],
      });

      for (const day of days) {
        const date = new Date(day + 'T00:00:00');
        const blocker = await this.findAvailabilityBlocker(
          operatorId,
          date,
          data.startTime,
          data.endTime,
        );
        if (blocker) {
          blockers.push({
            operatorId,
            operatorName: operatorNames.get(operatorId) || '',
            date: day,
            reason: blocker,
          });
          continue;
        }

        const saved = await this.exceptionRepo.save(
          this.exceptionRepo.create({
            operatorId,
            exceptionDate: day as unknown as Date,
            exceptionType: ExceptionType.EXTRA,
            startTime: data.startTime,
            endTime: data.endTime,
            reason: data.reason,
            sourceGroupId,
          }),
        );
        created.push(saved);

        const covered = await this.findCoveredWindows(
          assignments,
          date,
          data.startTime,
          data.endTime,
        );
        if (covered.length > 0) {
          alreadyCovered.push({
            operatorId,
            operatorName: operatorNames.get(operatorId) || '',
            date: day,
            windows: covered,
          });
        }
      }
    }

    if (created.length === 0) {
      throw new BadRequestException(
        blockers.length > 0
          ? `Nessuna disponibilità creata: ${blockers[0].reason}${blockers.length > 1 ? ` (e altri ${blockers.length - 1} giorni)` : ''}`
          : 'Nessun giorno selezionato',
      );
    }

    // Aggiungere disponibilità può SANARE conflitti esistenti: un
    // appuntamento marcato in conflitto perché fuori orario ora rientra
    // nella finestra straordinaria.
    await this.clearConflictsCoveredByExtra(created);

    const operatorsToRebuild = new Set(created.map((e) => e.operatorId));
    for (const opId of operatorsToRebuild) {
      await this.rebuildCacheRange(opId, days[0], days[days.length - 1]);
    }

    const createdWithRelations = await this.exceptionRepo.find({
      where: { id: In(created.map((e) => e.id)) },
      relations: ['operator'],
      order: { exceptionDate: 'ASC' },
    });

    return {
      exceptions: createdWithRelations,
      createdCount: created.length,
      blockers,
      alreadyCovered,
      sourceGroupId,
    };
  }

  /**
   * Sana i conflitti degli appuntamenti che ricadono interamente dentro una
   * disponibilità straordinaria appena creata.
   *
   * Caso reale: la segreteria sposta un appuntamento su un orario in cui
   * l'operatore non lavorava → conflitto; poi si concorda che quel giorno
   * l'operatore c'è → inserendo la disponibilità il conflitto deve sparire
   * da solo, senza passare dalla pagina Conflitti.
   */
  private async clearConflictsCoveredByExtra(
    extras: AvailabilityException[],
  ): Promise<void> {
    for (const extra of extras) {
      await this.appointmentRepo
        .createQueryBuilder()
        .update(AvailabilityAppointment)
        .set({
          hasConflict: false,
          conflictReason: null as any,
          conflictDetectedAt: null as any,
          conflictSourceExceptionId: null as any,
        })
        .where('operatorId = :operatorId', { operatorId: extra.operatorId })
        .andWhere('appointmentDate = :date', { date: toDateString(extra.exceptionDate) })
        .andWhere('hasConflict = true')
        .andWhere('startTime >= :startTime', { startTime: extra.startTime })
        .andWhere('endTime <= :endTime', { endTime: extra.endTime })
        .execute();
    }
  }

  /**
   * Appuntamenti che resterebbero "orfani" togliendo le disponibilità
   * straordinarie indicate: prenotati dentro la finestra e non più coperti
   * da nient'altro. Dry-run, non modifica nulla.
   */
  async previewAvailabilityRemovalImpact(
    exceptionIds: string[],
  ): Promise<AvailabilityAppointment[]> {
    const extras = await this.exceptionRepo.find({
      where: { id: In(exceptionIds), exceptionType: ExceptionType.EXTRA },
    });
    return this.findAppointmentsLosingCoverage(extras);
  }

  /**
   * Appuntamenti attivi che PERDONO COPERTURA rimuovendo le eccezioni
   * indicate: oggi ricadono in una fascia disponibile, dopo la rimozione no.
   *
   * Formulazione generale — si calcolano le bande del giorno PRIMA e DOPO,
   * con la stessa funzione che alimenta calendario e prenotazione, e si
   * confrontano. Vale sia per le disponibilità straordinarie (tolte quelle
   * resta il solo template) sia per i cambi orario (tolti quelli il template
   * torna in vigore, e un appuntamento preso nel nuovo orario può cadere
   * fuori da quello abituale).
   *
   * Un appuntamento già scoperto prima non viene riportato: non è questa
   * operazione ad averlo rotto.
   */
  private async findAppointmentsLosingCoverage(
    removed: AvailabilityException[],
  ): Promise<AvailabilityAppointment[]> {
    const losing: AvailabilityAppointment[] = [];
    const removedIds = new Set(removed.map((e) => e.id));

    // Un giorno-operatore alla volta: le eccezioni di un giorno vanno
    // valutate insieme, non una per una.
    const byOperatorDate = new Map<string, { operatorId: string; dateStr: string }>();
    for (const ex of removed) {
      const dateStr = toDateString(ex.exceptionDate);
      byOperatorDate.set(`${ex.operatorId}|${dateStr}`, {
        operatorId: ex.operatorId,
        dateStr,
      });
    }

    for (const { operatorId, dateStr } of byOperatorDate.values()) {
      const appointments = await this.appointmentRepo
        .createQueryBuilder('apt')
        .leftJoinAndSelect('apt.operator', 'operator')
        .leftJoinAndSelect('apt.service', 'service')
        .where('apt.operatorId = :operatorId', { operatorId })
        .andWhere('apt.appointmentDate = :date', { date: dateStr })
        .andWhere('apt.bookingStatus IN (:...statuses)', {
          statuses: [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED],
        })
        .andWhere('apt.nonRetribuito IS NOT TRUE')
        .orderBy('apt.startTime', 'ASC')
        .getMany();
      if (appointments.length === 0) continue;

      const date = new Date(dateStr + 'T00:00:00');
      const assignments = await this.assignmentRepo.find({
        where: { operatorId, isCurrent: true },
        relations: ['patternGroup', 'patternGroup.patterns'],
      });
      const templateBands = await this.getTemplateBandsForDay(assignments, date);

      const allDayExceptions = await this.exceptionRepo.find({
        where: { operatorId, exceptionDate: date },
      });
      const survivingExceptions = allDayExceptions.filter((e) => !removedIds.has(e.id));

      const bandsBefore = applyDayExceptions(
        templateBands.map((b) => ({ ...b })),
        classifyDayExceptions(allDayExceptions),
      );
      const bandsAfter = applyDayExceptions(
        templateBands.map((b) => ({ ...b })),
        classifyDayExceptions(survivingExceptions),
      );

      for (const apt of appointments) {
        const start = hhmmToMinutes(apt.startTime);
        const end = hhmmToMinutes(apt.endTime);
        if (!isCoveredByBands(bandsBefore, start, end)) continue; // già scoperto
        if (isCoveredByBands(bandsAfter, start, end)) continue; // regge da solo
        losing.push(apt);
      }
    }

    return losing;
  }

  /**
   * Marca come conflitto gli appuntamenti rimasti scoperti dalla rimozione
   * di una disponibilità straordinaria.
   *
   * È l'INVERSO delle assenze: lì la cancellazione RIPRISTINA i conflitti,
   * qui li CREA. Motivo: la disponibilità era la ragione per cui quegli
   * appuntamenti erano prenotabili; toglierla senza avvisare lascerebbe
   * pazienti convocati con l'operatore che non c'è.
   */
  private async markConflictsForRemovedAvailability(
    extras: AvailabilityException[],
    performedBy?: string,
  ): Promise<number> {
    const orphaned = await this.findAppointmentsLosingCoverage(extras);
    if (orphaned.length === 0) return 0;

    // sourceExceptionId punta alla disponibilità rimossa solo a titolo di
    // tracciatura: la riga sta per sparire, quindi non serve (né si può)
    // usarla per un clear chirurgico. Il conflitto si risolve dalla pagina
    // Conflitti come tutti gli altri.
    await this.appointmentRepo.update(
      { id: In(orphaned.map((a) => a.id)) },
      {
        hasConflict: true,
        conflictReason: ConflictReason.AVAILABILITY_REMOVED,
        conflictDetectedAt: new Date(),
        conflictSourceExceptionId: null as any,
      },
    );

    return orphaned.length;
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

    const days = this.validateAvailabilityInputDays(
      data.dateFrom,
      data.dateTo,
      data.weekdays,
    );

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
    let removedAvailabilityCount = 0;

    for (const operatorId of data.operatorIds) {
      for (const day of days) {
        const exceptionDate = new Date(day);

        const overlapping = await this.findOverlappingExceptions(
          operatorId,
          exceptionDate,
          data.startTime,
          data.endTime,
        );
        if (overlapping.length > 0) {
          // Un'assenza ha PRECEDENZA su una disponibilità straordinaria: se
          // l'operatore è in ferie, quel giorno non deve restare prenotabile
          // solo perché in passato gli era stata aggiunta una fascia extra.
          // Le disponibilità sovrapposte vengono rimosse e gli appuntamenti
          // che vi erano stati presi finiscono in Conflitti — la stessa fine
          // che farebbero comunque, dato che l'assenza li coprirebbe.
          //
          // Se invece la sovrapposizione è con un'altra ASSENZA (o con un
          // orario modificato), il giorno si salta: sovrascrivere un'assenza
          // esistente con un'altra sarebbe una perdita di informazione.
          const onlyExtras = overlapping.every(
            (ex) => ex.exceptionType === ExceptionType.EXTRA,
          );
          if (!onlyExtras) {
            skippedOverlaps++;
            continue;
          }
          removedAvailabilityCount += await this.replaceExtrasWithAbsence(overlapping);
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

    // Ricostruisce la cache disponibilità per gli operatori con almeno
    // un'eccezione creata (rebuild idempotente sul range richiesto).
    const operatorsToRebuild = new Set(created.map((e) => e.operatorId));
    for (const opId of operatorsToRebuild) {
      await this.rebuildCacheRange(opId, data.dateFrom, data.dateTo);
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
      removedAvailabilityCount,
      sourceGroupId,
    };
  }

  /**
   * Rimuove le disponibilità straordinarie soppiantate da un'assenza,
   * marcando in conflitto gli appuntamenti che restano scoperti.
   * Restituisce quante ne sono state rimosse.
   */
  private async replaceExtrasWithAbsence(
    extras: AvailabilityException[],
  ): Promise<number> {
    if (extras.length === 0) return 0;
    await this.markConflictsForRemovedAvailability(extras);
    await this.exceptionRepo.delete({ id: In(extras.map((e) => e.id)) });
    return extras.length;
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
      return { conflicts: [], attendedWithoutTreatment: [], removedAvailabilityCount: 0 };
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

    // Disponibilità straordinarie che l'assenza soppianterebbe.
    const extrasQb = this.exceptionRepo
      .createQueryBuilder('ex')
      .where('ex.operatorId IN (:...operatorIds)', { operatorIds: params.operatorIds })
      .andWhere('ex.exceptionDate BETWEEN :dateFrom AND :dateTo', {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      })
      .andWhere('ex.exceptionType = :type', { type: ExceptionType.EXTRA });
    if (params.startTime && params.endTime) {
      extrasQb.andWhere('(ex.startTime < :endTime AND ex.endTime > :startTime)', {
        startTime: params.startTime,
        endTime: params.endTime,
      });
    }
    const removedAvailabilityCount = await extrasQb.getCount();

    return { conflicts, attendedWithoutTreatment, removedAvailabilityCount };
  }

  /**
   * Cancella tutte le eccezioni di un gruppo (range dal…al / multi-operatore).
   *
   * Conservata per i chiamanti storici: la logica vive in
   * deleteExceptionGroup, che applica l'effetto corretto sui conflitti
   * qualunque sia il tipo del gruppo.
   */
  async deleteAbsenceGroup(sourceGroupId: string): Promise<number> {
    const result = await this.deleteExceptionGroup(sourceGroupId);
    return result.deleted;
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

    const dateStr = toDateString(saved.exceptionDate);
    await this.rebuildCacheRange(saved.operatorId, dateStr, dateStr);

    return saved;
  }

  async delete(id: string, performedBy?: string): Promise<boolean> {
    const exception = await this.findOne(id);
    const result = await this.removeExceptions([exception], performedBy);
    return result.deleted > 0;
  }

  /**
   * Rimozione di un insieme di eccezioni, con l'effetto giusto sui conflitti
   * a seconda di cosa si sta togliendo.
   *
   * Le due direzioni convivono e vanno applicate entrambe, in quest'ordine:
   *
   *  1. RIPRISTINO — i conflitti che queste eccezioni avevano generato non
   *     hanno più ragione di esistere (assenza tolta → l'operatore c'è di
   *     nuovo; cambio orario tolto → gli appuntamenti fuori dal nuovo orario
   *     rientrano in quello abituale).
   *  2. NUOVI CONFLITTI — gli appuntamenti che stavano in piedi GRAZIE a
   *     queste eccezioni restano scoperti (disponibilità straordinaria tolta;
   *     cambio orario tolto, con appuntamenti presi nelle ore guadagnate).
   *
   * Un'assenza attiva solo la (1), una disponibilità solo la (2), un cambio
   * orario tutte e due — che è esattamente il motivo per cui il dispatch sta
   * qui e non nel chiamante.
   */
  private async removeExceptions(
    exceptions: AvailabilityException[],
    performedBy?: string,
  ): Promise<{ deleted: number; conflictCount: number }> {
    if (exceptions.length === 0) return { deleted: 0, conflictCount: 0 };

    // Calcolato PRIMA della delete: serve lo stato attuale del giorno.
    const losesCoverage = exceptions.some(
      (ex) =>
        ex.exceptionType === ExceptionType.EXTRA ||
        ex.exceptionType === ExceptionType.MODIFIED,
    );
    const losing = losesCoverage
      ? await this.findAppointmentsLosingCoverage(exceptions)
      : [];

    for (const ex of exceptions) {
      await this.conflictService.clearConflictsBySourceException(ex.id);
    }

    const result = await this.exceptionRepo.delete({
      id: In(exceptions.map((e) => e.id)),
    });

    if (losing.length > 0) {
      await this.appointmentRepo.update(
        { id: In(losing.map((a) => a.id)) },
        {
          hasConflict: true,
          conflictReason: ConflictReason.AVAILABILITY_REMOVED,
          conflictDetectedAt: new Date(),
          conflictSourceExceptionId: null as any,
        },
      );
    }

    // Rebuild cache per operatore sul range min-max delle sue righe.
    const rangeByOperator = new Map<string, { min: string; max: string }>();
    for (const ex of exceptions) {
      const dateStr = toDateString(ex.exceptionDate);
      const range = rangeByOperator.get(ex.operatorId);
      if (!range) {
        rangeByOperator.set(ex.operatorId, { min: dateStr, max: dateStr });
      } else {
        if (dateStr < range.min) range.min = dateStr;
        if (dateStr > range.max) range.max = dateStr;
      }
    }
    for (const [opId, range] of rangeByOperator) {
      await this.rebuildCacheRange(opId, range.min, range.max);
    }

    return { deleted: result.affected || 0, conflictCount: losing.length };
  }

  /**
   * Cancella un intero gruppo creato in blocco (range dal…al /
   * multi-operatore), qualunque ne sia il tipo. Restituisce le righe
   * eliminate e gli appuntamenti finiti in conflitto perché scoperti.
   */
  async deleteExceptionGroup(
    sourceGroupId: string,
    performedBy?: string,
  ): Promise<{ deleted: number; conflictCount: number }> {
    const exceptions = await this.exceptionRepo.find({ where: { sourceGroupId } });
    return this.removeExceptions(exceptions, performedBy);
  }

  /** Anteprima della rimozione di un intero gruppo. */
  async previewGroupRemovalImpact(
    sourceGroupId: string,
  ): Promise<AvailabilityAppointment[]> {
    const exceptions = await this.exceptionRepo.find({ where: { sourceGroupId } });
    return this.findAppointmentsLosingCoverage(exceptions);
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

    if (result.affected) {
      await this.rebuildCacheRange(
        operatorId,
        toDateString(startDate),
        toDateString(endDate),
      );
    }

    return result.affected || 0;
  }

  async hasException(operatorId: string, date: Date): Promise<AvailabilityException | null> {
    return this.exceptionRepo.findOne({
      where: { operatorId, exceptionDate: date },
    });
  }
}
