import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AvailabilityTemplate } from '../entities/availability-template.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { AvailabilityCache } from '../entities/availability-cache.entity';
import { Operator } from '../entities/operator.entity';
import { CreateAvailabilityTemplateInput } from '../dto/create-availability-template.input';
import { DailyAvailability, AvailabilitySlot } from '../dto/availability-slot.output';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(AvailabilityTemplate)
    private templateRepo: Repository<AvailabilityTemplate>,
    @InjectRepository(AvailabilityException)
    private exceptionRepo: Repository<AvailabilityException>,
    @InjectRepository(AvailabilityCache)
    private cacheRepo: Repository<AvailabilityCache>,
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
  ) {}

  async getTemplates(operatorId: string, onlyCurrent: boolean = true): Promise<AvailabilityTemplate[]> {
    const query = this.templateRepo.createQueryBuilder('template')
      .where('template.operatorId = :operatorId', { operatorId });

    if (onlyCurrent) {
      query.andWhere('template.isCurrent = :isCurrent', { isCurrent: true });
    }

    return query.orderBy('template.validFrom', 'DESC').getMany();
  }

  async getOperatorAvailability(
    operatorId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyAvailability[]> {
    // First, ensure cache is up to date
    await this.ensureCacheUpdated(operatorId, startDate, endDate);

    // Fetch from cache
    const slots = await this.cacheRepo.find({
      where: {
        operatorId,
        availableDate: Between(new Date(startDate), new Date(endDate))
      },
      order: {
        availableDate: 'ASC',
        startTime: 'ASC'
      }
    });

    // Group by date
    const availabilityByDate = new Map<string, AvailabilitySlot[]>();

    for (const slot of slots) {
      const dateStr = slot.availableDate.toISOString().split('T')[0];

      if (!availabilityByDate.has(dateStr)) {
        availabilityByDate.set(dateStr, []);
      }

      availabilityByDate.get(dateStr)!.push({
        operatorId: slot.operatorId,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        totalCapacity: slot.totalCapacity,
        bookedCapacity: slot.bookedCapacity,
        availableCapacity: slot.availableCapacity,
        isAvailable: slot.isAvailable,
        source: slot.source,
        sourceId: slot.sourceId
      });
    }

    // Convert to array
    const result: DailyAvailability[] = [];
    for (const [date, daySlots] of availabilityByDate) {
      result.push({
        date,
        slots: daySlots,
        hasAvailability: daySlots.some(s => s.isAvailable)
      });
    }

    return result;
  }

  async getAvailableSlots(
    date: string,
    operatorId?: string,
    serviceId?: string
  ): Promise<AvailabilitySlot[]> {
    const query = this.cacheRepo.createQueryBuilder('cache')
      .where('cache.availableDate = :date', { date: new Date(date) })
      .andWhere('cache.totalCapacity > cache.bookedCapacity');

    if (operatorId) {
      query.andWhere('cache.operatorId = :operatorId', { operatorId });
    }

    const slots = await query.orderBy('cache.startTime', 'ASC').getMany();

    return slots.map(slot => ({
      operatorId: slot.operatorId,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      totalCapacity: slot.totalCapacity,
      bookedCapacity: slot.bookedCapacity,
      availableCapacity: slot.availableCapacity,
      isAvailable: slot.isAvailable,
      source: slot.source,
      sourceId: slot.sourceId
    }));
  }

  async checkSlotAvailability(
    operatorId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    const slot = await this.cacheRepo.findOne({
      where: {
        operatorId,
        availableDate: new Date(date),
        startTime: LessThanOrEqual(startTime),
        endTime: MoreThanOrEqual(endTime)
      }
    });

    return slot ? slot.isAvailable : false;
  }

  async createTemplate(input: CreateAvailabilityTemplateInput): Promise<AvailabilityTemplate> {
    // Validate operator exists
    const operator = await this.operatorRepo.findOne({ where: { id: input.operatorId } });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    // Validate pattern configuration
    if (input.dayInPattern >= input.patternDuration) {
      throw new BadRequestException('dayInPattern must be less than patternDuration');
    }

    // Deactivate current templates if creating a new current one
    await this.templateRepo.update(
      { operatorId: input.operatorId, isCurrent: true },
      { isCurrent: false }
    );

    // Create new template
    const template = this.templateRepo.create({
      ...input,
      patternStartDate: new Date(input.patternStartDate),
      validFrom: new Date(input.validFrom),
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      isCurrent: true,
      version: 1
    });

    const saved = await this.templateRepo.save(template);

    // Rebuild cache for affected period
    const cacheEndDate = input.validUntil ||
      new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

    await this.rebuildCache(input.operatorId, input.validFrom, cacheEndDate);

    return saved;
  }

  async updateTemplate(id: string, input: CreateAvailabilityTemplateInput): Promise<AvailabilityTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Create new version instead of updating
    const newTemplate = await this.createTemplate({
      ...input,
      operatorId: template.operatorId
    });

    // Mark old template as not current
    await this.templateRepo.update(id, {
      isCurrent: false,
      validUntil: new Date().toISOString().split('T')[0]
    });

    return newTemplate;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.templateRepo.delete(id);

    // Rebuild cache
    await this.rebuildCache(
      template.operatorId,
      template.validFrom.toISOString().split('T')[0],
      template.validUntil?.toISOString().split('T')[0] ||
        new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
    );

    return true;
  }

  async createException(input: {
    operatorId: string;
    date: string;
    type: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }): Promise<AvailabilityException> {
    const exception = this.exceptionRepo.create({
      ...input,
      exceptionDate: new Date(input.date),
      exceptionType: input.type as any
    });

    const saved = await this.exceptionRepo.save(exception);

    // Rebuild cache for that date
    await this.rebuildCache(input.operatorId, input.date, input.date);

    return saved;
  }

  async rebuildCache(operatorId: string, startDate: string, endDate: string): Promise<void> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Clear existing cache for date range
    await this.cacheRepo.delete({
      operatorId,
      availableDate: Between(start, end)
    });

    // Get current templates
    const templates = await this.templateRepo.find({
      where: {
        operatorId,
        isCurrent: true,
        validFrom: LessThanOrEqual(end),
      }
    });

    // Get exceptions for the period
    const exceptions = await this.exceptionRepo.find({
      where: {
        operatorId,
        exceptionDate: Between(start, end)
      }
    });

    // Build exception map for quick lookup
    const exceptionMap = new Map<string, AvailabilityException>();
    exceptions.forEach(ex => {
      const dateStr = ex.exceptionDate.toISOString().split('T')[0];
      exceptionMap.set(dateStr, ex);
    });

    // Get operator for capacity info
    const operator = await this.operatorRepo.findOne({ where: { id: operatorId } });
    if (!operator) return;

    // Process each date
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const exception = exceptionMap.get(dateStr);

      if (exception) {
        // Handle exception
        if (exception.exceptionType === 'modified' && exception.startTime && exception.endTime) {
          await this.cacheRepo.save({
            operatorId,
            availableDate: current,
            startTime: exception.startTime,
            endTime: exception.endTime,
            totalCapacity: operator.maxConcurrentAppointments,
            bookedCapacity: 0, // Will be updated separately
            source: 'exception',
            sourceId: exception.id
          });
        }
        // If unavailable, don't create cache entry
      } else {
        // Apply templates
        for (const template of templates) {
          if (current >= template.validFrom &&
              (!template.validUntil || current <= template.validUntil)) {

            // Calculate pattern day
            const patternDay = this.getPatternDay(
              current,
              template.patternStartDate,
              template.patternDuration
            );

            if (patternDay === template.dayInPattern) {
              await this.cacheRepo.save({
                operatorId,
                availableDate: current,
                startTime: template.startTime,
                endTime: template.endTime,
                totalCapacity: operator.maxConcurrentAppointments,
                bookedCapacity: 0, // Will be updated separately
                source: 'template',
                sourceId: template.id
              });
            }
          }
        }
      }

      current.setDate(current.getDate() + 1);
    }

    // Update booked capacity (would need to query appointments table)
    // This is a simplified version - in production you'd update based on actual appointments
    await this.updateBookedCapacity(operatorId, start, end);
  }

  private getPatternDay(date: Date, patternStart: Date, patternDuration: number): number {
    const diffTime = Math.abs(date.getTime() - patternStart.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays % patternDuration;
  }

  private async ensureCacheUpdated(operatorId: string, startDate: string, endDate: string): Promise<void> {
    // Check if cache exists for the period
    const cacheCount = await this.cacheRepo.count({
      where: {
        operatorId,
        availableDate: Between(new Date(startDate), new Date(endDate))
      }
    });

    // If no cache entries, rebuild
    if (cacheCount === 0) {
      await this.rebuildCache(operatorId, startDate, endDate);
    }
  }

  private async updateBookedCapacity(operatorId: string, startDate: Date, endDate: Date): Promise<void> {
    // This would typically query the appointments table
    // For now, just setting to 0
    // In production, you'd do something like:
    /*
    const appointments = await this.appointmentRepo.find({
      where: {
        operatorId,
        appointmentDate: Between(startDate, endDate),
        status: Not(In(['cancelled', 'no_show']))
      }
    });

    // Update cache based on appointments
    for (const appointment of appointments) {
      await this.cacheRepo.update(
        {
          operatorId,
          availableDate: appointment.appointmentDate,
          // Add time overlap check
        },
        {
          bookedCapacity: () => 'bookedCapacity + 1'
        }
      );
    }
    */
  }
}