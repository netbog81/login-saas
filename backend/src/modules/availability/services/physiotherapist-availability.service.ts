import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { Instrument } from '../entities/instrument.entity';
import { InstrumentStatus } from '../entities/instrument-status.enum';
import { AppointmentInstrument } from '../entities/appointment-instrument.entity';
import { Service } from '../entities/service.entity';
import { ServiceInstrument } from '../entities/service-instrument.entity';
import { HolidayService } from './holiday.service';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';

export interface InstrumentSlot {
  instrumentCategoryId: string;
  categoryName: string;
  instrumentId?: string;
  startOffsetMinutes: number;
  endOffsetMinutes: number;
}

export interface AvailabilitySlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
  reason?: string;
  instrumentSlots?: InstrumentSlot[];
}

export interface CheckAvailabilityParams {
  operatorId: string;
  date: Date;
  startTime: string; // HH:mm format
  durationMinutes?: number;
  serviceId?: string;
  customInstrumentSlots?: InstrumentSlot[];
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  suggestedInstruments?: InstrumentSlot[];
}

@Injectable()
export class PhysiotherapistAvailabilityService {
  constructor(
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
    @InjectRepository(AvailabilityException)
    private exceptionRepo: Repository<AvailabilityException>,
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    @InjectRepository(TemplateAssignment)
    private assignmentRepo: Repository<TemplateAssignment>,
    @InjectRepository(Instrument)
    private instrumentRepo: Repository<Instrument>,
    @InjectRepository(AppointmentInstrument)
    private appointmentInstrumentRepo: Repository<AppointmentInstrument>,
    @InjectRepository(Service)
    private serviceRepo: Repository<Service>,
    @InjectRepository(ServiceInstrument)
    private serviceInstrumentRepo: Repository<ServiceInstrument>,
    private holidayService: HolidayService,
    private settingsService: GeneralSettingsService,
  ) {}

  /**
   * Check if an operator is available at a specific time
   */
  async checkAvailability(params: CheckAvailabilityParams): Promise<AvailabilityResult> {
    const { operatorId, date, startTime, serviceId, customInstrumentSlots } = params;
    let { durationMinutes } = params;

    // Determine final parameters: custom overrides service
    let requiredInstruments: ServiceInstrument[] = [];
    let instrumentOrderMatters = false;
    let requestedSlots = customInstrumentSlots;
    let serviceConfig: { defaultInstrumentSlotOffset?: number; reverseInstrumentOrder?: boolean } | undefined;

    if (serviceId) {
      const service = await this.serviceRepo.findOne({
        where: { id: serviceId },
        relations: ['requiredInstruments', 'requiredInstruments.instrumentCategory'],
      });

      if (!service) {
        return { available: false, reason: 'Servizio non trovato' };
      }

      // Use service duration if not provided
      if (!durationMinutes) {
        durationMinutes = service.defaultDuration;
      }

      // Always get instrumentOrderMatters from service
      instrumentOrderMatters = service.instrumentOrderMatters;

      // Get service configuration for instrument slot calculation
      serviceConfig = {
        defaultInstrumentSlotOffset: service.defaultInstrumentSlotOffset,
        reverseInstrumentOrder: service.reverseInstrumentOrder,
      };

      // Validate or use service instruments
      if (customInstrumentSlots && customInstrumentSlots.length > 0) {
        // Validate that custom slots match service requirements
        if (service.requiredInstruments && service.requiredInstruments.length > 0) {
          // Check that the number of instruments matches
          if (customInstrumentSlots.length !== service.requiredInstruments.length) {
            return {
              available: false,
              reason: `Il servizio richiede ${service.requiredInstruments.length} strumenti, forniti ${customInstrumentSlots.length}`,
            };
          }

          // Check that categories match (order matters if instrumentOrderMatters is true)
          const serviceCategories = service.requiredInstruments.map(ri => ri.instrumentCategoryId);
          const customCategories = customInstrumentSlots.map(cs => cs.instrumentCategoryId);

          if (instrumentOrderMatters) {
            // Categories must match in order
            for (let i = 0; i < serviceCategories.length; i++) {
              if (serviceCategories[i] !== customCategories[i]) {
                return {
                  available: false,
                  reason: `Categoria strumento ${i + 1} non corrisponde: richiesta ${serviceCategories[i]}, fornita ${customCategories[i]}`,
                };
              }
            }
          } else {
            // Categories must match but order doesn't matter
            const serviceCategoriesSet = new Set(serviceCategories);
            const customCategoriesSet = new Set(customCategories);

            for (const cat of customCategories) {
              if (!serviceCategoriesSet.has(cat)) {
                return {
                  available: false,
                  reason: `Categoria strumento non valida per questo servizio: ${cat}`,
                };
              }
            }

            for (const cat of serviceCategories) {
              if (!customCategoriesSet.has(cat)) {
                return {
                  available: false,
                  reason: `Categoria strumento mancante: ${cat}`,
                };
              }
            }
          }
        }
        // customInstrumentSlots will be used later in the flow
      } else if (service.requiredInstruments) {
        // Use service instruments
        requiredInstruments = service.requiredInstruments;
      }
    }

    // Validate that we have duration
    if (!durationMinutes) {
      return { available: false, reason: 'Durata appuntamento non specificata' };
    }

    // Validate duration values
    if (![15, 30, 45, 60].includes(durationMinutes)) {
      return { available: false, reason: 'Durata non valida. Valori ammessi: 15, 30, 45, 60 minuti' };
    }

    // 1. Check if operator exists and is active
    const operator = await this.operatorRepo.findOne({ where: { id: operatorId } });
    if (!operator || !operator.isActive) {
      return { available: false, reason: 'Operatore non trovato o non attivo' };
    }

    // 2. Check for exceptions (holidays, vacation, sick leave, etc.)
    const exception = await this.exceptionRepo.findOne({
      where: { operatorId, exceptionDate: date },
    });

    if (exception) {
      // If exception with modified hours, check if appointment fits
      if (exception.startTime && exception.endTime) {
        const appointmentStart = startTime;
        const appointmentEnd = this.addMinutesToTime(startTime, durationMinutes);

        if (appointmentStart < exception.startTime || appointmentEnd > exception.endTime) {
          return {
            available: false,
            reason: `Orario modificato: disponibile solo ${exception.startTime}-${exception.endTime} (${exception.reason || exception.exceptionType})`,
          };
        }
      } else {
        // Completely unavailable
        return {
          available: false,
          reason: `Non disponibile: ${exception.reason || exception.exceptionType}`,
        };
      }
    }

    // 3. Check template assignment (is operator working this day/time?)
    const templateCheck = await this.checkTemplateAvailability(operatorId, date, startTime, durationMinutes);
    if (!templateCheck.available) {
      return templateCheck;
    }

    // 4. Check for existing appointments (1 appointment at a time for physiotherapists)
    const appointmentEnd = this.addMinutesToTime(startTime, durationMinutes);
    const existingAppointment = await this.findOverlappingAppointment(operatorId, date, startTime, appointmentEnd);
    if (existingAppointment) {
      return {
        available: false,
        reason: `Appuntamento già presente: ${existingAppointment.startTime}-${existingAppointment.endTime}`,
      };
    }

    // 5. Check instruments if required (either from service or custom)
    if (customInstrumentSlots && customInstrumentSlots.length > 0) {
      // Custom instrument slots provided
      if (durationMinutes < 30) {
        return {
          available: false,
          reason: 'Durata minima 30 minuti per utilizzare strumenti',
        };
      }

      // Convert custom slots to ServiceInstrument format for validation
      const customRequiredInstruments: ServiceInstrument[] = customInstrumentSlots.map((slot, index) => ({
        id: `custom-${index}`,
        serviceId: serviceId || '',
        instrumentCategoryId: slot.instrumentCategoryId,
        sortOrder: index,
        instrumentCategory: undefined,
        service: undefined,
        isRequired: true,
        quantity: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ServiceInstrument));

      const instrumentCheck = await this.checkInstrumentAvailability(
        date,
        startTime,
        durationMinutes,
        customRequiredInstruments,
        instrumentOrderMatters,
        customInstrumentSlots,
        undefined, // No service config for custom slots
      );

      if (!instrumentCheck.available) {
        return instrumentCheck;
      }

      return {
        available: true,
        suggestedInstruments: instrumentCheck.suggestedInstruments,
      };
    } else if (requiredInstruments.length > 0) {
      // Service instruments
      if (durationMinutes < 30) {
        return {
          available: false,
          reason: 'Durata minima 30 minuti per utilizzare strumenti',
        };
      }

      const instrumentCheck = await this.checkInstrumentAvailability(
        date,
        startTime,
        durationMinutes,
        requiredInstruments,
        instrumentOrderMatters,
        requestedSlots,
        serviceConfig,
      );

      if (!instrumentCheck.available) {
        return instrumentCheck;
      }

      return {
        available: true,
        suggestedInstruments: instrumentCheck.suggestedInstruments,
      };
    }

    return { available: true };
  }

  /**
   * Check if operator has a template assignment for the given date/time
   */
  private async checkTemplateAvailability(
    operatorId: string,
    date: Date,
    startTime: string,
    durationMinutes: number,
  ): Promise<AvailabilityResult> {
    const endTime = this.addMinutesToTime(startTime, durationMinutes);

    // Find current template assignments for this operator
    const assignments = await this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.patternGroup', 'group')
      .leftJoinAndSelect('group.patterns', 'patterns')
      .where('assignment.operatorId = :operatorId', { operatorId })
      .andWhere('assignment.isCurrent = true')
      .andWhere('assignment.validFrom <= :date', { date })
      .andWhere('(assignment.validUntil IS NULL OR assignment.validUntil >= :date)', { date })
      .getMany();

    if (assignments.length === 0) {
      return { available: false, reason: 'Nessun template orario assegnato' };
    }

    // Check if any assignment covers this time slot
    for (const assignment of assignments) {
      const patternGroup = assignment.patternGroup;
      if (!patternGroup || !patternGroup.patterns) continue;

      // Calculate which day in the pattern cycle corresponds to the requested date
      // Normalize patternStartDate to local midnight to avoid timezone issues
      const patternStartRaw = new Date(assignment.patternStartDate);
      const patternStart = new Date(
        patternStartRaw.getFullYear(),
        patternStartRaw.getMonth(),
        patternStartRaw.getDate(),
      );
      // Normalize request date to local midnight
      const normalizedDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const diffTime = normalizedDate.getTime() - patternStart.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      // Use formula that handles negative days correctly
      const dayInPattern = ((diffDays % patternGroup.patternDuration) + patternGroup.patternDuration) % patternGroup.patternDuration;

      // Check all patterns for this day
      const todayPatterns = patternGroup.patterns.filter(
        p => p.dayInPattern === dayInPattern
      );

      for (const pattern of todayPatterns) {
        // Normalize time formats: DB stores "HH:MM:SS", code uses "HH:MM"
        const patternStart = pattern.startTime.substring(0, 5);
        const patternEnd = pattern.endTime.substring(0, 5);
        if (patternStart <= startTime && patternEnd >= endTime) {
          return { available: true };
        }
      }
    }

    return { available: false, reason: 'Fuori orario di lavoro' };
  }

  /**
   * Find overlapping appointment for an operator
   */
  private async findOverlappingAppointment(
    operatorId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<AvailabilityAppointment | null> {
    return this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.operatorId = :operatorId', { operatorId })
      .andWhere('appointment.appointmentDate = :date', { date })
      .andWhere('appointment.bookingStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: ['cancelled', 'no_show'],
      })
      .andWhere(
        '(appointment.startTime < :endTime AND appointment.endTime > :startTime)',
        { startTime, endTime },
      )
      .getOne();
  }

  /**
   * Check instrument availability and suggest assignments
   */
  private async checkInstrumentAvailability(
    date: Date,
    startTime: string,
    durationMinutes: number,
    requiredInstruments: ServiceInstrument[],
    orderMatters: boolean,
    requestedSlots?: InstrumentSlot[],
    serviceConfig?: { defaultInstrumentSlotOffset?: number; reverseInstrumentOrder?: boolean },
  ): Promise<AvailabilityResult> {
    const suggestedInstruments: InstrumentSlot[] = [];

    // Calculate instrument slots based on duration and order
    const instrumentSlots = this.calculateInstrumentSlots(
      durationMinutes,
      requiredInstruments.length,
      orderMatters,
      requestedSlots,
      serviceConfig,
    );

    if (!instrumentSlots) {
      return { available: false, reason: 'Configurazione slot strumenti non valida' };
    }

    // For each required instrument category, find an available instrument
    for (let i = 0; i < requiredInstruments.length; i++) {
      const required = requiredInstruments[i];
      const slot = instrumentSlots[i];

      if (!slot) continue;

      const slotStart = this.addMinutesToTime(startTime, slot.startOffsetMinutes);
      const slotEnd = this.addMinutesToTime(startTime, slot.endOffsetMinutes);

      // Find available instruments in this category
      const availableInstrument = await this.findAvailableInstrument(
        required.instrumentCategoryId,
        date,
        slotStart,
        slotEnd,
      );

      if (!availableInstrument) {
        return {
          available: false,
          reason: `Nessuno strumento disponibile per categoria ${required.instrumentCategory?.name || required.instrumentCategoryId} (${slotStart}-${slotEnd})`,
        };
      }

      suggestedInstruments.push({
        instrumentCategoryId: required.instrumentCategoryId,
        categoryName: required.instrumentCategory?.name || '',
        instrumentId: availableInstrument.id,
        startOffsetMinutes: slot.startOffsetMinutes,
        endOffsetMinutes: slot.endOffsetMinutes,
      });
    }

    return { available: true, suggestedInstruments };
  }

  /**
   * Calculate instrument slots based on appointment duration and requirements
   */
  private calculateInstrumentSlots(
    durationMinutes: number,
    instrumentCount: number,
    orderMatters: boolean,
    requestedSlots?: InstrumentSlot[],
    serviceConfig?: { defaultInstrumentSlotOffset?: number; reverseInstrumentOrder?: boolean },
  ): { startOffsetMinutes: number; endOffsetMinutes: number }[] | null {
    // If custom slots are provided, validate and use them
    if (requestedSlots && requestedSlots.length === instrumentCount) {
      return requestedSlots.map(s => ({
        startOffsetMinutes: s.startOffsetMinutes,
        endOffsetMinutes: s.endOffsetMinutes,
      }));
    }

    // Auto-calculate based on duration and count
    if (instrumentCount === 0) return [];

    if (instrumentCount === 1) {
      // Single instrument: use service configuration or default to first 30 minutes
      const offset = serviceConfig?.defaultInstrumentSlotOffset || 0;

      if (durationMinutes === 30) {
        return [{ startOffsetMinutes: 0, endOffsetMinutes: 30 }];
      } else if (durationMinutes === 45) {
        // 45 min: can be 0-30 or 15-45
        return [{ startOffsetMinutes: offset, endOffsetMinutes: offset + 30 }];
      } else if (durationMinutes === 60) {
        // 60 min: can be 0-30 or 30-60
        return [{ startOffsetMinutes: offset, endOffsetMinutes: offset + 30 }];
      }

      // Fallback for other durations
      return [{ startOffsetMinutes: 0, endOffsetMinutes: 30 }];
    }

    if (instrumentCount === 2) {
      if (durationMinutes === 45) {
        // 45 min with 2 instruments: overlap (0-30 and 15-45)
        const shouldReverse = !orderMatters && serviceConfig?.reverseInstrumentOrder;

        if (shouldReverse) {
          return [
            { startOffsetMinutes: 15, endOffsetMinutes: 45 },
            { startOffsetMinutes: 0, endOffsetMinutes: 30 },
          ];
        } else {
          return [
            { startOffsetMinutes: 0, endOffsetMinutes: 30 },
            { startOffsetMinutes: 15, endOffsetMinutes: 45 },
          ];
        }
      } else if (durationMinutes >= 60) {
        // 60 min with 2 instruments: sequential (0-30 and 30-60)
        return [
          { startOffsetMinutes: 0, endOffsetMinutes: 30 },
          { startOffsetMinutes: 30, endOffsetMinutes: 60 },
        ];
      }
    }

    return null;
  }

  /**
   * Find an available instrument in a category for a time slot
   */
  private async findAvailableInstrument(
    categoryId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<Instrument | null> {
    // Get all active instruments in the category
    const instruments = await this.instrumentRepo.find({
      where: {
        categoryId,
        status: InstrumentStatus.ACTIVE,
      },
    });

    // Check each instrument for availability
    for (const instrument of instruments) {
      const isBooked = await this.isInstrumentBooked(instrument.id, date, startTime, endTime);
      if (!isBooked) {
        return instrument;
      }
    }

    return null;
  }

  /**
   * Check if an instrument is already booked for a time slot
   */
  private async isInstrumentBooked(
    instrumentId: string,
    date: Date,
    startTime: string,
    endTime: string,
  ): Promise<boolean> {
    // Convert times to minutes for comparison
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    const bookings = await this.appointmentInstrumentRepo
      .createQueryBuilder('ai')
      .innerJoin('ai.appointment', 'appointment')
      .where('ai.instrumentId = :instrumentId', { instrumentId })
      .andWhere('appointment.appointmentDate = :date', { date })
      .andWhere('appointment.bookingStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: ['cancelled', 'no_show'],
      })
      .getMany();

    for (const booking of bookings) {
      const appointment = await this.appointmentRepo.findOne({
        where: { id: booking.appointmentId },
      });

      if (appointment) {
        const bookingStart = this.timeToMinutes(appointment.startTime) + booking.startOffsetMinutes;
        const bookingEnd = this.timeToMinutes(appointment.startTime) + booking.endOffsetMinutes;

        // Check for overlap
        if (startMinutes < bookingEnd && endMinutes > bookingStart) {
          return true;
        }
      }
    }

    return false;
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
   * Helper: Convert minutes to time string
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate the slot step duration based on operator preferences and system settings.
   * Priority:
   * 1. If system priority is 'system', use system default
   * 2. Otherwise use operator's preferredDurations[0] if set
   * 3. Fallback to system default (45 min)
   */
  private async calculateSlotStep(operator: Operator): Promise<number> {
    const priority = await this.settingsService.getSlotDurationPriority();
    const defaultDuration = await this.settingsService.getDefaultSlotDuration();
    const operatorDuration = operator.preferredDurations?.[0];

    if (priority === 'system') {
      return defaultDuration;
    }

    return operatorDuration || defaultDuration;
  }

  /**
   * Get all appointments for an operator on a given date (for gap calculation)
   */
  private async getOperatorAppointmentsForDate(
    operatorId: string,
    date: Date,
  ): Promise<{ startTime: string; endTime: string }[]> {
    const appointments = await this.appointmentRepo
      .createQueryBuilder('appointment')
      .where('appointment.operatorId = :operatorId', { operatorId })
      .andWhere('appointment.appointmentDate = :date', { date })
      .andWhere('appointment.bookingStatus NOT IN (:...excludedStatuses)', {
        excludedStatuses: ['cancelled', 'no_show'],
      })
      .orderBy('appointment.startTime', 'ASC')
      .getMany();

    return appointments.map(apt => ({
      startTime: apt.startTime,
      endTime: apt.endTime,
    }));
  }

  /**
   * Calculate free time blocks within a pattern, considering existing appointments.
   * Returns an array of free blocks (start/end in minutes).
   */
  private calculateFreeBlocks(
    patternStartMinutes: number,
    patternEndMinutes: number,
    appointments: { startTime: string; endTime: string }[],
  ): { startMinutes: number; endMinutes: number }[] {
    const freeBlocks: { startMinutes: number; endMinutes: number }[] = [];
    let currentStart = patternStartMinutes;

    // Sort appointments by start time and filter those within the pattern
    const relevantAppointments = appointments
      .map(apt => ({
        startMinutes: this.timeToMinutes(apt.startTime),
        endMinutes: this.timeToMinutes(apt.endTime),
      }))
      .filter(apt =>
        apt.startMinutes < patternEndMinutes && apt.endMinutes > patternStartMinutes
      )
      .sort((a, b) => a.startMinutes - b.startMinutes);

    for (const apt of relevantAppointments) {
      // Clamp appointment to pattern boundaries
      const aptStart = Math.max(apt.startMinutes, patternStartMinutes);
      const aptEnd = Math.min(apt.endMinutes, patternEndMinutes);

      if (currentStart < aptStart) {
        // There's a free block before this appointment
        freeBlocks.push({
          startMinutes: currentStart,
          endMinutes: aptStart,
        });
      }

      // Move current start to after this appointment
      currentStart = Math.max(currentStart, aptEnd);
    }

    // Add final block if there's time remaining
    if (currentStart < patternEndMinutes) {
      freeBlocks.push({
        startMinutes: currentStart,
        endMinutes: patternEndMinutes,
      });
    }

    return freeBlocks;
  }

  /**
   * Get available slots for an operator on a given date.
   *
   * Uses dynamic step based on operator preferences and system settings:
   * - Slots are generated at intervals of the preferred duration (step)
   * - After an appointment ends, slots restart from where it ends (no realignment)
   * - Gaps smaller than the requested duration are skipped
   */
  async getAvailableSlots(
    operatorId: string,
    date: Date,
    durationMinutes?: number,
    serviceId?: string,
    customInstrumentSlots?: InstrumentSlot[],
  ): Promise<AvailabilitySlot[]> {
    const slots: AvailabilitySlot[] = [];

    // Get operator to determine step duration
    const operator = await this.operatorRepo.findOne({ where: { id: operatorId } });
    if (!operator) {
      return slots;
    }

    // Calculate dynamic step based on operator/system preferences
    const slotStep = await this.calculateSlotStep(operator);

    // Get working hours from template
    const assignments = await this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.patternGroup', 'group')
      .leftJoinAndSelect('group.patterns', 'patterns')
      .where('assignment.operatorId = :operatorId', { operatorId })
      .andWhere('assignment.isCurrent = true')
      .andWhere('assignment.validFrom <= :date', { date })
      .andWhere('(assignment.validUntil IS NULL OR assignment.validUntil >= :date)', { date })
      .getMany();

    if (assignments.length === 0) {
      return slots;
    }

    // Determine duration if not provided (load service once outside loops)
    let finalDuration = durationMinutes;
    if (!finalDuration && serviceId) {
      const service = await this.serviceRepo.findOne({ where: { id: serviceId } });
      if (service) {
        finalDuration = service.defaultDuration;
      }
    }

    if (!finalDuration) {
      return slots; // Cannot determine duration, return empty slots
    }

    // Get existing appointments for this operator on this date
    const existingAppointments = await this.getOperatorAppointmentsForDate(operatorId, date);

    // Generate slots for each assignment pattern
    for (const assignment of assignments) {
      const patternGroup = assignment.patternGroup;
      if (!patternGroup || !patternGroup.patterns) continue;

      // Calculate which day in the pattern cycle corresponds to the requested date
      // Normalize patternStartDate to local midnight to avoid timezone issues
      const patternStartRaw = new Date(assignment.patternStartDate);
      const patternStart = new Date(
        patternStartRaw.getFullYear(),
        patternStartRaw.getMonth(),
        patternStartRaw.getDate(),
      );
      // Normalize request date to local midnight
      const requestDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const diffTime = requestDate.getTime() - patternStart.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const dayInPattern = ((diffDays % patternGroup.patternDuration) + patternGroup.patternDuration) % patternGroup.patternDuration;

      console.log('[getAvailableSlots] Pattern calculation:', {
        operatorId,
        requestedDate: date.toISOString(),
        patternStartDate: assignment.patternStartDate,
        patternStartNormalized: patternStart.toISOString(),
        requestDateNormalized: requestDate.toISOString(),
        diffDays,
        patternDuration: patternGroup.patternDuration,
        dayInPattern,
        availablePatternDays: patternGroup.patterns.map(p => p.dayInPattern).join(','),
      });

      // Get all patterns for this day in the cycle
      const todayPatterns = patternGroup.patterns.filter(
        p => p.dayInPattern === dayInPattern
      );

      console.log('[getAvailableSlots] Patterns for today:', {
        dayInPattern,
        patternsFound: todayPatterns.length,
        patterns: todayPatterns.map(p => `${p.startTime}-${p.endTime}`).join(', '),
      });

      for (const pattern of todayPatterns) {
        const patternStartMinutes = this.timeToMinutes(pattern.startTime);
        const patternEndMinutes = this.timeToMinutes(pattern.endTime);

        // Calculate free blocks considering existing appointments
        const freeBlocks = this.calculateFreeBlocks(
          patternStartMinutes,
          patternEndMinutes,
          existingAppointments,
        );

        console.log('[getAvailableSlots] Free blocks for pattern:', {
          pattern: `${pattern.startTime}-${pattern.endTime}`,
          existingAppointments: existingAppointments.length,
          freeBlocks: freeBlocks.map(b => `${this.minutesToTime(b.startMinutes)}-${this.minutesToTime(b.endMinutes)}`).join(', '),
          slotStep,
          effectiveStep: Math.max(slotStep, finalDuration),
          finalDuration,
        });

        // Generate slots within each free block
        // Step equals requested duration to show all possible slots
        // This allows multiple shorter appointments within operator's preferred slot
        const effectiveStep = finalDuration;

        for (const block of freeBlocks) {
          let currentMinutes = block.startMinutes;

          // Generate slots with step, starting from block start
          // IMPORTANT: The loop condition already ensures the slot fits within the free block
          // But we also verify via checkAvailability to ensure it respects pattern boundaries
          while (currentMinutes + finalDuration <= block.endMinutes) {
            const currentTime = this.minutesToTime(currentMinutes);

            const result = await this.checkAvailability({
              operatorId,
              date,
              startTime: currentTime,
              durationMinutes: finalDuration,
              serviceId,
              customInstrumentSlots,
            });

            // Only add slots that pass availability check
            // This filters out slots that would cross pattern boundaries (e.g., lunch breaks)
            if (result.available) {
              const startDate = new Date(date);
              const [hours, mins] = currentTime.split(':').map(Number);
              startDate.setHours(hours, mins, 0, 0);

              const endDate = new Date(startDate);
              endDate.setMinutes(endDate.getMinutes() + finalDuration);

              slots.push({
                startTime: startDate,
                endTime: endDate,
                available: true,
                reason: result.reason,
                instrumentSlots: result.suggestedInstruments,
              });
            }

            // Advance by effective step (never less than duration)
            currentMinutes += effectiveStep;
          }
        }
      }
    }

    return slots;
  }
}
