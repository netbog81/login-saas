import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, In, IsNull, Not } from 'typeorm';
import { GymException, GymExceptionType, AbsenceTypeSnapshot } from '../entities/gym-exception.entity';
import { GymExceptionSubstitute } from '../entities/gym-exception-substitute.entity';
import { GymRoom } from '../entities/gym-room.entity';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { GymTemplatePattern } from '../entities/gym-template-pattern.entity';
import { AvailabilityException, ExceptionType } from '../entities/availability-exception.entity';
import { OperatorAbsenceTypeService } from './operator-absence-type.service';
import { GymPatternGroupService } from './gym-pattern-group.service';
import { AppointmentConflictService } from './appointment-conflict.service';

/**
 * Input per slot sostituzione
 */
export interface GymExceptionSubstituteInput {
  gymRoomId: string;
  startTime: string;
  endTime: string;
  substituteOperatorId?: string;
  /**
   * Marker esplicito "palestra chiusa" per questo slot.
   * Ha senso solo quando substituteOperatorId è undefined.
   */
  isClosed?: boolean;
}

export interface CreateGymExceptionInput {
  gymRoomId?: string;
  operatorId?: string;
  exceptionDate: Date;
  startTime?: string;
  endTime?: string;
  exceptionType: GymExceptionType;
  substituteOperatorId?: string;
  substitutes?: GymExceptionSubstituteInput[];
  absenceTypeId?: string;
  reason?: string;
  createdBy?: string;
}

export interface UpdateGymExceptionInput {
  gymRoomId?: string;
  operatorId?: string;
  exceptionDate?: Date;
  startTime?: string;
  endTime?: string;
  exceptionType?: GymExceptionType;
  substituteOperatorId?: string;
  substitutes?: GymExceptionSubstituteInput[];
  absenceTypeId?: string;
  reason?: string;
}

/**
 * Result di getEffectiveOperator
 */
export interface EffectiveOperatorResult {
  operator: Operator | null;
  isSubstitute: boolean;
  originalOperatorId?: string;
  /** True se c'è un'eccezione OPERATOR_ABSENT ma nessun sostituto per questo slot */
  isUncovered: boolean;
}

@Injectable()
export class GymExceptionService {
  constructor(
    @InjectRepository(GymException)
    private exceptionRepo: Repository<GymException>,
    @InjectRepository(GymExceptionSubstitute)
    private substituteRepo: Repository<GymExceptionSubstitute>,
    @InjectRepository(GymRoom)
    private gymRoomRepo: Repository<GymRoom>,
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
    @InjectRepository(GymTemplatePattern)
    private templatePatternRepo: Repository<GymTemplatePattern>,
    @InjectRepository(AvailabilityException)
    private availabilityExceptionRepo: Repository<AvailabilityException>,
    private absenceTypeService: OperatorAbsenceTypeService,
    private patternGroupService: GymPatternGroupService,
    private appointmentConflictService: AppointmentConflictService,
    private dataSource: DataSource,
  ) {}

  // ==================== FIND / QUERY ====================

  /**
   * Trova le eccezioni rilevanti per una palestra in un range di date.
   * Include sia le eccezioni scoped a quella palestra, sia quelle operator-wide
   * (gymRoomId NULL) il cui operatore ha pattern in quella palestra per quella data.
   */
  async findByDateRange(
    gymRoomId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<GymException[]> {
    // 1. Eccezioni scoped
    const scoped = await this.exceptionRepo.find({
      where: {
        gymRoomId,
        exceptionDate: Between(startDate, endDate),
      },
      relations: [
        'gymRoom',
        'operator',
        'substituteOperator',
        'substitutes',
        'substitutes.gymRoom',
        'substitutes.substituteOperator',
      ],
      order: { exceptionDate: 'ASC', startTime: 'ASC' },
    });

    // 2. Eccezioni operator-wide con data in range
    const operatorWide = await this.exceptionRepo.find({
      where: {
        gymRoomId: IsNull(),
        operatorId: Not(IsNull()),
        exceptionDate: Between(startDate, endDate),
      },
      relations: [
        'operator',
        'substituteOperator',
        'substitutes',
        'substitutes.gymRoom',
        'substitutes.substituteOperator',
      ],
      order: { exceptionDate: 'ASC' },
    });

    // Filtra le operator-wide: include solo quelle il cui operatore ha
    // effettivamente pattern nella gymRoom richiesta per quella data.
    const filteredOperatorWide: GymException[] = [];
    for (const ex of operatorWide) {
      if (!ex.operatorId) continue;
      const patterns = await this.patternGroupService.getOperatorPatternsOnDate(
        ex.operatorId,
        new Date(ex.exceptionDate),
      );
      const hasInGym = patterns.some((p) => p.gymRoom.id === gymRoomId);
      if (hasInGym) {
        filteredOperatorWide.push(ex);
      }
    }

    // Unisci e ordina
    const all = [...scoped, ...filteredOperatorWide];
    all.sort((a, b) => {
      const dateCmp = new Date(a.exceptionDate).getTime() - new Date(b.exceptionDate).getTime();
      if (dateCmp !== 0) return dateCmp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
    return all;
  }

  /**
   * Trova le eccezioni rilevanti per una palestra in una data specifica.
   * Stessa logica di findByDateRange ma per singolo giorno.
   */
  async findByDate(gymRoomId: string, date: Date): Promise<GymException[]> {
    return this.findByDateRange(gymRoomId, date, date);
  }

  /**
   * Trova le eccezioni "raw" (scoped + operator-wide) senza il filtro di rilevanza
   * per una data specifica. Usata internamente da isOperatorAvailable e simili
   * per non fare due volte il check di pattern.
   */
  private async findRawByDate(gymRoomId: string, date: Date): Promise<GymException[]> {
    return this.exceptionRepo.find({
      where: [
        { gymRoomId, exceptionDate: date },
        { gymRoomId: IsNull(), exceptionDate: date },
      ],
      relations: [
        'gymRoom',
        'operator',
        'substituteOperator',
        'substitutes',
        'substitutes.gymRoom',
        'substitutes.substituteOperator',
      ],
      order: { startTime: 'ASC' },
    });
  }

  /**
   * Bulk: Carica tutte le eccezioni per più gym room in un range di date.
   * Ritorna un array flat. Usato dal caricamento bulk della vista calendario.
   */
  async findExceptionsForRoomsInRange(
    gymRoomIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<GymException[]> {
    if (gymRoomIds.length === 0) return [];
    return this.exceptionRepo.find({
      where: [
        { gymRoomId: In(gymRoomIds), exceptionDate: Between(startDate, endDate) },
        { gymRoomId: IsNull(), exceptionDate: Between(startDate, endDate) },
      ],
      relations: [
        'gymRoom',
        'operator',
        'substituteOperator',
        'substitutes',
        'substitutes.gymRoom',
        'substitutes.substituteOperator',
      ],
      order: { exceptionDate: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Trova un'eccezione per ID con tutte le relazioni necessarie.
   */
  async findOne(id: string): Promise<GymException> {
    const exception = await this.exceptionRepo.findOne({
      where: { id },
      relations: [
        'gymRoom',
        'operator',
        'substituteOperator',
        'substitutes',
        'substitutes.gymRoom',
        'substitutes.substituteOperator',
      ],
    });

    if (!exception) {
      throw new NotFoundException(`Eccezione palestra con ID ${id} non trovata`);
    }

    return exception;
  }

  /**
   * Trova tutte le eccezioni di un operatore (sia scoped sia operator-wide)
   * in un range di date. Usato per la futura "scheda operatore → assenze".
   */
  async findByOperatorAndDateRange(
    operatorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<GymException[]> {
    return this.exceptionRepo.find({
      where: {
        operatorId,
        exceptionDate: Between(startDate, endDate),
      },
      relations: [
        'gymRoom',
        'operator',
        'substituteOperator',
        'substitutes',
        'substitutes.gymRoom',
        'substitutes.substituteOperator',
      ],
      order: { exceptionDate: 'ASC', startTime: 'ASC' },
    });
  }

  // ==================== CREATE ====================

  async create(input: CreateGymExceptionInput): Promise<GymException> {
    // 1. Validazione base
    if (!input.gymRoomId && !input.operatorId) {
      throw new BadRequestException(
        'gymRoomId è obbligatorio per eccezioni palestra-scoped; operatorId è obbligatorio per eccezioni operator-wide',
      );
    }
    if (!input.gymRoomId && input.exceptionType !== GymExceptionType.OPERATOR_ABSENT) {
      throw new BadRequestException(
        'Le eccezioni operator-wide (senza gymRoomId) sono consentite solo per OPERATOR_ABSENT',
      );
    }

    // 2. Verifica gymRoom se scoped
    if (input.gymRoomId) {
      const gymRoom = await this.gymRoomRepo.findOne({ where: { id: input.gymRoomId } });
      if (!gymRoom) {
        throw new NotFoundException(`Palestra con ID ${input.gymRoomId} non trovata`);
      }
    }

    // 3. Valida orari
    if (input.startTime && input.endTime && input.startTime >= input.endTime) {
      throw new BadRequestException(
        `L'orario di inizio (${input.startTime}) deve essere precedente all'orario di fine (${input.endTime})`,
      );
    }

    // 4. Valida operatori
    if (input.operatorId) {
      await this.validateGymOperator(input.operatorId);
    }
    if (input.substituteOperatorId) {
      await this.validateGymOperator(input.substituteOperatorId);
    }
    if (input.substitutes) {
      for (const sub of input.substitutes) {
        if (sub.substituteOperatorId) {
          await this.validateGymOperator(sub.substituteOperatorId);
        }
      }
    }

    // 5. Snapshot del tipo di assenza
    let absenceTypeSnapshot: AbsenceTypeSnapshot | undefined;
    if (input.absenceTypeId) {
      const absenceType = await this.absenceTypeService.findOneOrNull(input.absenceTypeId);
      if (absenceType) {
        absenceTypeSnapshot = {
          id: absenceType.id,
          name: absenceType.name,
          description: absenceType.description,
        };
      }
    }

    // 6. Derivazione slot per operator-wide (o normalizzazione per scoped)
    const slots = await this.resolveSlotsForException({
      exceptionType: input.exceptionType,
      operatorId: input.operatorId,
      gymRoomId: input.gymRoomId,
      exceptionDate: input.exceptionDate,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    // 7. Costruzione lista sostituti
    const substitutesToSave = this.buildSubstitutesList({
      providedSubstitutes: input.substitutes,
      simpleSubstituteId: input.substituteOperatorId,
      slots,
    });

    // 8. Persistenza transazionale
    const savedException = await this.dataSource.transaction(async (manager) => {
      const entity = manager.create(GymException, {
        gymRoomId: input.gymRoomId,
        operatorId: input.operatorId,
        exceptionDate: input.exceptionDate,
        startTime: input.startTime,
        endTime: input.endTime,
        exceptionType: input.exceptionType,
        substituteOperatorId: input.substituteOperatorId,
        absenceTypeId: input.absenceTypeId,
        absenceTypeSnapshot,
        reason: input.reason,
        createdBy: input.createdBy,
      });
      const savedEx = await manager.save(GymException, entity);

      if (substitutesToSave.length > 0) {
        const subs = substitutesToSave.map((s) =>
          manager.create(GymExceptionSubstitute, {
            gymExceptionId: savedEx.id,
            gymRoomId: s.gymRoomId,
            startTime: s.startTime,
            endTime: s.endTime,
            substituteOperatorId: s.substituteOperatorId,
            isClosed: s.isClosed ?? false,
          }),
        );
        await manager.save(GymExceptionSubstitute, subs);
      }

      return savedEx;
    });

    // 9. Rilevamento e marcatura conflitti per slot scoperti
    if (input.exceptionType === GymExceptionType.OPERATOR_ABSENT && input.operatorId) {
      await this.refreshOperatorAbsenceConflicts({
        exceptionId: savedException.id,
        operatorId: input.operatorId,
        exceptionDate: input.exceptionDate,
        absenceTypeName: absenceTypeSnapshot?.name,
        performedBy: input.createdBy,
        substitutes: substitutesToSave,
      });
    }

    return this.findOne(savedException.id);
  }

  // ==================== UPDATE ====================

  async update(id: string, input: UpdateGymExceptionInput): Promise<GymException> {
    const existing = await this.findOne(id);

    // Validazioni orari
    const startTime = input.startTime !== undefined ? input.startTime : existing.startTime;
    const endTime = input.endTime !== undefined ? input.endTime : existing.endTime;
    if (startTime && endTime && startTime >= endTime) {
      throw new BadRequestException(
        `L'orario di inizio (${startTime}) deve essere precedente all'orario di fine (${endTime})`,
      );
    }

    if (input.operatorId) await this.validateGymOperator(input.operatorId);
    if (input.substituteOperatorId) await this.validateGymOperator(input.substituteOperatorId);
    if (input.substitutes) {
      for (const sub of input.substitutes) {
        if (sub.substituteOperatorId) await this.validateGymOperator(sub.substituteOperatorId);
      }
    }

    // Snapshot: se viene passato un nuovo absenceTypeId, ricalcola; altrimenti mantieni
    let absenceTypeSnapshot = existing.absenceTypeSnapshot;
    let absenceTypeId = existing.absenceTypeId;
    if (input.absenceTypeId !== undefined) {
      absenceTypeId = input.absenceTypeId;
      if (input.absenceTypeId) {
        const absenceType = await this.absenceTypeService.findOneOrNull(input.absenceTypeId);
        if (absenceType) {
          absenceTypeSnapshot = {
            id: absenceType.id,
            name: absenceType.name,
            description: absenceType.description,
          };
        }
      } else {
        absenceTypeSnapshot = undefined;
      }
    }

    // Applica campi base
    if (input.gymRoomId !== undefined) existing.gymRoomId = input.gymRoomId;
    if (input.operatorId !== undefined) existing.operatorId = input.operatorId;
    if (input.exceptionDate !== undefined) existing.exceptionDate = input.exceptionDate;
    if (input.startTime !== undefined) existing.startTime = input.startTime;
    if (input.endTime !== undefined) existing.endTime = input.endTime;
    if (input.exceptionType !== undefined) existing.exceptionType = input.exceptionType;
    if (input.substituteOperatorId !== undefined) existing.substituteOperatorId = input.substituteOperatorId;
    if (input.reason !== undefined) existing.reason = input.reason;
    existing.absenceTypeId = absenceTypeId;
    existing.absenceTypeSnapshot = absenceTypeSnapshot;

    // Se viene passato substitutes, rimpiazza la collezione
    const shouldReplaceSubstitutes = input.substitutes !== undefined;

    // Derivazione slot aggiornati
    let slotsForConflictRefresh: GymExceptionSubstituteInput[] | null = null;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(GymException, existing);

      if (shouldReplaceSubstitutes) {
        // Rimpiazzo completo
        await manager.delete(GymExceptionSubstitute, { gymExceptionId: id });

        const slots = await this.resolveSlotsForException({
          exceptionType: existing.exceptionType,
          operatorId: existing.operatorId,
          gymRoomId: existing.gymRoomId,
          exceptionDate: existing.exceptionDate,
          startTime: existing.startTime,
          endTime: existing.endTime,
        });

        const substitutesToSave = this.buildSubstitutesList({
          providedSubstitutes: input.substitutes,
          simpleSubstituteId: existing.substituteOperatorId,
          slots,
        });

        if (substitutesToSave.length > 0) {
          const subs = substitutesToSave.map((s) =>
            manager.create(GymExceptionSubstitute, {
              gymExceptionId: id,
              gymRoomId: s.gymRoomId,
              startTime: s.startTime,
              endTime: s.endTime,
              substituteOperatorId: s.substituteOperatorId,
              isClosed: s.isClosed ?? false,
            }),
          );
          await manager.save(GymExceptionSubstitute, subs);
        }

        slotsForConflictRefresh = substitutesToSave;
      }
    });

    // Ricalcolo conflitti se OPERATOR_ABSENT
    if (
      existing.exceptionType === GymExceptionType.OPERATOR_ABSENT &&
      existing.operatorId
    ) {
      // Prima clear dei vecchi conflitti per questo operatore/data
      await this.appointmentConflictService.clearOperatorAbsenceConflicts(
        existing.operatorId,
        existing.exceptionDate,
      );

      // Ricalcolo
      const substitutesForRefresh =
        slotsForConflictRefresh ??
        (await this.substituteRepo.find({ where: { gymExceptionId: id } })).map((s) => ({
          gymRoomId: s.gymRoomId,
          startTime: s.startTime,
          endTime: s.endTime,
          substituteOperatorId: s.substituteOperatorId,
          isClosed: s.isClosed,
        }));

      await this.refreshOperatorAbsenceConflicts({
        exceptionId: id,
        operatorId: existing.operatorId,
        exceptionDate: existing.exceptionDate,
        absenceTypeName: existing.absenceTypeSnapshot?.name,
        performedBy: existing.createdBy,
        substitutes: substitutesForRefresh,
      });
    }

    return this.findOne(id);
  }

  // ==================== DELETE ====================

  async delete(id: string): Promise<boolean> {
    const exception = await this.exceptionRepo.findOne({ where: { id } });
    if (!exception) {
      throw new NotFoundException(`Eccezione palestra con ID ${id} non trovata`);
    }

    // Se era OPERATOR_ABSENT, pulisci i conflitti generati
    if (
      exception.exceptionType === GymExceptionType.OPERATOR_ABSENT &&
      exception.operatorId
    ) {
      await this.appointmentConflictService.clearOperatorAbsenceConflicts(
        exception.operatorId,
        exception.exceptionDate,
      );
    }

    const result = await this.exceptionRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  // ==================== AVAILABILITY HELPERS ====================

  /**
   * Verifica se c'è un'eccezione per una palestra in una data e orario specifico.
   * Considera sia eccezioni scoped sia operator-wide.
   */
  async hasException(
    gymRoomId: string,
    date: Date,
    time?: string,
  ): Promise<GymException | null> {
    const exceptions = await this.findRawByDate(gymRoomId, date);

    for (const exception of exceptions) {
      // Se operator-wide, verifica che l'operatore abbia pattern in questa gym
      if (exception.gymRoomId === null || exception.gymRoomId === undefined) {
        if (!exception.operatorId) continue;
        const patterns = await this.patternGroupService.getOperatorPatternsOnDate(
          exception.operatorId,
          date,
        );
        if (!patterns.some((p) => p.gymRoom.id === gymRoomId)) continue;
      }

      if (!exception.startTime || !exception.endTime) {
        return exception;
      }

      if (time && exception.startTime && exception.endTime) {
        if (time >= exception.startTime && time < exception.endTime) {
          return exception;
        }
      }
    }

    return null;
  }

  /**
   * Verifica se un operatore è disponibile in (gymRoomId, date, time).
   * Considera sostituzioni sia via `substitutes` (slot) sia via vecchio
   * `substituteOperatorId` (retrocompatibilità).
   */
  async isOperatorAvailable(
    gymRoomId: string,
    operatorId: string,
    date: Date,
    time?: string,
  ): Promise<{
    available: boolean;
    exception?: GymException;
    substituteOperator?: Operator;
  }> {
    const exceptions = await this.findRawByDate(gymRoomId, date);

    for (const exception of exceptions) {
      // Filtra per rilevanza all'operatore
      if (exception.operatorId && exception.operatorId !== operatorId) continue;

      // Filtra operator-wide che non tocca questa gym (l'operatore non ha pattern qui)
      if (exception.gymRoomId === null || exception.gymRoomId === undefined) {
        if (!exception.operatorId) continue;
        const patterns = await this.patternGroupService.getOperatorPatternsOnDate(
          exception.operatorId,
          date,
        );
        if (!patterns.some((p) => p.gymRoom.id === gymRoomId)) continue;
      }

      const hitsWholeDay = !exception.startTime || !exception.endTime;
      const hitsTimeWindow =
        time && exception.startTime && exception.endTime
          ? time >= exception.startTime && time < exception.endTime
          : false;

      if (!hitsWholeDay && !hitsTimeWindow) continue;

      // Trova sostituto (priorità: substitutes[] > substituteOperator legacy)
      let substituteOperator: Operator | undefined;
      let foundSlotSub = false;
      if (exception.substitutes && exception.substitutes.length > 0 && time) {
        const slotSub = exception.substitutes.find(
          (s) =>
            s.gymRoomId === gymRoomId &&
            time >= s.startTime &&
            time < s.endTime,
        );
        if (slotSub) {
          foundSlotSub = true;
          if (slotSub.substituteOperator) {
            substituteOperator = slotSub.substituteOperator;
          }
          // Se lo slot esiste ma è esplicitamente "isClosed" o ha
          // substituteOperatorId NULL, non fallback al legacy: l'utente
          // ha già fatto una scelta esplicita per quella fascia.
        }
      }
      if (!foundSlotSub && !substituteOperator && exception.substituteOperator) {
        // Fallback al legacy solo se per quello slot non c'è una scelta
        // esplicita nei substitutes (eccezioni storiche pre-refactor).
        substituteOperator = exception.substituteOperator;
      }

      return {
        available: false,
        exception,
        substituteOperator,
      };
    }

    return { available: true };
  }

  /**
   * Ottiene l'operatore effettivo per uno slot (considerando le sostituzioni).
   * Ritorna anche `isUncovered=true` se c'è un'eccezione ma nessun sostituto.
   */
  async getEffectiveOperator(
    gymRoomId: string,
    templateOperatorId: string,
    date: Date,
    time: string,
  ): Promise<EffectiveOperatorResult> {
    const availability = await this.isOperatorAvailable(
      gymRoomId,
      templateOperatorId,
      date,
      time,
    );

    if (!availability.available) {
      if (availability.substituteOperator) {
        return {
          operator: availability.substituteOperator,
          isSubstitute: true,
          originalOperatorId: templateOperatorId,
          isUncovered: false,
        };
      }
      // Eccezione senza sostituto → slot scoperto
      return {
        operator: null,
        isSubstitute: false,
        originalOperatorId: templateOperatorId,
        isUncovered: true,
      };
    }

    const operator = await this.operatorRepo.findOne({
      where: { id: templateOperatorId },
    });
    if (!operator) {
      throw new NotFoundException(`Operatore con ID ${templateOperatorId} non trovato`);
    }

    return {
      operator,
      isSubstitute: false,
      isUncovered: false,
    };
  }

  // ==================== OPERATOR AVAILABILITY QUERY ====================

  /**
   * Trova operatori GYM_INSTRUCTOR "liberi" in una fascia oraria di una
   * palestra (né pattern già assegnato in quella fascia in QUALUNQUE palestra,
   * né eccezione operatore attiva).
   *
   * Usato dal toggle "Mostra operatori disponibili" nel modal di creazione
   * eccezione per suggerire sostituti per ciascuno slot dell'assente.
   */
  async findAvailableOperatorsForSlot(
    gymRoomId: string,
    date: Date,
    startTime: string,
    endTime: string,
    excludeOperatorId: string,
  ): Promise<Operator[]> {
    // 1. Candidati: tutti i GYM_INSTRUCTOR attivi tranne l'assente
    const candidates = await this.operatorRepo.find({
      where: {
        macroCategory: OperatorMacroCategory.GYM_INSTRUCTOR,
        isActive: true,
        id: Not(excludeOperatorId),
      },
      order: { name: 'ASC' },
    });

    const available: Operator[] = [];

    for (const candidate of candidates) {
      // Check 1: il candidato è già assegnato in un pattern che si sovrappone con lo slot (in QUALSIASI gym)?
      const candidatePatterns = await this.patternGroupService.getOperatorPatternsOnDate(
        candidate.id,
        date,
      );
      const hasOverlappingPattern = candidatePatterns.some((p) =>
        this.timesOverlap(startTime, endTime, p.pattern.startTime, p.pattern.endTime),
      );
      if (hasOverlappingPattern) continue;

      // Check 2: c'è un'eccezione OPERATOR_ABSENT attiva per questo candidato?
      // findRawByDate ritorna scoped + operator-wide per la gym, ma qui vogliamo
      // controllare assenze indipendenti da gym: usiamo una query diretta.
      const candidateExceptions = await this.exceptionRepo.find({
        where: {
          operatorId: candidate.id,
          exceptionDate: date,
          exceptionType: GymExceptionType.OPERATOR_ABSENT,
        },
      });
      const isAbsent = candidateExceptions.some((ex) => {
        const allDay = !ex.startTime || !ex.endTime;
        if (allDay) return true;
        return this.timesOverlap(startTime, endTime, ex.startTime!, ex.endTime!);
      });
      if (isAbsent) continue;

      // Check 3: c'è un'AvailabilityException (modulo generico)?
      const genericExceptions = await this.availabilityExceptionRepo.find({
        where: { operatorId: candidate.id, exceptionDate: date },
      });
      const isGenericBlocked = genericExceptions.some((ex) => {
        if (ex.exceptionType === ExceptionType.MODIFIED) {
          // MODIFIED con orari specifici = l'operatore lavora solo in quella finestra
          if (ex.startTime && ex.endTime) {
            return !(
              startTime >= ex.startTime && endTime <= ex.endTime
            );
          }
          return false;
        }
        // Altre tipologie = indisponibilità
        if (!ex.startTime || !ex.endTime) return true;
        return this.timesOverlap(startTime, endTime, ex.startTime, ex.endTime);
      });
      if (isGenericBlocked) continue;

      available.push(candidate);
    }

    return available;
  }

  // ==================== INTERNAL HELPERS ====================

  /**
   * Dati gli input dell'eccezione, restituisce la lista di slot (palestra +
   * fascia oraria) da "coprire":
   * - OPERATOR_ABSENT operator-wide: tutti i pattern dell'operatore quel giorno
   * - OPERATOR_ABSENT scoped: i pattern dell'operatore nella gym indicata quel giorno
   *   (filtrati sulla finestra startTime/endTime se specificata)
   * - CLOSED / MODIFIED_HOURS: nessuno slot (non hanno sostituzioni)
   */
  private async resolveSlotsForException(params: {
    exceptionType: GymExceptionType;
    operatorId?: string;
    gymRoomId?: string;
    exceptionDate: Date;
    startTime?: string;
    endTime?: string;
  }): Promise<Array<{ gymRoomId: string; startTime: string; endTime: string }>> {
    if (params.exceptionType !== GymExceptionType.OPERATOR_ABSENT) return [];
    if (!params.operatorId) return [];

    const allPatterns = await this.patternGroupService.getOperatorPatternsOnDate(
      params.operatorId,
      params.exceptionDate,
    );

    const filtered = allPatterns.filter((p) => {
      // Se l'eccezione è scoped a una gym, mantieni solo quei pattern
      if (params.gymRoomId && p.gymRoom.id !== params.gymRoomId) return false;
      // Se l'eccezione ha una finestra specifica, filtra per overlap
      if (params.startTime && params.endTime) {
        return this.timesOverlap(
          params.startTime,
          params.endTime,
          p.pattern.startTime,
          p.pattern.endTime,
        );
      }
      return true;
    });

    return filtered.map((p) => ({
      gymRoomId: p.gymRoom.id,
      startTime: p.pattern.startTime,
      endTime: p.pattern.endTime,
    }));
  }

  /**
   * Costruisce la lista definitiva di sostituti da persistere:
   * - Se l'utente ha passato `providedSubstitutes`, la accetta così com'è
   *   filtrando a quelle che sono **sub-intervalli** di uno slot-pattern reale
   *   (gymRoomId uguale + fascia oraria contenuta in quella del pattern).
   *   Questo permette al frontend di splittare un pattern lungo in più
   *   sotto-fasce (es. slot da 1h) e assegnare sostituti diversi per ora.
   * - Altrimenti, se c'è un `simpleSubstituteId`, espande uno stesso sostituto
   *   su ogni slot-pattern originale (modalità semplice, nessuno split).
   * - Altrimenti ritorna una entry per slot-pattern con substituteOperatorId=NULL
   *   (slot scoperti).
   */
  private buildSubstitutesList(params: {
    providedSubstitutes?: GymExceptionSubstituteInput[];
    simpleSubstituteId?: string;
    slots: Array<{ gymRoomId: string; startTime: string; endTime: string }>;
  }): GymExceptionSubstituteInput[] {
    if (params.slots.length === 0) return [];

    if (params.providedSubstitutes && params.providedSubstitutes.length > 0) {
      // Mantieni solo le entry che sono sub-intervalli di uno slot-pattern candidato.
      // Sanitizza isClosed: se substituteOperatorId è valorizzato, isClosed deve
      // essere false (un sostituto attivo non può essere "chiuso").
      return params.providedSubstitutes
        .filter((sub) =>
          params.slots.some(
            (slot) =>
              slot.gymRoomId === sub.gymRoomId &&
              sub.startTime >= slot.startTime &&
              sub.endTime <= slot.endTime &&
              sub.startTime < sub.endTime,
          ),
        )
        .map((sub) => ({
          ...sub,
          isClosed: sub.substituteOperatorId ? false : !!sub.isClosed,
        }));
    }

    // Modalità semplice: propaga il sostituto unico su tutti gli slot-pattern
    return params.slots.map((slot) => ({
      gymRoomId: slot.gymRoomId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      substituteOperatorId: params.simpleSubstituteId,
      isClosed: false,
    }));
  }

  /**
   * Per ogni slot scoperto (substituteOperatorId NULL), trova gli appuntamenti
   * in conflitto nella gym e nella fascia, e li marca tramite
   * AppointmentConflictService.markExceptionConflicts.
   *
   * Mappatura name → ExceptionType del modulo availability-exception (per
   * ottenere il giusto ConflictReason):
   *  - contiene "malatt" → SICK
   *  - contiene "ferie" o "vacanz" → VACATION
   *  - default → UNAVAILABLE
   */
  private async refreshOperatorAbsenceConflicts(params: {
    exceptionId: string;
    operatorId: string;
    exceptionDate: Date;
    absenceTypeName?: string;
    performedBy?: string;
    substitutes: GymExceptionSubstituteInput[];
  }): Promise<void> {
    const exceptionType = this.mapAbsenceNameToExceptionType(params.absenceTypeName);
    const defaultReasonText = params.absenceTypeName || 'Operatore assente';

    for (const sub of params.substitutes) {
      if (sub.substituteOperatorId) continue; // slot coperto, nessun conflitto

      // Se lo slot è esplicitamente "palestra chiusa", il motivo del conflitto
      // riflette la scelta intenzionale; altrimenti usa l'absenceTypeName/default.
      const reasonText = sub.isClosed ? 'Palestra chiusa' : defaultReasonText;

      const result = await this.appointmentConflictService.checkConflictsOnGymException({
        operatorId: params.operatorId,
        gymRoomId: sub.gymRoomId,
        exceptionDate: params.exceptionDate,
        startTime: sub.startTime,
        endTime: sub.endTime,
        exceptionId: params.exceptionId,
        reasonText,
      });

      if (result.hasConflicts) {
        await this.appointmentConflictService.markExceptionConflicts(
          result.conflicts,
          exceptionType,
          params.performedBy,
        );
      }
    }
  }

  private mapAbsenceNameToExceptionType(name?: string): ExceptionType {
    if (!name) return ExceptionType.UNAVAILABLE;
    const normalized = name.toLowerCase();
    if (normalized.includes('malatt')) return ExceptionType.SICK;
    if (normalized.includes('ferie') || normalized.includes('vacanz'))
      return ExceptionType.VACATION;
    if (normalized.includes('permess')) return ExceptionType.PERSONAL_LEAVE;
    return ExceptionType.UNAVAILABLE;
  }

  /**
   * Valida che un operatore sia un GYM_INSTRUCTOR
   */
  private async validateGymOperator(operatorId: string): Promise<Operator> {
    const operator = await this.operatorRepo.findOne({ where: { id: operatorId } });

    if (!operator) {
      throw new NotFoundException(`Operatore con ID ${operatorId} non trovato`);
    }

    if (operator.macroCategory !== OperatorMacroCategory.GYM_INSTRUCTOR) {
      throw new BadRequestException(
        `L'operatore ${operator.name} non è un istruttore palestra (macroCategory: ${operator.macroCategory})`,
      );
    }

    return operator;
  }

  private timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    return start1 < end2 && start2 < end1;
  }
}
