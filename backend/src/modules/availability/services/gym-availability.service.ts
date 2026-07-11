import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { GymRoom } from '../entities/gym-room.entity';
import { GymSchedule } from '../entities/gym-schedule.entity';
import { AvailabilityAppointment, BookingStatus } from '../entities/availability-appointment.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { AppointmentType } from '../entities/appointment-type.enum';
import { GymPatternGroupService } from './gym-pattern-group.service';
import { GymExceptionService } from './gym-exception.service';
import { GymTemplatePattern } from '../entities/gym-template-pattern.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

export interface GymSlot {
  startTime: Date;
  endTime: Date;
  startTimeStr: string;
  endTimeStr: string;
  available: boolean;
  currentBookings: number;
  maxCapacity: number;
  remainingCapacity: number;
  operatorId?: string;
  operatorName?: string;
  operatorColor?: string;
  isSubstitute?: boolean;
  originalOperatorId?: string;
  originalOperatorName?: string;
  reason?: string;
  isClosed?: boolean;
}

export interface GymAvailabilityParams {
  gymRoomId: string;
  date: Date;
  startTime: string; // HH:mm format
  durationMinutes?: number; // defaults to room's slotDuration
}

export interface GymAvailabilityResult {
  available: boolean;
  reason?: string;
  currentBookings: number;
  maxCapacity: number;
  remainingCapacity: number;
  operatorId?: string;
  operatorName?: string;
  operatorColor?: string;
  isSubstitute?: boolean;
  originalOperatorId?: string;
  originalOperatorName?: string;
  isClosed?: boolean;
}

@Injectable()
export class GymAvailabilityService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private gymPatternGroupService: GymPatternGroupService,
    private gymExceptionService: GymExceptionService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get roomRepo() { return this.dataSource.getRepository(GymRoom); }

  private get scheduleRepo() { return this.dataSource.getRepository(GymSchedule); }

  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }

  private get exceptionRepo() { return this.dataSource.getRepository(AvailabilityException); }

  /**
   * Check if a gym slot is available - usando il nuovo sistema di template
   */
  async checkAvailability(params: GymAvailabilityParams): Promise<GymAvailabilityResult> {
    const { gymRoomId, date, startTime, durationMinutes } = params;

    // 1. Get gym room
    const room = await this.roomRepo.findOne({ where: { id: gymRoomId } });
    if (!room || !room.isActive) {
      return {
        available: false,
        reason: 'Sala palestra non trovata o non attiva',
        currentBookings: 0,
        maxCapacity: 0,
        remainingCapacity: 0,
      };
    }

    const slotDuration = durationMinutes || room.slotDuration;

    // 2. Controlla se lo slot è chiuso alle prenotazioni: chiusura scoped,
    // slot "palestra chiusa" di un'assenza istruttore, o fuori dagli orari
    // modificati (MODIFIED_HOURS).
    const slotEnd = this.addMinutesToTime(startTime, slotDuration);
    const closure = await this.gymExceptionService.getSlotClosure(
      gymRoomId,
      date,
      startTime,
      slotEnd,
    );
    if (closure.closed) {
      return {
        available: false,
        reason: closure.reason || 'Palestra chiusa',
        currentBookings: 0,
        maxCapacity: room.maxCapacity,
        remainingCapacity: 0,
        isClosed: true,
      };
    }

    // 3. Cerca l'operatore assegnato dal NUOVO sistema di template
    const templateOperator = await this.gymPatternGroupService.getOperatorForTimeSlot(gymRoomId, date, startTime);

    // Se non c'è un operatore nel nuovo sistema, prova il vecchio sistema (GymSchedule)
    let operatorId: string | undefined;
    let operatorName: string | undefined;
    let operatorColor: string | undefined;
    let isSubstitute = false;
    let originalOperatorId: string | undefined;
    let originalOperatorName: string | undefined;

    if (templateOperator) {
      // Controlla eccezioni per l'operatore e ottieni l'operatore effettivo
      const effectiveOperator = await this.gymExceptionService.getEffectiveOperator(
        gymRoomId,
        templateOperator.id,
        date,
        startTime
      );

      operatorId = effectiveOperator.operator?.id;
      operatorName = effectiveOperator.operator
        ? `${effectiveOperator.operator.name}${effectiveOperator.operator.surname ? ' ' + effectiveOperator.operator.surname : ''}`
        : undefined;
      operatorColor = effectiveOperator.operator?.color;
      isSubstitute = effectiveOperator.isSubstitute;

      if (isSubstitute && effectiveOperator.originalOperatorId) {
        originalOperatorId = effectiveOperator.originalOperatorId;
        originalOperatorName = `${templateOperator.name}${templateOperator.surname ? ' ' + templateOperator.surname : ''}`;
      }
    } else {
      // Fallback al vecchio sistema GymSchedule
      const schedule = await this.findOperatorScheduleLegacy(gymRoomId, date.getDay(), startTime);

      if (!schedule) {
        return {
          available: false,
          reason: 'Nessun istruttore assegnato per questo orario',
          currentBookings: 0,
          maxCapacity: room.maxCapacity,
          remainingCapacity: 0,
        };
      }

      operatorId = schedule.operatorId;
      operatorName = schedule.operator?.name;
      operatorColor = schedule.operator?.color;

      // Controlla eccezioni vecchio sistema
      const operatorException = await this.exceptionRepo.findOne({
        where: {
          operatorId: schedule.operatorId,
          exceptionDate: date,
        },
      });

      if (operatorException) {
        if (operatorException.startTime && operatorException.endTime) {
          const endTime = this.addMinutesToTime(startTime, slotDuration);
          if (startTime < operatorException.startTime || endTime > operatorException.endTime) {
            return {
              available: false,
              reason: `Istruttore non disponibile: ${operatorException.reason || operatorException.exceptionType}`,
              currentBookings: 0,
              maxCapacity: room.maxCapacity,
              remainingCapacity: 0,
              operatorId,
              operatorName,
              operatorColor,
            };
          }
        } else {
          return {
            available: false,
            reason: `Istruttore non disponibile: ${operatorException.reason || operatorException.exceptionType}`,
            currentBookings: 0,
            maxCapacity: room.maxCapacity,
            remainingCapacity: 0,
            operatorId,
            operatorName,
            operatorColor,
          };
        }
      }
    }

    // 4. Count current bookings for this slot
    const endTime = this.addMinutesToTime(startTime, slotDuration);
    const currentBookings = await this.countBookingsInSlot(gymRoomId, date, startTime, endTime);

    // 5. Check capacity
    const remainingCapacity = Math.max(0, room.maxCapacity - currentBookings);

    if (currentBookings >= room.maxCapacity) {
      return {
        available: false,
        reason: `Capacità massima raggiunta (${currentBookings}/${room.maxCapacity})`,
        currentBookings,
        maxCapacity: room.maxCapacity,
        remainingCapacity: 0,
        operatorId,
        operatorName,
        operatorColor,
        isSubstitute,
        originalOperatorId,
        originalOperatorName,
      };
    }

    return {
      available: true,
      currentBookings,
      maxCapacity: room.maxCapacity,
      remainingCapacity,
      operatorId,
      operatorName,
      operatorColor,
      isSubstitute,
      originalOperatorId,
      originalOperatorName,
    };
  }

  /**
   * Find the operator schedule using legacy GymSchedule system
   */
  private async findOperatorScheduleLegacy(
    gymRoomId: string,
    dayOfWeek: number,
    time: string,
  ): Promise<GymSchedule | null> {
    return this.scheduleRepo
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.operator', 'operator')
      .where('schedule.gymRoomId = :gymRoomId', { gymRoomId })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek })
      .andWhere('schedule.isCurrent = true')
      .andWhere('schedule.startTime <= :time', { time })
      .andWhere('schedule.endTime > :time', { time })
      .getOne();
  }

  /**
   * Count bookings in a time slot
   */
  private async countBookingsInSlot(
    gymRoomId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<number> {
    return this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.gymRoomId = :gymRoomId', { gymRoomId })
      .andWhere('appointment.appointmentDate = :date', { date })
      .andWhere('appointment.appointmentType = :type', { type: AppointmentType.GYM })
      .andWhere('appointment.bookingStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW]
      })
      .andWhere(
        '(appointment.startTime < :endTime AND appointment.endTime > :startTime)',
        { startTime, endTime },
      )
      .getCount();
  }

  /**
   * Get all available slots for a gym room on a date - usando il nuovo sistema di template
   */
  async getAvailableSlots(gymRoomId: string, date: Date): Promise<GymSlot[]> {
    const slots: GymSlot[] = [];

    // Get room info
    const room = await this.roomRepo.findOne({ where: { id: gymRoomId } });
    if (!room || !room.isActive) {
      return slots;
    }

    // Controlla eccezione di chiusura per l'intera giornata
    const dayException = await this.gymExceptionService.hasException(gymRoomId, date);
    if (dayException && dayException.exceptionType === 'closed' && !dayException.startTime) {
      // Palestra chiusa tutto il giorno
      return slots;
    }

    // Prova prima il nuovo sistema di template
    const templatePatterns = await this.gymPatternGroupService.getPatternsForDay(gymRoomId, date);

    if (templatePatterns.length > 0) {
      // Usa il nuovo sistema
      return this.generateSlotsFromTemplatePatterns(room, date, templatePatterns);
    }

    // Fallback al vecchio sistema GymSchedule
    return this.generateSlotsFromLegacySchedule(room, date);
  }

  /**
   * Genera slot dal nuovo sistema di template pattern
   */
  private async generateSlotsFromTemplatePatterns(
    room: GymRoom,
    date: Date,
    patterns: GymTemplatePattern[]
  ): Promise<GymSlot[]> {
    const slots: GymSlot[] = [];

    // Ordina i pattern per orario
    const sortedPatterns = [...patterns].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    for (const pattern of sortedPatterns) {
      // Normalize times to HH:MM format (remove seconds if present from DB)
      let currentTime = this.normalizeTime(pattern.startTime);
      const endTime = this.normalizeTime(pattern.endTime);

      while (this.timeToMinutes(currentTime) + room.slotDuration <= this.timeToMinutes(endTime)) {
        const result = await this.checkAvailability({
          gymRoomId: room.id,
          date,
          startTime: currentTime,
          durationMinutes: room.slotDuration,
        });

        const startDate = new Date(date);
        const [hours, mins] = currentTime.split(':').map(Number);
        startDate.setHours(hours, mins, 0, 0);

        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + room.slotDuration);

        const slotEndTime = this.addMinutesToTime(currentTime, room.slotDuration);

        slots.push({
          startTime: startDate,
          endTime: endDate,
          startTimeStr: currentTime,
          endTimeStr: slotEndTime,
          available: result.available,
          currentBookings: result.currentBookings,
          maxCapacity: result.maxCapacity,
          remainingCapacity: result.remainingCapacity,
          operatorId: result.operatorId,
          operatorName: result.operatorName,
          operatorColor: result.operatorColor,
          isSubstitute: result.isSubstitute,
          originalOperatorId: result.originalOperatorId,
          originalOperatorName: result.originalOperatorName,
          reason: result.reason,
          isClosed: result.isClosed,
        });

        currentTime = this.addMinutesToTime(currentTime, room.slotDuration);
      }
    }

    return slots;
  }

  /**
   * Genera slot dal vecchio sistema GymSchedule (legacy)
   */
  private async generateSlotsFromLegacySchedule(room: GymRoom, date: Date): Promise<GymSlot[]> {
    const slots: GymSlot[] = [];
    const dayOfWeek = date.getDay();

    const schedules = await this.scheduleRepo.find({
      where: {
        gymRoomId: room.id,
        dayOfWeek,
        isCurrent: true,
      },
      relations: ['operator'],
      order: { startTime: 'ASC' },
    });

    for (const schedule of schedules) {
      // Normalize times to HH:MM format (remove seconds if present from DB)
      let currentTime = this.normalizeTime(schedule.startTime);
      const endTime = this.normalizeTime(schedule.endTime);

      while (this.timeToMinutes(currentTime) + room.slotDuration <= this.timeToMinutes(endTime)) {
        const result = await this.checkAvailability({
          gymRoomId: room.id,
          date,
          startTime: currentTime,
          durationMinutes: room.slotDuration,
        });

        const startDate = new Date(date);
        const [hours, mins] = currentTime.split(':').map(Number);
        startDate.setHours(hours, mins, 0, 0);

        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + room.slotDuration);

        const slotEndTime = this.addMinutesToTime(currentTime, room.slotDuration);

        slots.push({
          startTime: startDate,
          endTime: endDate,
          startTimeStr: currentTime,
          endTimeStr: slotEndTime,
          available: result.available,
          currentBookings: result.currentBookings,
          maxCapacity: result.maxCapacity,
          remainingCapacity: result.remainingCapacity,
          operatorId: result.operatorId,
          operatorName: result.operatorName,
          operatorColor: result.operatorColor,
          reason: result.reason,
          isClosed: result.isClosed,
        });

        currentTime = this.addMinutesToTime(currentTime, room.slotDuration);
      }
    }

    return slots;
  }

  /**
   * Get remaining capacity for a specific slot
   */
  async getRemainingCapacity(
    gymRoomId: string,
    date: Date,
    startTime: string,
  ): Promise<number> {
    const result = await this.checkAvailability({ gymRoomId, date, startTime });
    return result.remainingCapacity;
  }

  /**
   * Ottieni gli appuntamenti per uno slot specifico
   */
  async getAppointmentsForSlot(
    gymRoomId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentRepo
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.operator', 'operator')
      .leftJoinAndSelect('appointment.originalOperator', 'originalOperator')
      .where('appointment.gymRoomId = :gymRoomId', { gymRoomId })
      .andWhere('appointment.appointmentDate = :date', { date })
      .andWhere('appointment.appointmentType = :type', { type: AppointmentType.GYM })
      .andWhere('appointment.bookingStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW]
      })
      .andWhere(
        '(appointment.startTime < :endTime AND appointment.endTime > :startTime)',
        { startTime, endTime },
      )
      .orderBy('appointment.startTime', 'ASC')
      .getMany();
  }

  /**
   * Helper: Add minutes to a time string
   */
  private addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  /**
   * Helper: Convert time string to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  }

  /**
   * Helper: Normalize time string to HH:MM format (remove seconds if present)
   */
  private normalizeTime(time: string): string {
    const parts = time.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }

  /**
   * Get available slots with capacity info for GraphQL GymSlotInfo type
   * Usato dal resolver per la query gymRoomAvailableSlots
   */
  async getAvailableSlotsWithCapacity(gymRoomId: string, dateStr: string): Promise<{
    startTime: string;
    endTime: string;
    operator?: { id: string; name: string; surname?: string; color?: string };
    currentCount: number;
    maxCapacity: number;
    isAvailable: boolean;
    isClosed: boolean;
  }[]> {
    const date = new Date(dateStr);
    const slots = await this.getAvailableSlots(gymRoomId, date);

    return slots.map(slot => ({
      startTime: slot.startTimeStr,
      endTime: slot.endTimeStr,
      operator: slot.operatorId ? {
        id: slot.operatorId,
        name: slot.operatorName?.split(' ')[0] || '',
        surname: slot.operatorName?.split(' ').slice(1).join(' ') || undefined,
        color: slot.operatorColor,
      } : undefined,
      currentCount: slot.currentBookings,
      maxCapacity: slot.maxCapacity,
      isAvailable: slot.available,
      isClosed: slot.isClosed || false,
    }));
  }

  /**
   * Batch ottimizzato: Ottiene gli slot disponibili per più gym room in un range di date.
   * Pre-carica tutti i dati necessari con poche query aggregate, poi genera gli slot in memoria.
   * ~5 query DB totali invece di ~900 per una vista settimanale.
   */
  async getAvailableSlotsForRooms(
    gymRoomIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<{
    gymRoomId: string;
    date: string;
    startTime: string;
    endTime: string;
    operator?: { id: string; name: string; surname?: string; color?: string };
    currentCount: number;
    maxCapacity: number;
    isAvailable: boolean;
    isClosed: boolean;
  }[]> {
    if (gymRoomIds.length === 0) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Genera tutte le date nel range
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // ========== PRE-CARICAMENTO BULK (poche query) ==========

    // 1. Rooms
    const rooms = await this.roomRepo.find({ where: { id: In(gymRoomIds), isActive: true } });
    const roomMap = new Map(rooms.map(r => [r.id, r]));

    // 2. Eccezioni per tutte le room+date
    const allExceptions = await this.gymExceptionService.findExceptionsForRoomsInRange(gymRoomIds, start, end);

    // 3. Pattern group correnti per tutte le room
    const allPatternGroups = await this.gymPatternGroupService.findCurrentByGymRooms(gymRoomIds);
    const patternGroupMap = new Map(allPatternGroups.map(g => [g.gymRoomId, g]));

    // 4. Conteggi prenotazioni per tutti gli slot (query aggregata)
    const bookingCounts = await this.appointmentRepo
      .createQueryBuilder('apt')
      .select([
        'apt."gymRoomId" as "gymRoomId"',
        'apt."appointmentDate" as "appointmentDate"',
        'apt."startTime" as "startTime"',
        'apt."endTime" as "endTime"',
        'COUNT(*)::int as count',
      ])
      .where('apt."gymRoomId" IN (:...roomIds)', { roomIds: gymRoomIds })
      .andWhere('apt."appointmentDate" BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('apt."appointmentType" = :type', { type: AppointmentType.GYM })
      .andWhere('apt."bookingStatus" NOT IN (:...excluded)', {
        excluded: [BookingStatus.CANCELLED, BookingStatus.CANCELLED_EARLY, BookingStatus.CANCELLED_LATE, BookingStatus.NO_SHOW],
      })
      .groupBy('apt."gymRoomId", apt."appointmentDate", apt."startTime", apt."endTime"')
      .getRawMany();

    // Indicizza conteggi: "roomId|date|startTime" → count
    const bookingCountMap = new Map<string, number>();
    for (const row of bookingCounts) {
      const dateStr = row.appointmentDate instanceof Date
        ? row.appointmentDate.toISOString().split('T')[0]
        : String(row.appointmentDate).split('T')[0];
      const key = `${row.gymRoomId}|${dateStr}|${this.normalizeTime(row.startTime)}`;
      bookingCountMap.set(key, row.count);
    }

    // Indicizza eccezioni: "roomId|date" → exceptions[] (include operator-wide con roomId=null)
    const exceptionMap = new Map<string, typeof allExceptions>();
    for (const exc of allExceptions) {
      const dateStr = exc.exceptionDate instanceof Date
        ? exc.exceptionDate.toISOString().split('T')[0]
        : String(exc.exceptionDate).split('T')[0];
      // Per le eccezioni scoped, indicizza con roomId
      if (exc.gymRoomId) {
        const key = `${exc.gymRoomId}|${dateStr}`;
        if (!exceptionMap.has(key)) exceptionMap.set(key, []);
        exceptionMap.get(key)!.push(exc);
      }
      // Per le eccezioni operator-wide (gymRoomId null), indicizza per tutte le room
      if (!exc.gymRoomId) {
        for (const roomId of gymRoomIds) {
          const key = `${roomId}|${dateStr}`;
          if (!exceptionMap.has(key)) exceptionMap.set(key, []);
          exceptionMap.get(key)!.push(exc);
        }
      }
    }

    // Raccogli tutti gli operatorId dai pattern per pre-caricarli
    const operatorIds = new Set<string>();
    for (const group of allPatternGroups) {
      for (const p of group.patterns || []) {
        if (p.operatorId) operatorIds.add(p.operatorId);
        if (p.operator?.id) operatorIds.add(p.operator.id);
      }
    }
    // Aggiungi operatori dai substitutes
    for (const exc of allExceptions) {
      if (exc.substituteOperator?.id) operatorIds.add(exc.substituteOperator.id);
      for (const sub of exc.substitutes || []) {
        if (sub.substituteOperator?.id) operatorIds.add(sub.substituteOperator.id);
      }
    }

    // ========== GENERAZIONE SLOT IN MEMORIA ==========

    const results: {
      gymRoomId: string;
      date: string;
      startTime: string;
      endTime: string;
      operator?: { id: string; name: string; surname?: string; color?: string };
      currentCount: number;
      maxCapacity: number;
      isAvailable: boolean;
      isClosed: boolean;
    }[] = [];

    for (const dateStr of dates) {
      const date = new Date(dateStr + 'T00:00:00');

      for (const roomId of gymRoomIds) {
        const room = roomMap.get(roomId);
        if (!room) continue;

        const exKey = `${roomId}|${dateStr}`;
        const exceptions = exceptionMap.get(exKey) || [];

        // Controlla chiusura giornata intera
        const dayClosedException = exceptions.find(
          e => e.exceptionType === 'closed' && !e.startTime && (e.gymRoomId === roomId),
        );
        if (dayClosedException) continue;

        // Trova pattern per questo giorno
        const group = patternGroupMap.get(roomId);
        if (!group || !group.patterns?.length) continue;

        const patternStartDate = group.patternStartDate instanceof Date
          ? group.patternStartDate
          : new Date(group.patternStartDate);
        const dayInPattern = this.gymPatternGroupService.getPatternDay(date, patternStartDate, group.patternDuration);
        const dayPatterns = group.patterns.filter(p => p.dayInPattern === dayInPattern);

        if (dayPatterns.length === 0) continue;

        // Genera slot per ogni pattern
        for (const pattern of dayPatterns.sort((a, b) => a.startTime.localeCompare(b.startTime))) {
          let slotStart = this.normalizeTime(pattern.startTime);
          const patternEnd = this.normalizeTime(pattern.endTime);

          while (this.timeToMinutes(slotStart) + room.slotDuration <= this.timeToMinutes(patternEnd)) {
            const slotEnd = this.addMinutesToTime(slotStart, room.slotDuration);

            // Controlla eccezione di chiusura per questo slot
            let isClosed = false;
            let isAvailable = true;
            let operatorInfo: { id: string; name: string; surname?: string; color?: string } | undefined;

            // Check eccezioni scoped per questo slot
            const slotException = exceptions.find(e =>
              e.exceptionType === 'closed' &&
              e.gymRoomId === roomId &&
              e.startTime && e.endTime &&
              this.normalizeTime(e.startTime) <= slotStart &&
              this.normalizeTime(e.endTime) >= slotEnd,
            );
            if (slotException) {
              isClosed = true;
              isAvailable = false;
            }

            // Orari modificati (MODIFIED_HOURS): la palestra è aperta SOLO
            // dentro le finestre indicate → slot fuori finestra = chiuso.
            if (!isClosed) {
              const modifiedWindows = exceptions.filter(e =>
                e.exceptionType === 'modified_hours' &&
                e.gymRoomId === roomId &&
                e.startTime && e.endTime,
              );
              if (modifiedWindows.length > 0) {
                const inside = modifiedWindows.some(e =>
                  this.normalizeTime(e.startTime!) <= slotStart &&
                  this.normalizeTime(e.endTime!) >= slotEnd,
                );
                if (!inside) {
                  isClosed = true;
                  isAvailable = false;
                }
              }
            }

            if (!isClosed) {
              // Trova operatore dal template
              const templateOperator = pattern.operator;
              if (templateOperator) {
                // Controlla eccezioni operatore (assenza)
                const operatorException = exceptions.find(e =>
                  e.exceptionType === 'operator_absent' &&
                  e.operatorId === templateOperator.id &&
                  (!e.startTime || (this.normalizeTime(e.startTime) <= slotStart && this.normalizeTime(e.endTime!) >= slotEnd)),
                );

                if (operatorException) {
                  // Cerca sostituto nei substitutes dell'eccezione
                  const substitute = (operatorException.substitutes || []).find(s =>
                    s.gymRoom?.id === roomId &&
                    s.substituteOperator &&
                    !s.isClosed &&
                    this.normalizeTime(s.startTime) <= slotStart &&
                    this.normalizeTime(s.endTime) >= slotEnd,
                  );
                  if (substitute?.substituteOperator) {
                    operatorInfo = {
                      id: substitute.substituteOperator.id,
                      name: substitute.substituteOperator.name || '',
                      surname: substitute.substituteOperator.surname,
                      color: substitute.substituteOperator.color,
                    };
                  } else {
                    // Slot scoperto o chiuso esplicitamente
                    const closedSub = (operatorException.substitutes || []).find(s =>
                      s.gymRoom?.id === roomId && s.isClosed &&
                      this.normalizeTime(s.startTime) <= slotStart &&
                      this.normalizeTime(s.endTime) >= slotEnd,
                    );
                    if (closedSub) {
                      isClosed = true;
                      isAvailable = false;
                    }
                    // Se non c'è sostituto e non è chiuso esplicitamente, operatore = null
                  }
                } else {
                  // Nessuna eccezione, usa operatore template
                  operatorInfo = {
                    id: templateOperator.id,
                    name: templateOperator.name || '',
                    surname: templateOperator.surname,
                    color: templateOperator.color,
                  };
                }
              }
            }

            // Conteggio prenotazioni da mappa pre-caricata
            const countKey = `${roomId}|${dateStr}|${slotStart}`;
            const currentCount = bookingCountMap.get(countKey) || 0;

            if (!isClosed && currentCount >= room.maxCapacity) {
              isAvailable = false;
            }

            results.push({
              gymRoomId: roomId,
              date: dateStr,
              startTime: slotStart,
              endTime: slotEnd,
              operator: operatorInfo,
              currentCount,
              maxCapacity: room.maxCapacity,
              isAvailable: isAvailable && !isClosed,
              isClosed,
            });

            slotStart = this.addMinutesToTime(slotStart, room.slotDuration);
          }
        }
      }
    }

    return results;
  }
}
