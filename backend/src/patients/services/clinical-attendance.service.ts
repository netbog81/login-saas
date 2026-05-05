import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AttendanceEventType,
  ClinicalAttendanceLog,
} from '../entities/clinical-attendance-log.entity';
import { AttendanceStatsModel } from '../models/attendance-stats.model';

@Injectable()
export class ClinicalAttendanceService {
  constructor(
    @InjectRepository(ClinicalAttendanceLog)
    private readonly logRepo: Repository<ClinicalAttendanceLog>,
  ) {}

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

    const stats: AttendanceStatsModel = {
      noShowsByYear: {},
      cancellationsByYear: {},
      totalNoShows: 0,
      totalCancellations: 0,
    };

    for (const r of rows) {
      const yearKey = String(r.year);
      if (r.eventType === AttendanceEventType.NO_SHOW) {
        stats.noShowsByYear[yearKey] = r.count;
        stats.totalNoShows += r.count;
      } else if (r.eventType === AttendanceEventType.CANCELLATION) {
        stats.cancellationsByYear[yearKey] = r.count;
        stats.totalCancellations += r.count;
      }
    }
    return stats;
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
      result.set(id, {
        noShowsByYear: {},
        cancellationsByYear: {},
        totalNoShows: 0,
        totalCancellations: 0,
      });
    }
    for (const r of rows) {
      const stats = result.get(r.subjectId)!;
      const yearKey = String(r.year);
      if (r.eventType === AttendanceEventType.NO_SHOW) {
        stats.noShowsByYear[yearKey] = r.count;
        stats.totalNoShows += r.count;
      } else if (r.eventType === AttendanceEventType.CANCELLATION) {
        stats.cancellationsByYear[yearKey] = r.count;
        stats.totalCancellations += r.count;
      }
    }
    return result;
  }
}
