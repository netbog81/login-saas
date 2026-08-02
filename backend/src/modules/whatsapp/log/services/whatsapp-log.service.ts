import { Injectable, Logger } from '@nestjs/common';
import { In, LessThan } from 'typeorm';
import { WhatsappMessageLog } from '../entities/whatsapp-message-log.entity';
import {
  WhatsappLogFilterInput,
  WhatsappMessageLogPage,
} from '../dto/whatsapp-log-filter.input';
import { WhatsappRetentionStats } from '../dto/whatsapp-log-management.dto';
import {
  WhatsappMessageStatus,
  WhatsappMessageType,
} from '../../enums/whatsapp-enums';

import { TenantContextService } from '@curandis/tenant-datasource';
import { tokenizeSearch, gluedColumnSql } from '../utils/search-tokens';
export interface CreateLogData {
  appointmentId?: string;
  appointmentIds?: string[];
  patientId?: string;
  patientName?: string;
  phoneNumber: string;
  messageType: WhatsappMessageType;
  correlationId: string;
  messageBody?: string;
  status?: WhatsappMessageStatus;
}

export interface UpdateLogExtras {
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  evolutionMessageId?: string;
  errorMessage?: string;
  messageBody?: string;
  messageType?: WhatsappMessageType;
}

@Injectable()
export class WhatsappLogService {
  private readonly logger = new Logger(WhatsappLogService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get logRepo() { return this.dataSource.getRepository(WhatsappMessageLog); }

  async createLog(data: CreateLogData): Promise<WhatsappMessageLog> {
    const log = this.logRepo.create({
      ...data,
      status: data.status ?? WhatsappMessageStatus.DISPATCHED,
    });
    return this.logRepo.save(log);
  }

  async updateStatus(
    correlationId: string,
    newStatus: WhatsappMessageStatus,
    extras?: UpdateLogExtras,
  ): Promise<void> {
    this.logger.log(
      `[WA-LOG] updateStatus: correlationId=${correlationId} newStatus=${newStatus} extras=${JSON.stringify(extras)}`,
    );

    const updateData: Partial<WhatsappMessageLog> = { status: newStatus };

    if (extras?.sentAt) updateData.sentAt = extras.sentAt;
    if (extras?.deliveredAt) updateData.deliveredAt = extras.deliveredAt;
    if (extras?.readAt) updateData.readAt = extras.readAt;
    if (extras?.evolutionMessageId) updateData.evolutionMessageId = extras.evolutionMessageId;
    if (extras?.errorMessage) updateData.errorMessage = extras.errorMessage;
    if (extras?.messageBody) updateData.messageBody = extras.messageBody;
    if (extras?.messageType) updateData.messageType = extras.messageType;

    const result = await this.logRepo.update({ correlationId }, updateData);

    this.logger.log(
      `[WA-LOG] updateStatus result: affected=${result.affected} for correlationId=${correlationId}`,
    );

    if (!result.affected) {
      this.logger.warn(`[WA-LOG] No log found for correlationId: ${correlationId}`);
    }
  }

  /**
   * Finds the most recent PENDING log for a phone number and updates its status.
   * Used when the gateway webhook doesn't include a correlationId.
   * Returns true if a log was updated.
   */
  async updatePendingByPhone(
    phoneNumber: string,
    newStatus: WhatsappMessageStatus,
    extras?: UpdateLogExtras,
  ): Promise<boolean> {
    // Find the most recent PENDING log for this phone
    const pendingLog = await this.logRepo.findOne({
      where: { phoneNumber, status: WhatsappMessageStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    if (!pendingLog) {
      this.logger.warn(`[WA-LOG] No PENDING log found for phone=${phoneNumber}`);
      return false;
    }

    this.logger.log(
      `[WA-LOG] updatePendingByPhone: matched log id=${pendingLog.id} correlationId=${pendingLog.correlationId} for phone=${phoneNumber}`,
    );

    const updateData: Partial<WhatsappMessageLog> = { status: newStatus };
    if (extras?.sentAt) updateData.sentAt = extras.sentAt;
    if (extras?.deliveredAt) updateData.deliveredAt = extras.deliveredAt;
    if (extras?.readAt) updateData.readAt = extras.readAt;
    if (extras?.evolutionMessageId) updateData.evolutionMessageId = extras.evolutionMessageId;
    if (extras?.errorMessage) updateData.errorMessage = extras.errorMessage;
    if (extras?.messageBody) updateData.messageBody = extras.messageBody;
    if (extras?.messageType) updateData.messageType = extras.messageType;

    await this.logRepo.update(pendingLog.id, updateData);
    this.logger.log(`[WA-LOG] Updated log ${pendingLog.id} to status=${newStatus}`);
    return true;
  }

  async updateStatusByEvolutionId(
    evolutionMessageId: string,
    newStatus: WhatsappMessageStatus,
    extras?: UpdateLogExtras,
  ): Promise<void> {
    this.logger.log(
      `[WA-LOG] updateStatusByEvolutionId: evolutionMessageId=${evolutionMessageId} newStatus=${newStatus}`,
    );

    const updateData: Partial<WhatsappMessageLog> = { status: newStatus };

    if (extras?.sentAt) updateData.sentAt = extras.sentAt;
    if (extras?.deliveredAt) updateData.deliveredAt = extras.deliveredAt;
    if (extras?.readAt) updateData.readAt = extras.readAt;
    if (extras?.messageType) updateData.messageType = extras.messageType;

    const result = await this.logRepo.update({ evolutionMessageId }, updateData);

    this.logger.log(
      `[WA-LOG] updateStatusByEvolutionId result: affected=${result.affected} for evolutionMessageId=${evolutionMessageId}`,
    );

    if (!result.affected) {
      this.logger.warn(`[WA-LOG] No log found for evolutionMessageId: ${evolutionMessageId}`);
    }
  }

  async findPatientInfoByAppointmentId(
    appointmentId: string,
  ): Promise<{ patientId?: string; patientName?: string; phoneNumber?: string } | null> {
    const log = await this.logRepo.findOne({
      where: { appointmentId },
      order: { createdAt: 'DESC' },
    });
    return log
      ? { patientId: log.patientId, patientName: log.patientName, phoneNumber: log.phoneNumber }
      : null;
  }

  /** Ultimo nome paziente noto per un numero: usato dove non c'è un appuntamento. */
  async findPatientNameByPhone(phoneNumber: string): Promise<string | undefined> {
    const log = await this.logRepo.findOne({
      where: { phoneNumber },
      order: { createdAt: 'DESC' },
    });
    return log?.patientName ?? undefined;
  }

  async cancelByAppointmentId(appointmentId: string): Promise<boolean> {
    const log = await this.logRepo.findOne({
      where: {
        appointmentId,
        status: In([WhatsappMessageStatus.DISPATCHED, WhatsappMessageStatus.PENDING]),
      },
      order: { createdAt: 'DESC' },
    });
    if (!log) return false;

    await this.logRepo.update(log.id, { status: WhatsappMessageStatus.CANCELLED });
    this.logger.log(`[WA-LOG] Cancelled log ${log.id} for appointmentId=${appointmentId}`);
    return true;
  }

  async findByFilters(
    filters: WhatsappLogFilterInput,
  ): Promise<WhatsappMessageLogPage> {
    const qb = this.logRepo.createQueryBuilder('log');

    if (filters.patientName) {
      // `patientName` è "Cognome Nome": cerchiamo ogni parola separatamente
      // (AND) così l'ordine digitato dall'utente è indifferente; in OR la
      // forma incollata per "D'Angelo"/"De Luca" digitati "dangelo"/"deluca".
      const glued = gluedColumnSql('log."patientName"');
      tokenizeSearch(filters.patientName).forEach((token, i) => {
        qb.andWhere(
          `(log."patientName" ILIKE :nameTok${i} OR ${glued} ILIKE :nameTok${i})`,
          { [`nameTok${i}`]: `%${token}%` },
        );
      });
    }

    if (filters.status) {
      qb.andWhere('log.status = :status', { status: filters.status });
    }

    if (filters.messageType) {
      qb.andWhere('log.messageType = :messageType', {
        messageType: filters.messageType,
      });
    }

    if (filters.dateFrom) {
      qb.andWhere('log.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      qb.andWhere('log.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    qb.orderBy('log.createdAt', 'DESC');

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findById(id: string): Promise<WhatsappMessageLog | null> {
    return this.logRepo.findOne({ where: { id } });
  }

  async findByCorrelationId(correlationId: string): Promise<WhatsappMessageLog | null> {
    return this.logRepo.findOne({ where: { correlationId } });
  }

  async findByAppointmentId(appointmentId: string): Promise<WhatsappMessageLog[]> {
    return this.logRepo.find({
      where: { appointmentId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Log Management (retention policy) ──

  private getCutoffDate(retentionDays: number): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    return cutoff;
  }

  async getRetentionStats(retentionDays: number): Promise<WhatsappRetentionStats> {
    const cutoff = this.getCutoffDate(retentionDays);

    const [totalLogs, expiredLogs, anonymizedLogs] = await Promise.all([
      this.logRepo.count(),
      this.logRepo.count({
        where: { createdAt: LessThan(cutoff), isAnonymized: false },
      }),
      this.logRepo.count({ where: { isAnonymized: true } }),
    ]);

    return {
      totalLogs,
      expiredLogs,
      anonymizedLogs,
      retentionDays,
      retentionCutoffDate: cutoff,
    };
  }

  async findExpiredLogs(
    retentionDays: number,
    page: number,
    limit: number,
  ): Promise<WhatsappMessageLogPage> {
    const cutoff = this.getCutoffDate(retentionDays);

    const [items, total] = await this.logRepo.findAndCount({
      where: { createdAt: LessThan(cutoff), isAnonymized: false },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  async anonymizeLogs(logIds: string[]): Promise<number> {
    if (!logIds.length) return 0;

    const result = await this.logRepo
      .createQueryBuilder()
      .update(WhatsappMessageLog)
      .set({
        patientName: () => `'ANON-' || LEFT(id::text, 6)`,
        phoneNumber: '000000000000',
        messageBody: '[ANONIMIZZATO]',
        patientId: () => 'NULL',
        isAnonymized: true,
        anonymizedAt: new Date(),
      } as any)
      .where('id IN (:...ids)', { ids: logIds })
      .andWhere('"isAnonymized" = false')
      .execute();

    this.logger.log(`[WA-LOG] Anonymized ${result.affected} logs`);
    return result.affected || 0;
  }

  async anonymizeExpiredLogs(retentionDays: number): Promise<number> {
    const cutoff = this.getCutoffDate(retentionDays);

    const result = await this.logRepo
      .createQueryBuilder()
      .update(WhatsappMessageLog)
      .set({
        patientName: () => `'ANON-' || LEFT(id::text, 6)`,
        phoneNumber: '000000000000',
        messageBody: '[ANONIMIZZATO]',
        patientId: () => 'NULL',
        isAnonymized: true,
        anonymizedAt: new Date(),
      } as any)
      .where('"createdAt" < :cutoff', { cutoff })
      .andWhere('"isAnonymized" = false')
      .execute();

    this.logger.log(`[WA-LOG] Anonymized ${result.affected} expired logs (retention=${retentionDays}d)`);
    return result.affected || 0;
  }

  async deleteLogs(logIds: string[]): Promise<number> {
    if (!logIds.length) return 0;
    const result = await this.logRepo.delete({ id: In(logIds) });
    this.logger.log(`[WA-LOG] Deleted ${result.affected} logs`);
    return result.affected || 0;
  }

  async deleteExpiredLogs(retentionDays: number): Promise<number> {
    const cutoff = this.getCutoffDate(retentionDays);
    const result = await this.logRepo.delete({ createdAt: LessThan(cutoff) });
    this.logger.log(`[WA-LOG] Deleted ${result.affected} expired logs (retention=${retentionDays}d)`);
    return result.affected || 0;
  }
}
