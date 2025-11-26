import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GymRoom } from '../entities/gym-room.entity';
import { GymSchedule } from '../entities/gym-schedule.entity';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { AppointmentType } from '../entities/appointment-type.enum';

export interface GymSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
  currentBookings: number;
  maxCapacity: number;
  operatorId?: string;
  operatorName?: string;
  reason?: string;
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
  operatorId?: string;
  operatorName?: string;
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
  ) {}

  /**
   * Check if a gym slot is available
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
      };
    }

    const slotDuration = durationMinutes || room.slotDuration;
    const dayOfWeek = date.getDay();

    // 2. Check if there's an operator assigned for this time
    const schedule = await this.findOperatorSchedule(gymRoomId, dayOfWeek, startTime);
    if (!schedule) {
      return {
        available: false,
        reason: 'Nessun istruttore assegnato per questo orario',
        currentBookings: 0,
        maxCapacity: room.maxCapacity,
      };
    }

    // 3. Check if operator has exceptions (vacation, sick, etc.)
    const operatorException = await this.exceptionRepo.findOne({
      where: {
        operatorId: schedule.operatorId,
        exceptionDate: date,
      },
    });

    if (operatorException) {
      // If modified hours, check if appointment fits
      if (operatorException.startTime && operatorException.endTime) {
        const endTime = this.addMinutesToTime(startTime, slotDuration);
        if (startTime < operatorException.startTime || endTime > operatorException.endTime) {
          return {
            available: false,
            reason: `Istruttore non disponibile: ${operatorException.reason || operatorException.exceptionType}`,
            currentBookings: 0,
            maxCapacity: room.maxCapacity,
            operatorId: schedule.operatorId,
            operatorName: schedule.operator?.name,
          };
        }
      } else {
        return {
          available: false,
          reason: `Istruttore non disponibile: ${operatorException.reason || operatorException.exceptionType}`,
          currentBookings: 0,
          maxCapacity: room.maxCapacity,
          operatorId: schedule.operatorId,
          operatorName: schedule.operator?.name,
        };
      }
    }

    // 4. Count current bookings for this slot
    const endTime = this.addMinutesToTime(startTime, slotDuration);
    const currentBookings = await this.countBookingsInSlot(gymRoomId, date, startTime, endTime);

    // 5. Check capacity
    if (currentBookings >= room.maxCapacity) {
      return {
        available: false,
        reason: `Capacità massima raggiunta (${currentBookings}/${room.maxCapacity})`,
        currentBookings,
        maxCapacity: room.maxCapacity,
        operatorId: schedule.operatorId,
        operatorName: schedule.operator?.name,
      };
    }

    return {
      available: true,
      currentBookings,
      maxCapacity: room.maxCapacity,
      operatorId: schedule.operatorId,
      operatorName: schedule.operator?.name,
    };
  }

  /**
   * Find the operator schedule for a specific time
   */
  private async findOperatorSchedule(
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
      .andWhere('appointment.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere(
        '(appointment.startTime < :endTime AND appointment.endTime > :startTime)',
        { startTime, endTime },
      )
      .getCount();
  }

  /**
   * Get all available slots for a gym room on a date
   */
  async getAvailableSlots(gymRoomId: string, date: Date): Promise<GymSlot[]> {
    const slots: GymSlot[] = [];

    // Get room info
    const room = await this.roomRepo.findOne({ where: { id: gymRoomId } });
    if (!room || !room.isActive) {
      return slots;
    }

    const dayOfWeek = date.getDay();

    // Get all schedules for this room and day
    const schedules = await this.scheduleRepo.find({
      where: {
        gymRoomId,
        dayOfWeek,
        isCurrent: true,
      },
      relations: ['operator'],
      order: { startTime: 'ASC' },
    });

    // For each schedule, generate slots
    for (const schedule of schedules) {
      let currentTime = schedule.startTime;
      const endTime = schedule.endTime;

      while (this.timeToMinutes(currentTime) + room.slotDuration <= this.timeToMinutes(endTime)) {
        const result = await this.checkAvailability({
          gymRoomId,
          date,
          startTime: currentTime,
          durationMinutes: room.slotDuration,
        });

        const startDate = new Date(date);
        const [hours, mins] = currentTime.split(':').map(Number);
        startDate.setHours(hours, mins, 0, 0);

        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + room.slotDuration);

        slots.push({
          startTime: startDate,
          endTime: endDate,
          available: result.available,
          currentBookings: result.currentBookings,
          maxCapacity: result.maxCapacity,
          operatorId: result.operatorId,
          operatorName: result.operatorName,
          reason: result.reason,
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
    return Math.max(0, result.maxCapacity - result.currentBookings);
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
}
