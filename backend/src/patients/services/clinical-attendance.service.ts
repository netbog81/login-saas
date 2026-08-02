import { Injectable } from '@nestjs/common';

import {
  AttendanceEventType,
  ClinicalAttendanceLog,
} from '../entities/clinical-attendance-log.entity';
import { AttendanceStatsModel } from '../models/attendance-stats.model';

import { TenantContextService } from '@curandis/tenant-datasource';
@Injectable()
export class ClinicalAttendanceService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get logRepo() { return this.dataSource.getRepository(ClinicalAttendanceLog); }

  async recordEvent(input: {
    subjectId: string;
    eventType: AttendanceEventType;
    occurredAt?: Date;
    reason?: string;
    operatorId?: string;
    appointmentId?: string;
  }): Promise<ClinicalAttendanceLog> {
    const occurredAt = input.occurredAt ?? new Date();
    const entry = this.logRepo.create({
      subjectId: input.subjectId,
      eventType: input.eventType,
      occurredAt,
      year: occurredAt.getFullYear(),
      reason: input.reason,
      operatorId: input.operatorId,
      appointmentId: input.appointmentId,
    });
    return this.logRepo.save(entry);
  }

  /**
   * Registra un evento solo se per quell'appuntamento non ne esiste già uno
   * dello stesso tipo. Serve perché lo stesso appuntamento può passare più
   * volte per la marcatura no-show (segreteria che corregge avanti e
   * indietro) e i contatori non devono gonfiarsi.
   */
  async recordEventOnce(input: {
    subjectId: string;
    eventType: AttendanceEventType;
    occurredAt?: Date;
    reason?: string;
    operatorId?: string;
    appointmentId: string;
  }): Promise<ClinicalAttendanceLog | null> {
    const existing = await this.logRepo.findOne({
      where: {
        appointmentId: input.appointmentId,
        eventType: input.eventType,
      },
    });
    if (existing) return null;
    return this.recordEvent(input);
  }

  /**
   * Degrada i log NO_SHOW di un appuntamento a LATE_ARRIVAL. Usato quando un
   * "non presentato" viene corretto in "presentato": il paziente NON è stato
   * assente, è arrivato in ritardo.
   *
   * Prima queste righe venivano CANCELLATE (`removeNoShowEvent`) e con esse
   * spariva l'unica traccia del ritardatario. Ora restano, marcate con
   * `revokedAt`: non pesano sui no-show ma il profilo del paziente le vede.
   *
   * Ritorna il numero di righe degradate.
   */
  async demoteNoShowToLateArrival(appointmentId: string): Promise<number> {
    const result = await this.logRepo.update(
      { appointmentId, eventType: AttendanceEventType.NO_SHOW },
      {
        eventType: AttendanceEventType.LATE_ARRIVAL,
        revokedAt: new Date(),
      },
    );
    return result.affected ?? 0;
  }

  /**
   * Aggrega contatori per un singolo subject. Costo O(N) sul subject specifico,
   * accettabile dato che N è tipicamente piccolo (pochi log per paziente).
   */
  async getStats(subjectId: string): Promise<AttendanceStatsModel> {
    const rows = await this.logRepo
      .createQueryBuilder('log')
      .select('log.year', 'year')
      .addSelect('log.event_type', 'eventType')
      .addSelect('COUNT(*)::int', 'count')
      .where('log.subject_id = :subjectId', { subjectId })
      .groupBy('log.year')
      .addGroupBy('log.event_type')
      .getRawMany<{ year: number; eventType: AttendanceEventType; count: number }>();

    const stats = ClinicalAttendanceService.emptyStats();
    for (const r of rows) {
      ClinicalAttendanceService.applyRow(stats, r);
    }
    return stats;
  }

  private static emptyStats(): AttendanceStatsModel {
    return {
      noShowsByYear: {},
      cancellationsByYear: {},
      lateArrivalsByYear: {},
      totalNoShows: 0,
      totalCancellations: 0,
      totalLateArrivals: 0,
    };
  }

  private static applyRow(
    stats: AttendanceStatsModel,
    r: { year: number; eventType: AttendanceEventType; count: number },
  ): void {
    const yearKey = String(r.year);
    switch (r.eventType) {
      case AttendanceEventType.NO_SHOW:
        stats.noShowsByYear[yearKey] = r.count;
        stats.totalNoShows += r.count;
        break;
      case AttendanceEventType.CANCELLATION:
        stats.cancellationsByYear[yearKey] = r.count;
        stats.totalCancellations += r.count;
        break;
      case AttendanceEventType.LATE_ARRIVAL:
        stats.lateArrivalsByYear[yearKey] = r.count;
        stats.totalLateArrivals += r.count;
        break;
    }
  }

  /** Versione batch usata in liste — riduce le query a 1 sola per N subject. */
  async getStatsBulk(subjectIds: string[]): Promise<Map<string, AttendanceStatsModel>> {
    const result = new Map<string, AttendanceStatsModel>();
    if (subjectIds.length === 0) return result;

    const rows = await this.logRepo
      .createQueryBuilder('log')
      .select('log.subject_id', 'subjectId')
      .addSelect('log.year', 'year')
      .addSelect('log.event_type', 'eventType')
      .addSelect('COUNT(*)::int', 'count')
      .where('log.subject_id IN (:...subjectIds)', { subjectIds })
      .groupBy('log.subject_id')
      .addGroupBy('log.year')
      .addGroupBy('log.event_type')
      .getRawMany<{
        subjectId: string;
        year: number;
        eventType: AttendanceEventType;
        count: number;
      }>();

    for (const id of subjectIds) {
      result.set(id, ClinicalAttendanceService.emptyStats());
    }
    for (const r of rows) {
      ClinicalAttendanceService.applyRow(result.get(r.subjectId)!, r);
    }
    return result;
  }
}
