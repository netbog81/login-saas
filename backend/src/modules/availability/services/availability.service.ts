import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, Not, In, DataSource } from 'typeorm';
import { AvailabilityTemplate } from '../entities/availability-template.entity';
import { TemplatePattern } from '../entities/template-pattern.entity';
import { PatternGroup } from '../entities/pattern-group.entity';
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
import { toDateString } from '../utils/date-string.util';
import {
  DayBand,
  applyDayExceptions,
  classifyDayExceptions,
} from '../utils/day-exception-semantics.util';
import { OperatorAvailabilityV3, DayAvailabilityV3, TimeBlockV3 } from '../dto/operator-availability-v3.type';

import { TenantContextService } from '@curandis/tenant-datasource';
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get templateRepo() { return this.dataSource.getRepository(AvailabilityTemplate); }

  private get patternRepo() { return this.dataSource.getRepository(TemplatePattern); }

  private get patternGroupRepo() { return this.dataSource.getRepository(PatternGroup); }

  private get assignmentRepo() { return this.dataSource.getRepository(TemplateAssignment); }

  private get exceptionRepo() { return this.dataSource.getRepository(AvailabilityException); }

  private get cacheRepo() { return this.dataSource.getRepository(AvailabilityCache); }

  private get operatorRepo() { return this.dataSource.getRepository(Operator); }

  private get appointmentRepo() { return this.dataSource.getRepository(AvailabilityAppointment); }

  private get groupExceptionRepo() { return this.dataSource.getRepository(GroupException); }

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
      // Handle both Date object and string
      const dateStr = slot.availableDate instanceof Date
        ? slot.availableDate.toISOString().split('T')[0]
        : String(slot.availableDate).split('T')[0];

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

  /**
   * Bulk: Ottiene la disponibilità per più operatori in un range di date.
   * Ritorna un array flat di DailyAvailability con operatorId aggiunto.
   */
  async getOperatorsAvailability(
    operatorIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<{ operatorId: string; availability: DailyAvailability[] }[]> {
    if (operatorIds.length === 0) return [];

    // Aggiorna cache per tutti gli operatori in parallelo
    await Promise.all(operatorIds.map(id => this.ensureCacheUpdated(id, startDate, endDate)));

    // Singola query per tutti gli operatori
    const slots = await this.cacheRepo.find({
      where: {
        operatorId: In(operatorIds),
        availableDate: Between(new Date(startDate), new Date(endDate)),
      },
      order: { operatorId: 'ASC', availableDate: 'ASC', startTime: 'ASC' },
    });

    // Raggruppa per operatorId → date → slots
    const byOperator = new Map<string, Map<string, AvailabilitySlot[]>>();
    for (const slot of slots) {
      const dateStr = slot.availableDate instanceof Date
        ? slot.availableDate.toISOString().split('T')[0]
        : String(slot.availableDate).split('T')[0];

      if (!byOperator.has(slot.operatorId)) byOperator.set(slot.operatorId, new Map());
      const dateMap = byOperator.get(slot.operatorId)!;
      if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
      dateMap.get(dateStr)!.push({
        operatorId: slot.operatorId,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        totalCapacity: slot.totalCapacity,
        bookedCapacity: slot.bookedCapacity,
        availableCapacity: slot.availableCapacity,
        isAvailable: slot.isAvailable,
        source: slot.source,
        sourceId: slot.sourceId,
      });
    }

    return operatorIds.map(opId => ({
      operatorId: opId,
      availability: Array.from(byOperator.get(opId)?.entries() || []).map(([date, daySlots]) => ({
        date,
        slots: daySlots,
        hasAvailability: daySlots.some(s => s.isAvailable),
      })),
    }));
  }

  /**
   * Bulk diretto: calcola la disponibilità per più operatori senza usare la cache.
   * Usa ~5 query aggregate per tutti gli operatori, calcolando tutto in memoria.
   */
  async getOperatorsAvailabilityDirect(
    operatorIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<{ operatorId: string; availability: DailyAvailability[] }[]> {
    if (operatorIds.length === 0) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Template assignments per tutti gli operatori (1 query)
    const allAssignments = await this.assignmentRepo.find({
      where: { operatorId: In(operatorIds), isCurrent: true },
      relations: ['patternGroup', 'patternGroup.patterns'],
    });

    // 2. Exceptions per tutti gli operatori nel range (1 query)
    const allExceptions = await this.exceptionRepo.find({
      where: { operatorId: In(operatorIds), exceptionDate: Between(start, end) },
    });

    // 3. Operatori per capacity info (1 query)
    const operators = await this.operatorRepo.find({ where: { id: In(operatorIds) } });
    const operatorMap = new Map(operators.map(o => [o.id, o]));

    // 4. Conteggi prenotazioni per tutti gli operatori nel range (1 query aggregata)
    const bookingCounts = await this.appointmentRepo
      .createQueryBuilder('apt')
      .select([
        'apt."operatorId" as "operatorId"',
        'apt."appointmentDate" as "appointmentDate"',
        'apt."startTime" as "startTime"',
        'apt."endTime" as "endTime"',
        'COUNT(*)::int as count',
      ])
      .where('apt."operatorId" IN (:...operatorIds)', { operatorIds })
      .andWhere('apt."appointmentDate" BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('apt."bookingStatus" NOT IN (:...excluded)', {
        excluded: ['cancelled', 'cancelled_early', 'cancelled_late', 'no_show'],
      })
      .groupBy('apt."operatorId", apt."appointmentDate", apt."startTime", apt."endTime"')
      .getRawMany();

    // Indicizza: "operatorId|date|startTime" → count
    const bookingMap = new Map<string, number>();
    for (const row of bookingCounts) {
      const dateStr = row.appointmentDate instanceof Date
        ? row.appointmentDate.toISOString().split('T')[0]
        : String(row.appointmentDate).split('T')[0];
      bookingMap.set(`${row.operatorId}|${dateStr}|${row.startTime}`, row.count);
    }

    // Indicizza assignments per operatorId
    const assignmentsByOp = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      if (!assignmentsByOp.has(a.operatorId)) assignmentsByOp.set(a.operatorId, []);
      assignmentsByOp.get(a.operatorId)!.push(a);
    }

    // Indicizza exceptions per "operatorId|date". ARRAY: dal 2026-07 sono
    // ammesse più eccezioni per giorno (assenze a fascia oraria).
    const exceptionsByOpDate = new Map<string, AvailabilityException[]>();
    for (const ex of allExceptions) {
      const dateStr = ex.exceptionDate instanceof Date
        ? ex.exceptionDate.toISOString().split('T')[0]
        : String(ex.exceptionDate).split('T')[0];
      const key = `${ex.operatorId}|${dateStr}`;
      if (!exceptionsByOpDate.has(key)) exceptionsByOpDate.set(key, []);
      exceptionsByOpDate.get(key)!.push(ex);
    }

    // Genera date nel range
    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // Calcola disponibilità per ogni operatore in memoria
    return operatorIds.map(opId => {
      const operator = operatorMap.get(opId);
      const maxCapacity = operator?.maxConcurrentAppointments || 1;
      const assignments = assignmentsByOp.get(opId) || [];
      const dailyResults: DailyAvailability[] = [];

      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        const dayExceptions = exceptionsByOpDate.get(`${opId}|${dateStr}`) || [];
        const slots: AvailabilitySlot[] = [];

        // Semantica delle eccezioni del giorno (assenze giornata intera /
        // a fascia, MODIFIED, disponibilità straordinarie): centralizzata in
        // day-exception-semantics.util.ts.
        const cls = classifyDayExceptions(dayExceptions);

        // Fasce lorde da template per il giorno.
        const templateBands: DayBand[] = [];
        for (const assignment of assignments) {
          if (date >= assignment.validFrom && (!assignment.validUntil || date <= assignment.validUntil)) {
            const pg = assignment.patternGroup;
            if (!pg?.patterns) continue;

            const patternDay = this.getPatternDay(date, assignment.patternStartDate, pg.patternDuration);
            for (const pattern of pg.patterns) {
              if (pattern.dayInPattern === patternDay) {
                templateBands.push({
                  start: this.hhmmToMinutes(pattern.startTime),
                  end: this.hhmmToMinutes(pattern.endTime),
                  source: 'pattern',
                  sourceId: pattern.id,
                });
              }
            }
          }
        }

        for (const band of applyDayExceptions(templateBands, cls)) {
          const startTime = this.minutesToHHmm(band.start);
          const endTime = this.minutesToHHmm(band.end);
          const booked = bookingMap.get(`${opId}|${dateStr}|${startTime}`) || 0;
          slots.push({
            operatorId: opId,
            date: dateStr,
            startTime,
            endTime,
            totalCapacity: maxCapacity,
            bookedCapacity: booked,
            availableCapacity: Math.max(0, maxCapacity - booked),
            isAvailable: booked < maxCapacity,
            source: band.source ?? 'pattern',
            sourceId: band.sourceId ?? '',
          });
        }

        if (slots.length > 0) {
          dailyResults.push({
            date: dateStr,
            slots,
            hasAvailability: slots.some(s => s.isAvailable),
          });
        }
      }

      return { operatorId: opId, availability: dailyResults };
    });
  }

  // ==================== DISPONIBILITA' V3 (free-blocks) ====================

  /**
   * Disponibilita' operatori per il Calendario V3.
   *
   * A differenza di getOperatorsAvailabilityDirect (che marca una fascia
   * template intera come non disponibile appena un appuntamento la tocca),
   * questo metodo restituisce i "free block" REALI: ogni fascia di
   * template/eccezione viene decurtata degli intervalli effettivamente
   * occupati dagli appuntamenti.
   *
   * Capacita': un minuto e' considerato occupato solo quando il numero di
   * appuntamenti sovrapposti raggiunge maxConcurrentAppointments. Per gli
   * operatori 1:1 (caso standard) ogni appuntamento decurta la fascia; per
   * operatori a capacita' multipla (es. palestra) la fascia resta libera
   * finche' non si saturano tutti i posti.
   *
   * Non usa availability_cache: calcola tutto in memoria con poche query,
   * stesso approccio di getOperatorsAvailabilityDirect.
   */
  async getOperatorsAvailabilityV3(
    operatorIds: string[],
    startDate: string,
    endDate: string,
    excludeAppointmentId?: string,
  ): Promise<OperatorAvailabilityV3[]> {
    if (operatorIds.length === 0) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Query: template assignments, exceptions, operators, appuntamenti.
    const allAssignments = await this.assignmentRepo.find({
      where: { operatorId: In(operatorIds), isCurrent: true },
      relations: ['patternGroup', 'patternGroup.patterns'],
    });
    const allExceptions = await this.exceptionRepo.find({
      where: { operatorId: In(operatorIds), exceptionDate: Between(start, end) },
    });
    const operators = await this.operatorRepo.find({ where: { id: In(operatorIds) } });
    const operatorMap = new Map(operators.map(o => [o.id, o]));

    // Appuntamenti attivi nel range: servono start/end per la sottrazione.
    const appointments = await this.appointmentRepo.find({
      where: {
        operatorId: In(operatorIds),
        appointmentDate: Between(start, end),
        bookingStatus: Not(In(['cancelled', 'cancelled_early', 'cancelled_late', 'no_show'])),
      },
      select: ['id', 'operatorId', 'appointmentDate', 'startTime', 'endTime', 'participantCount'],
    });

    // Indicizza appuntamenti per "operatorId|date". Esclude l'appuntamento
    // indicato (es. quello in fase di update): il suo intervallo non deve
    // contare come occupato per se stesso → niente falso positivo quando
    // lo si sposta nello spazio che gia' occupava.
    const apptsByOpDate = new Map<string, { start: number; end: number; weight: number }[]>();
    for (const apt of appointments) {
      if (excludeAppointmentId && apt.id === excludeAppointmentId) continue;
      const dateStr = apt.appointmentDate instanceof Date
        ? apt.appointmentDate.toISOString().split('T')[0]
        : String(apt.appointmentDate).split('T')[0];
      const key = `${apt.operatorId}|${dateStr}`;
      if (!apptsByOpDate.has(key)) apptsByOpDate.set(key, []);
      apptsByOpDate.get(key)!.push({
        start: this.hhmmToMinutes(apt.startTime),
        end: this.hhmmToMinutes(apt.endTime),
        weight: apt.participantCount || 1,
      });
    }

    // Indicizza assignments per operatorId.
    const assignmentsByOp = new Map<string, typeof allAssignments>();
    for (const a of allAssignments) {
      if (!assignmentsByOp.has(a.operatorId)) assignmentsByOp.set(a.operatorId, []);
      assignmentsByOp.get(a.operatorId)!.push(a);
    }

    // Indicizza exceptions per "operatorId|date". ARRAY: dal 2026-07 sono
    // ammesse più eccezioni per giorno (assenze a fascia oraria).
    const exceptionsByOpDate = new Map<string, AvailabilityException[]>();
    for (const ex of allExceptions) {
      const dateStr = ex.exceptionDate instanceof Date
        ? ex.exceptionDate.toISOString().split('T')[0]
        : String(ex.exceptionDate).split('T')[0];
      const key = `${ex.operatorId}|${dateStr}`;
      if (!exceptionsByOpDate.has(key)) exceptionsByOpDate.set(key, []);
      exceptionsByOpDate.get(key)!.push(ex);
    }

    // Genera le date del range.
    const dates: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return operatorIds.map(opId => {
      const operator = operatorMap.get(opId);
      const maxCapacity = operator?.maxConcurrentAppointments || 1;
      const assignments = assignmentsByOp.get(opId) || [];
      const days: DayAvailabilityV3[] = [];

      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0];
        const dayExceptions = exceptionsByOpDate.get(`${opId}|${dateStr}`) || [];

        const rawBands = this.computeDayRawBands(assignments, dayExceptions, date);
        if (rawBands.length === 0) continue;

        // Sottrai gli appuntamenti dalle fasce → free-block reali.
        const appts = apptsByOpDate.get(`${opId}|${dateStr}`) || [];
        const freeBlocks: TimeBlockV3[] = [];
        for (const band of rawBands) {
          for (const fb of this.subtractAppointments(band, appts, maxCapacity)) {
            freeBlocks.push({
              startTime: this.minutesToHHmm(fb.start),
              endTime: this.minutesToHHmm(fb.end),
            });
          }
        }

        freeBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
        days.push({ date: dateStr, freeBlocks });
      }

      return { operatorId: opId, days };
    });
  }

  /**
   * Fasce "lorde" di un giorno per un operatore: template correnti con le
   * eccezioni applicate (assenze giornata intera e a fascia, orario
   * modificato, disponibilità straordinarie) — SENZA sottrarre gli
   * appuntamenti. La semantica sta in day-exception-semantics.util.ts.
   */
  private computeDayRawBands(
    assignments: TemplateAssignment[],
    dayExceptions: AvailabilityException[],
    date: Date,
  ): { start: number; end: number }[] {
    const templateBands: DayBand[] = [];
    for (const assignment of assignments) {
      if (date >= assignment.validFrom && (!assignment.validUntil || date <= assignment.validUntil)) {
        const pg = assignment.patternGroup;
        if (!pg?.patterns) continue;
        const patternDay = this.getPatternDay(date, assignment.patternStartDate, pg.patternDuration);
        for (const pattern of pg.patterns) {
          if (pattern.dayInPattern === patternDay) {
            templateBands.push({
              start: this.hhmmToMinutes(pattern.startTime),
              end: this.hhmmToMinutes(pattern.endTime),
            });
          }
        }
      }
    }

    return applyDayExceptions(templateBands, classifyDayExceptions(dayExceptions));
  }

  /**
   * Fasce di disponibilità lorde per più operatori su un range di date,
   * in batch (una manciata di query, non per-giorno). Chiave della mappa:
   * `${operatorId}|YYYY-MM-DD`; i giorni senza fasce non compaiono.
   *
   * A differenza di getOperatorsAvailabilityV3 NON sottrae gli appuntamenti:
   * serve alla revalidazione dei conflitti TEMPLATE_CHANGE, dove il predicato
   * è "l'appuntamento ricade ancora nella disponibilità corrente?" — lo slot
   * occupato dall'appuntamento stesso non deve contare come indisponibile.
   */
  async getOperatorsRawBands(
    operatorIds: string[],
    startDate: string,
    endDate: string,
  ): Promise<Map<string, { start: number; end: number }[]>> {
    const bands = new Map<string, { start: number; end: number }[]>();
    if (operatorIds.length === 0) return bands;

    const start = new Date(startDate);
    const end = new Date(endDate);

    const allAssignments = await this.assignmentRepo.find({
      where: { operatorId: In(operatorIds), isCurrent: true },
      relations: ['patternGroup', 'patternGroup.patterns'],
    });
    const allExceptions = await this.exceptionRepo.find({
      where: { operatorId: In(operatorIds), exceptionDate: Between(start, end) },
    });

    const assignmentsByOp = new Map<string, TemplateAssignment[]>();
    for (const a of allAssignments) {
      if (!assignmentsByOp.has(a.operatorId)) assignmentsByOp.set(a.operatorId, []);
      assignmentsByOp.get(a.operatorId)!.push(a);
    }

    const exceptionsByOpDate = new Map<string, AvailabilityException[]>();
    for (const ex of allExceptions) {
      const dateStr = ex.exceptionDate instanceof Date
        ? ex.exceptionDate.toISOString().split('T')[0]
        : String(ex.exceptionDate).split('T')[0];
      const key = `${ex.operatorId}|${dateStr}`;
      if (!exceptionsByOpDate.has(key)) exceptionsByOpDate.set(key, []);
      exceptionsByOpDate.get(key)!.push(ex);
    }

    const cursor = new Date(start);
    while (cursor <= end) {
      const date = new Date(cursor);
      const dateStr = date.toISOString().split('T')[0];
      for (const opId of operatorIds) {
        const dayBands = this.computeDayRawBands(
          assignmentsByOp.get(opId) || [],
          exceptionsByOpDate.get(`${opId}|${dateStr}`) || [],
          date,
        );
        if (dayBands.length > 0) {
          bands.set(`${opId}|${dateStr}`, dayBands);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return bands;
  }

  /**
   * Sottrae gli intervalli occupati da una fascia, restituendo i tratti
   * liberi. Un minuto e' "occupato" quando il numero di appuntamenti che
   * lo coprono (pesati per participantCount) raggiunge maxCapacity.
   *
   * Implementato con uno sweep sui confini degli appuntamenti: tra due
   * confini consecutivi la copertura e' costante, quindi basta confrontarla
   * con maxCapacity per decidere se quel tratto e' libero.
   */
  private subtractAppointments(
    band: { start: number; end: number },
    appts: { start: number; end: number; weight: number }[],
    maxCapacity: number,
  ): { start: number; end: number }[] {
    // Confini rilevanti dentro la fascia.
    const boundaries = new Set<number>([band.start, band.end]);
    for (const a of appts) {
      if (a.end > band.start && a.start < band.end) {
        boundaries.add(Math.max(a.start, band.start));
        boundaries.add(Math.min(a.end, band.end));
      }
    }
    const points = Array.from(boundaries).sort((x, y) => x - y);

    const free: { start: number; end: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const segStart = points[i];
      const segEnd = points[i + 1];
      if (segEnd <= segStart) continue;
      const mid = (segStart + segEnd) / 2;

      // Copertura al centro del segmento.
      let coverage = 0;
      for (const a of appts) {
        if (a.start <= mid && mid < a.end) coverage += a.weight;
      }

      if (coverage < maxCapacity) {
        // Segmento libero: estendi il blocco precedente se contiguo.
        const last = free[free.length - 1];
        if (last && last.end === segStart) {
          last.end = segEnd;
        } else {
          free.push({ start: segStart, end: segEnd });
        }
      }
    }
    return free;
  }

  private hhmmToMinutes(time: string): number {
    const parts = time.split(':').map(Number);
    return parts[0] * 60 + (parts[1] || 0);
  }

  private minutesToHHmm(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

    // Create new template. Le date restano stringhe YYYY-MM-DD (i campi
    // GraphQL sono String e save() restituisce al client il valore passato
    // qui — un Date vivo verrebbe serializzato come epoch millis; il cast è
    // necessario perché la property è tipata Date ma a runtime, come dopo
    // l'idratazione TypeORM, è una stringa).
    const template = this.templateRepo.create({
      ...input,
      patternStartDate: toDateString(input.patternStartDate) as unknown as Date,
      validFrom: toDateString(input.validFrom) as unknown as Date,
      validUntil: input.validUntil ? (toDateString(input.validUntil) as unknown as Date) : undefined,
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

    // Create a pattern group for this single pattern
    const group = this.patternGroupRepo.create({
      name: input.name,
      description: input.description || `Pattern group for ${input.name}`,
      patternDuration: input.patternDuration,
      isActive: true,
    });

    const savedGroup = await this.patternGroupRepo.save(group);

    // Create the pattern entry
    const pattern = this.patternRepo.create({
      name: input.name,
      description: input.description,
      dayInPattern: input.dayInPattern,
      patternDuration: input.patternDuration,
      startTime: input.startTime,
      endTime: input.endTime,
      patternGroupId: savedGroup.id,
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
   * Assign an existing pattern group to an operator with validity dates
   * Creates assignment entry linking pattern group to operator
   */
  async assignTemplateToOperator(input: AssignTemplateToOperatorInput): Promise<TemplateAssignment[]> {
    // Validate operator exists
    const operator = await this.operatorRepo.findOne({ where: { id: input.operatorId } });
    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    // Find pattern group by ID
    const patternGroup = await this.patternGroupRepo.findOne({
      where: { id: input.patternGroupId },
      relations: ['patterns']
    });

    if (!patternGroup) {
      throw new NotFoundException(`Pattern group with ID "${input.patternGroupId}" not found`);
    }

    // Guardie anti-orfano: un gruppo disattivato o senza fasce orarie non deve
    // essere assegnabile — assegnarlo azzererebbe la disponibilità dell'operatore
    // e marcherebbe in conflitto tutti i suoi appuntamenti futuri.
    if (!patternGroup.isActive) {
      throw new BadRequestException(
        `Il template "${patternGroup.name}" è disattivato e non può essere assegnato. Riattivalo dalla gestione template orari.`
      );
    }
    if (!patternGroup.patterns || patternGroup.patterns.length === 0) {
      throw new BadRequestException(
        `Il template "${patternGroup.name}" non ha fasce orarie impostate e non può essere assegnato. Aggiungi le fasce orarie dalla gestione template orari.`
      );
    }

    // Deactivate current assignments for this operator
    await this.assignmentRepo.update(
      { operatorId: input.operatorId, isCurrent: true },
      { isCurrent: false }
    );

    // Create new assignment linking pattern group to operator
    const assignment = this.assignmentRepo.create({
      operatorId: input.operatorId,
      patternGroupId: patternGroup.id,
      patternStartDate: new Date(input.patternStartDate),
      validFrom: new Date(input.validFrom),
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      isCurrent: true,
      version: 1
    });

    const saved = await this.assignmentRepo.save(assignment);

    // Rebuild cache for affected period
    const cacheEndDate = input.validUntil ||
      new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

    await this.rebuildCache(input.operatorId, input.validFrom, cacheEndDate);

    // Reload with relations for GraphQL response
    const savedWithRelations = await this.assignmentRepo.findOne({
      where: { id: saved.id },
      relations: ['operator', 'patternGroup', 'patternGroup.patterns']
    });

    return [savedWithRelations!];
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

    // Rebuild cache. toDateString, NON .toISOString(): il valore idratato da
    // TypeORM per le colonne `date` è una stringa → .toISOString() esplodeva
    // con TypeError.
    await this.rebuildCache(
      template.operatorId,
      toDateString(template.validFrom),
      template.validUntil
        ? toDateString(template.validUntil)
        : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
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
    // toDateString: il campo GraphQL è String e save() restituisce il valore
    // passato qui (un Date vivo serializzerebbe epoch millis).
    const exception = this.exceptionRepo.create({
      ...input,
      exceptionDate: toDateString(input.date) as unknown as Date,
      exceptionType: input.type as any
    });

    const saved = await this.exceptionRepo.save(exception);

    // Rebuild cache for that date
    await this.rebuildCache(input.operatorId, input.date, input.date);

    return saved;
  }

  async rebuildCache(operatorId: string, startDate: string, endDate: string): Promise<void> {
    // Serialize concurrent rebuilds for the same operator via a transaction-scoped
    // advisory lock. This prevents the race where two parallel GraphQL calls to
    // `operatorAvailability` both execute delete+insert and violate
    // UQ (operatorId, availableDate, startTime).
    await this.dataSource.transaction(async (manager) => {
      // Derive a stable 64-bit signed int key from the operator UUID for pg_advisory_xact_lock.
      // hashtext() already returns int4; combining two hashes gives us a bigint-safe lock key.
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext($1)::bigint * 2147483647 + hashtext($1 || ':cache')::bigint)`,
        [operatorId],
      );

      const cacheRepo = manager.getRepository(AvailabilityCache);
      const assignmentRepo = manager.getRepository(TemplateAssignment);
      const exceptionRepo = manager.getRepository(AvailabilityException);
      const operatorRepo = manager.getRepository(Operator);
      const appointmentRepo = manager.getRepository(AvailabilityAppointment);

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Clear existing cache for date range
      await cacheRepo.delete({
        operatorId,
        availableDate: Between(start, end),
      });

      // Get current template assignments for this operator
      const assignments = await assignmentRepo.find({
        where: {
          operatorId,
          isCurrent: true,
        },
        relations: ['patternGroup', 'patternGroup.patterns'],
      });

      // Get exceptions for the period
      const exceptions = await exceptionRepo.find({
        where: {
          operatorId,
          exceptionDate: Between(start, end),
        },
      });

      // Eccezioni per giorno. ARRAY: dal 2026-07 sono ammesse più eccezioni
      // per giorno (assenze a fascia oraria). toDateString, NON .toISOString():
      // le colonne `date` sono idratate come stringhe da TypeORM.
      const exceptionsByDate = new Map<string, AvailabilityException[]>();
      exceptions.forEach((ex) => {
        const dateStr = toDateString(ex.exceptionDate);
        if (!exceptionsByDate.has(dateStr)) exceptionsByDate.set(dateStr, []);
        exceptionsByDate.get(dateStr)!.push(ex);
      });

      // Get operator for capacity info
      const operator = await operatorRepo.findOne({ where: { id: operatorId } });
      if (!operator) return;

      // Collect all rows to insert, de-duplicating on the unique key
      // (operatorId, availableDate, startTime) so overlapping patterns/exceptions
      // don't trigger UQ_941caae8b5de3e258c8b625eb8b within a single rebuild.
      const rowsByKey = new Map<string, Partial<AvailabilityCache>>();
      const addRow = (row: Partial<AvailabilityCache>) => {
        const dateKey = (row.availableDate as Date).toISOString().split('T')[0];
        const key = `${dateKey}|${row.startTime}`;
        rowsByKey.set(key, row);
      };

      // Process each date
      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const dayExceptions = exceptionsByDate.get(dateStr) || [];

        // Fasce lorde da template per il giorno; assenze, orari modificati e
        // disponibilità straordinarie vengono applicati da applyDayExceptions.
        const templateBands: DayBand[] = [];
        for (const assignment of assignments) {
          if (
            current >= assignment.validFrom &&
            (!assignment.validUntil || current <= assignment.validUntil)
          ) {
            const patternGroup = assignment.patternGroup;
            if (!patternGroup || !patternGroup.patterns) continue;

            // Calculate pattern day using assignment's patternStartDate
            const patternDay = this.getPatternDay(
              current,
              assignment.patternStartDate,
              patternGroup.patternDuration,
            );

            // Find patterns matching this day
            for (const pattern of patternGroup.patterns) {
              if (pattern.dayInPattern === patternDay) {
                templateBands.push({
                  start: this.hhmmToMinutes(pattern.startTime),
                  end: this.hhmmToMinutes(pattern.endTime),
                  source: 'pattern',
                  sourceId: pattern.id,
                });
              }
            }
          }
        }

        const bands = applyDayExceptions(
          templateBands,
          classifyDayExceptions(dayExceptions),
        );
        for (const band of bands) {
          addRow({
            operatorId,
            availableDate: new Date(current),
            startTime: this.minutesToHHmm(band.start),
            endTime: this.minutesToHHmm(band.end),
            totalCapacity: operator.maxConcurrentAppointments,
            bookedCapacity: 0,
            source: band.source ?? 'pattern',
            sourceId: band.sourceId,
          });
        }

        current.setDate(current.getDate() + 1);
      }

      // Bulk upsert: idempotent even if a concurrent request inserted the same row
      // before we acquired the advisory lock above.
      const rows = Array.from(rowsByKey.values());
      if (rows.length > 0) {
        await cacheRepo.upsert(rows as AvailabilityCache[], {
          conflictPaths: ['operatorId', 'availableDate', 'startTime'],
          skipUpdateIfNoValuesChanged: true,
        });
      }

      // Update booked capacity (within the same transaction)
      await this.updateBookedCapacityWithManager(
        appointmentRepo,
        cacheRepo,
        operatorId,
        start,
        end,
      );
    });
  }

  private getPatternDay(date: Date, patternStart: Date, patternDuration: number): number {
    // Per pattern settimanali (7 giorni), usa direttamente il giorno della settimana
    // Questo garantisce che Lunedì nel template corrisponda sempre a Lunedì nel calendario
    if (patternDuration === 7) {
      const jsDayOfWeek = date.getDay(); // JavaScript: 0=Dom, 1=Lun, ..., 6=Sab
      // Converti a formato pattern: 0=Lun, 1=Mar, 2=Mer, 3=Gio, 4=Ven, 5=Sab, 6=Dom
      return jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
    }

    // Per pattern multi-settimanali (es: 14 giorni bisettimanali)
    const normalizedPatternStart = new Date(
      patternStart.getFullYear(),
      patternStart.getMonth(),
      patternStart.getDate(),
    );
    const normalizedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    // Calcola quale giorno della settimana è la patternStartDate
    // Questo permette di allineare correttamente: se la data di inizio è mercoledì,
    // quel giorno corrisponde al mercoledì della prima settimana (giorno 2), non al giorno 0
    const startDayOfWeek = patternStart.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
    // Converti a formato pattern: 0=Lun, 1=Mar, ..., 6=Dom
    const startPatternDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const diffTime = normalizedDate.getTime() - normalizedPatternStart.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Aggiungi l'offset del giorno di inizio per allineare al giorno corretto della settimana
    // Esempio: se patternStart è mercoledì (startPatternDay=2) e diffDays=0,
    // il risultato sarà (0+2)%14=2, cioè mercoledì della prima settimana
    const result = (((diffDays + startPatternDay) % patternDuration) + patternDuration) % patternDuration;
    return result;
  }

  private async ensureCacheUpdated(operatorId: string, startDate: string, endDate: string): Promise<void> {
    // Controlla se la cache esiste già per questo range
    const existingCount = await this.cacheRepo.count({
      where: {
        operatorId,
        availableDate: Between(new Date(startDate), new Date(endDate)),
      },
    });

    if (existingCount > 0) {
      // Cache presente: aggiorna solo i bookedCapacity (veloce)
      await this.updateBookedCapacity(operatorId, new Date(startDate), new Date(endDate));
      return;
    }

    // Cache assente: rebuild completo
    await this.rebuildCache(operatorId, startDate, endDate);
  }

  private async updateBookedCapacity(operatorId: string, startDate: Date, endDate: Date): Promise<void> {
    await this.updateBookedCapacityWithManager(
      this.appointmentRepo,
      this.cacheRepo,
      operatorId,
      startDate,
      endDate,
    );
  }

  private async updateBookedCapacityWithManager(
    appointmentRepo: Repository<AvailabilityAppointment>,
    cacheRepo: Repository<AvailabilityCache>,
    operatorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Query all appointments for this operator in the date range
    const appointments = await appointmentRepo.find({
      where: {
        operatorId,
        appointmentDate: Between(startDate, endDate),
        status: Not(In(['cancelled', 'no_show']))
      }
    });

    // Group appointments by date for efficient processing.
    // toDateString, NON .toISOString(): appointmentDate è colonna `date`
    // idratata come stringa da TypeORM.
    const appointmentsByDate = new Map<string, typeof appointments>();
    appointments.forEach(appointment => {
      const dateKey = toDateString(appointment.appointmentDate);
      if (!appointmentsByDate.has(dateKey)) {
        appointmentsByDate.set(dateKey, []);
      }
      appointmentsByDate.get(dateKey)!.push(appointment);
    });

    // Update cache for each date
    for (const [dateStr, dateAppointments] of appointmentsByDate) {
      // Get all cache slots for this date
      const cacheSlots = await cacheRepo.find({
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
        await cacheRepo.update(slot.id, {
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
    // toDateString: il campo GraphQL è String e save() restituisce il valore
    // passato qui (un Date vivo serializzerebbe epoch millis).
    const groupException = this.groupExceptionRepo.create({
      name: input.name,
      exceptionDate: toDateString(input.exceptionDate) as unknown as Date,
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

    // Rebuild cache for all affected operators. toDateString, NON
    // .toISOString(): il valore idratato da TypeORM per le colonne `date` è
    // una stringa → .toISOString() esplodeva con TypeError.
    const dateStr = toDateString(groupException.exceptionDate);
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