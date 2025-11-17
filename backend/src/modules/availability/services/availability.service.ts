import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, Not, In } from 'typeorm';
import { AvailabilityTemplate } from '../entities/availability-template.entity';
import { TemplatePattern } from '../entities/template-pattern.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { AvailabilityException } from '../entities/availability-exception.entity';
import { AvailabilityCache } from '../entities/availability-cache.entity';
import { Operator } from '../entities/operator.entity';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { GroupException } from '../entities/group-exception.entity';
import { CreateAvailabilityTemplateInput } from '../dto/create-availability-template.input';
import { CreateTemplatePatternInput } from '../dto/create-template-pattern.input';
import { AssignTemplateToOperatorInput } from '../dto/assign-template-to-operator.input';
import { DailyAvailability, AvailabilitySlot } from '../dto/availability-slot.output';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(AvailabilityTemplate)
    private templateRepo: Repository<AvailabilityTemplate>,
    @InjectRepository(TemplatePattern)
    private patternRepo: Repository<TemplatePattern>,
    @InjectRepository(TemplateAssignment)
    private assignmentRepo: Repository<TemplateAssignment>,
    @InjectRepository(AvailabilityException)
    private exceptionRepo: Repository<AvailabilityException>,
    @InjectRepository(AvailabilityCache)
    private cacheRepo: Repository<AvailabilityCache>,
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    @InjectRepository(GroupException)
    private groupExceptionRepo: Repository<GroupException>,
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

  /**
   * Create a generic template pattern without operator assignment
   * This allows creating reusable patterns for template management
   */
  async createTemplatePattern(input: CreateTemplatePatternInput): Promise<TemplatePattern[]> {
    // Validate pattern configuration
    if (input.dayInPattern >= input.patternDuration) {
      throw new BadRequestException('dayInPattern must be less than patternDuration');
    }

    // Check if pattern with same characteristics already exists
    const existing = await this.patternRepo.findOne({
      where: {
        name: input.name,
        dayInPattern: input.dayInPattern,
        patternDuration: input.patternDuration,
        startTime: input.startTime,
        endTime: input.endTime,
      }
    });

    if (existing) {
      throw new BadRequestException(`Template pattern with these characteristics already exists`);
    }

    // Create the pattern entry
    const pattern = this.patternRepo.create({
      name: input.name,
      description: input.description,
      dayInPattern: input.dayInPattern,
      patternDuration: input.patternDuration,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    const saved = await this.patternRepo.save(pattern);

    return [saved];
  }

  /**
   * Update an existing template pattern by ID
   */
  async updateTemplatePattern(id: string, input: CreateTemplatePatternInput): Promise<TemplatePattern> {
    // Validate pattern configuration
    if (input.dayInPattern >= input.patternDuration) {
      throw new BadRequestException('dayInPattern must be less than patternDuration');
    }

    // Find the pattern to update
    const pattern = await this.patternRepo.findOne({ where: { id } });
    if (!pattern) {
      throw new NotFoundException('Template pattern not found');
    }

    // Update pattern fields
    pattern.name = input.name;
    pattern.description = input.description;
    pattern.dayInPattern = input.dayInPattern;
    pattern.patternDuration = input.patternDuration;
    pattern.startTime = input.startTime;
    pattern.endTime = input.endTime;

    return await this.patternRepo.save(pattern);
  }

  /**
   * Delete a template pattern by ID
   */
  async deleteTemplatePattern(id: string): Promise<boolean> {
    const pattern = await this.patternRepo.findOne({ where: { id } });
    if (!pattern) {
      throw new NotFoundException('Template pattern not found');
    }

    await this.patternRepo.delete(id);
    return true;
  }

  /**
   * Assign an existing template pattern to an operator with validity dates
   * Creates assignment entries linking patterns to operator
   */
  async assignTemplateToOperator(input: AssignTemplateToOperatorInput): Promise<TemplateAssignment[]> {
    // Validate operator exists
    const operator = await this.operatorRepo.findOne({ where: { id: input.operatorId } });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    // Find all pattern entries by name
    const patterns = await this.patternRepo.find({
      where: { name: input.templateName }
    });

    if (patterns.length === 0) {
      throw new NotFoundException(`Template pattern "${input.templateName}" not found`);
    }

    // Deactivate current assignments for this operator
    await this.assignmentRepo.update(
      { operatorId: input.operatorId, isCurrent: true },
      { isCurrent: false }
    );

    // Create new assignments linking patterns to operator
    const newAssignments: TemplateAssignment[] = [];

    for (const pattern of patterns) {
      const assignment = this.assignmentRepo.create({
        operatorId: input.operatorId,
        patternId: pattern.id,
        patternStartDate: new Date(input.patternStartDate),
        validFrom: new Date(input.validFrom),
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        isCurrent: true,
        version: 1
      });

      const saved = await this.assignmentRepo.save(assignment);
      newAssignments.push(saved);
    }

    // Rebuild cache for affected period
    const cacheEndDate = input.validUntil ||
      new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

    await this.rebuildCache(input.operatorId, input.validFrom, cacheEndDate);

    return newAssignments;
  }

  /**
   * Get all template patterns (generic, not assigned to operators)
   * Groups patterns by name for UI display
   */
  async getAllTemplatePatterns(): Promise<TemplatePattern[]> {
    return this.patternRepo.find({
      order: {
        name: 'ASC',
        dayInPattern: 'ASC',
      }
    });
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
    // Query all appointments for this operator in the date range
    const appointments = await this.appointmentRepo.find({
      where: {
        operatorId,
        appointmentDate: Between(startDate, endDate),
        status: Not(In(['cancelled', 'no_show']))
      }
    });

    // Group appointments by date for efficient processing
    const appointmentsByDate = new Map<string, typeof appointments>();
    appointments.forEach(appointment => {
      const dateKey = appointment.appointmentDate.toISOString().split('T')[0];
      if (!appointmentsByDate.has(dateKey)) {
        appointmentsByDate.set(dateKey, []);
      }
      appointmentsByDate.get(dateKey)!.push(appointment);
    });

    // Update cache for each date
    for (const [dateStr, dateAppointments] of appointmentsByDate) {
      // Get all cache slots for this date
      const cacheSlots = await this.cacheRepo.find({
        where: {
          operatorId,
          availableDate: new Date(dateStr)
        }
      });

      // Update each cache slot with appointment count
      for (const slot of cacheSlots) {
        // Count appointments that overlap with this slot
        const overlappingCount = dateAppointments.filter(apt => {
          // Check if appointment time overlaps with cache slot
          return this.timeOverlaps(
            apt.startTime, apt.endTime,
            slot.startTime, slot.endTime
          );
        }).reduce((sum, apt) => sum + (apt.participantCount || 1), 0);

        // Update the cache slot
        await this.cacheRepo.update(slot.id, {
          bookedCapacity: overlappingCount
        });
      }
    }
  }

  private timeOverlaps(
    start1: string, end1: string,
    start2: string, end2: string
  ): boolean {
    // Convert time strings to minutes for comparison
    const toMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const start1Min = toMinutes(start1);
    const end1Min = toMinutes(end1);
    const start2Min = toMinutes(start2);
    const end2Min = toMinutes(end2);

    // Check if times overlap
    return start1Min < end2Min && end1Min > start2Min;
  }

  // Group Exception Methods
  async createGroupException(input: {
    name: string;
    exceptionDate: string;
    exceptionType: string;
    appliesToAll?: boolean;
    operatorIds?: string[];
    reason?: string;
  }): Promise<GroupException> {
    const groupException = this.groupExceptionRepo.create({
      name: input.name,
      exceptionDate: new Date(input.exceptionDate),
      exceptionType: input.exceptionType,
      appliesToAll: input.appliesToAll || false,
      reason: input.reason
    });

    // Save the group exception
    const savedGroupException = await this.groupExceptionRepo.save(groupException);

    // If specific operators are provided, create individual exceptions
    if (input.operatorIds && input.operatorIds.length > 0) {
      for (const operatorId of input.operatorIds) {
        await this.exceptionRepo.save({
          operatorId,
          exceptionDate: new Date(input.exceptionDate),
          exceptionType: input.exceptionType as any,
          groupExceptionId: savedGroupException.id,
          reason: input.reason
        });

        // Rebuild cache for affected date
        await this.rebuildCache(operatorId, input.exceptionDate, input.exceptionDate);
      }
    } else if (input.appliesToAll) {
      // Apply to all active operators
      const operators = await this.operatorRepo.find({ where: { isActive: true } });

      for (const operator of operators) {
        await this.exceptionRepo.save({
          operatorId: operator.id,
          exceptionDate: new Date(input.exceptionDate),
          exceptionType: input.exceptionType as any,
          groupExceptionId: savedGroupException.id,
          reason: input.reason
        });

        // Rebuild cache for affected date
        await this.rebuildCache(operator.id, input.exceptionDate, input.exceptionDate);
      }
    }

    return savedGroupException;
  }

  async deleteGroupException(id: string): Promise<boolean> {
    const groupException = await this.groupExceptionRepo.findOne({ where: { id } });
    if (!groupException) {
      throw new NotFoundException('Group exception not found');
    }

    // Get all related individual exceptions before deletion
    const exceptions = await this.exceptionRepo.find({
      where: { groupExceptionId: id }
    });

    // Delete the group exception (cascade will handle individual exceptions)
    await this.groupExceptionRepo.delete(id);

    // Rebuild cache for all affected operators
    const dateStr = groupException.exceptionDate.toISOString().split('T')[0];
    for (const exception of exceptions) {
      await this.rebuildCache(exception.operatorId, dateStr, dateStr);
    }

    return true;
  }

  async getGroupExceptions(): Promise<GroupException[]> {
    return this.groupExceptionRepo.find({
      order: { exceptionDate: 'DESC' },
      relations: ['exceptions']
    });
  }
}