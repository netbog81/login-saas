import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GymRoom } from '../entities/gym-room.entity';
import { GymSchedule } from '../entities/gym-schedule.entity';
import { AvailabilityAppointment, BookingStatus } from '../entities/availability-appointment.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { AppointmentType } from '../entities/appointment-type.enum';
import { GymPatternGroupService } from './gym-pattern-group.service';
import { GymExceptionService } from './gym-exception.service';
import { GymTemplatePattern } from '../entities/gym-template-pattern.entity';

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
  isSubstitute?: boolean;
  originalOperatorId?: string;
  originalOperatorName?: string;
  isClosed?: boolean;
}

@Injectable()
export class GymAvailabilityService {
  constructor(
    @InjectRepository(GymRoom)
    private roomRepo: Repository<GymRoom>,
    @InjectRepository(GymSchedule)
    private scheduleRepo: Repository<GymSchedule>,
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    @InjectRepository(AvailabilityException)
    private exceptionRepo: Repository<AvailabilityException>,
    private gymPatternGroupService: GymPatternGroupService,
    private gymExceptionService: GymExceptionService,
  ) {}

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

    // 2. Controlla se c'è un'eccezione di chiusura per la palestra
    const closureException = await this.gymExceptionService.hasException(gymRoomId, date, startTime);
    if (closureException && closureException.exceptionType === 'closed') {
      return {
        available: false,
        reason: closureException.reason || 'Palestra chiusa',
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

      operatorId = effectiveOperator.operator.id;
      operatorName = `${effectiveOperator.operator.name}${effectiveOperator.operator.surname ? ' ' + effectiveOperator.operator.surname : ''}`;
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
      .leftJoinAndSelect('appointment.patient', 'patient')
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
    operator?: { id: string; name: string; surname?: string };
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
      } : undefined,
      currentCount: slot.currentBookings,
      maxCapacity: slot.maxCapacity,
      isAvailable: slot.available,
      isClosed: slot.isClosed || false,
    }));
  }
}
