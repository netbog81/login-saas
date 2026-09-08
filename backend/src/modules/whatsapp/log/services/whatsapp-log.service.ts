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
  /** Data e ora che il messaggio comunica. Vedi la colonna sull'entity. */
  announcedFor?: Date;
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

/**
 * La scala della consegna, dal momento in cui il messaggio parte a quello in
 * cui viene letto. Ogni gradino include i precedenti.
 */
const SCALA_CONSEGNA: WhatsappMessageStatus[] = [
  WhatsappMessageStatus.DISPATCHED,
  WhatsappMessageStatus.PENDING,
  WhatsappMessageStatus.SENT,
  WhatsappMessageStatus.DELIVERED,
  WhatsappMessageStatus.READ,
];

/**
 * Da quali stati si può passare a `nuovo`.
 *
 * Serve perché Evolution rimanda gli stessi eventi anche a distanza di ore, e
 * fuori ordine: senza guardia un messaggio già `read` torna a `sent` appena
 * arriva un webhook ritardatario. È successo davvero — nei log del 23/08/2026
 * lo stesso correlationId risulta letto alle 16:35 e "inviato" il giorno dopo
 * alle 05:37 — e rende inservibile qualunque diagnostica costruita su questa
 * colonna: un messaggio consegnato sembra fermo.
 *
 * `null` = nessuna guardia, lo stato si applica sempre.
 */
function statiDiPartenzaAmmessi(nuovo: WhatsappMessageStatus): WhatsappMessageStatus[] | null {
  const gradino = SCALA_CONSEGNA.indexOf(nuovo);

  if (gradino >= 0) {
    // Si sale e basta. FAILED è incluso perché un invio riuscito dopo un
    // errore è una notizia più recente, non un passo indietro.
    return [...SCALA_CONSEGNA.slice(0, gradino), WhatsappMessageStatus.FAILED];
  }

  if (
    nuovo === WhatsappMessageStatus.FAILED ||
    nuovo === WhatsappMessageStatus.CANCELLED
  ) {
    // Un guasto o un annullamento annunciati DOPO che il paziente ha già
    // ricevuto il messaggio raccontano qualcosa che non è successo.
    return SCALA_CONSEGNA.filter(
      (st) => st !== WhatsappMessageStatus.DELIVERED && st !== WhatsappMessageStatus.READ,
    );
  }

  return null;
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

  /**
   * Una sola UPDATE condizionale: avanza lo stato solo se è un passo avanti,
   * e scrive un istante solo se quella colonna è ancora vuota.
   *
   * Condizionale in SQL e non letto-e-riscritto in TypeScript perché per lo
   * stesso messaggio arrivano più webhook ravvicinati: fra la lettura e la
   * scrittura ce ne starebbe comodamente un altro, e vincerebbe l'ultimo a
   * scrivere invece del più avanzato.
   *
   * `COALESCE` sui tre istanti perché il primo webhook è il più vicino al
   * fatto: i successivi raccontano lo stesso evento con l'ora sbagliata.
   */
  private async applyStatus(
    where: { correlationId?: string; evolutionMessageId?: string; id?: string },
    newStatus: WhatsappMessageStatus,
    extras?: UpdateLogExtras,
  ): Promise<number> {
    const qb = this.dataSource
      .createQueryBuilder()
      .update(WhatsappMessageLog);

    const set: Record<string, any> = { status: newStatus };

    if (extras?.sentAt) {
      set.sentAt = () => 'COALESCE("sentAt", :sentAtNew)';
      qb.setParameter('sentAtNew', extras.sentAt);
    }
    if (extras?.deliveredAt) {
      set.deliveredAt = () => 'COALESCE("deliveredAt", :deliveredAtNew)';
      qb.setParameter('deliveredAtNew', extras.deliveredAt);
    }
    if (extras?.readAt) {
      set.readAt = () => 'COALESCE("readAt", :readAtNew)';
      qb.setParameter('readAtNew', extras.readAt);
    }
    if (extras?.evolutionMessageId) set.evolutionMessageId = extras.evolutionMessageId;
    if (extras?.errorMessage) set.errorMessage = extras.errorMessage;
    if (extras?.messageBody) set.messageBody = extras.messageBody;
    if (extras?.messageType) set.messageType = extras.messageType;

    qb.set(set);

    if (where.id) qb.where('id = :id', { id: where.id });
    else if (where.correlationId) {
      qb.where('"correlationId" = :cid', { cid: where.correlationId });
    } else {
      qb.where('"evolutionMessageId" = :emid', { emid: where.evolutionMessageId });
    }

    const ammessi = statiDiPartenzaAmmessi(newStatus);
    // `status::text` e non `status`: la colonna e' un enum Postgres, e il
    // confronto con dei parametri regge solo finche' il driver li manda senza
    // tipo. Se node-pg li dichiarasse `text` — o cambiasse driver — la query
    // morirebbe con "operator does not exist: whatsapp_message_status_enum =
    // text", e a morire sarebbe l'avanzamento di stato di OGNI messaggio.
    if (ammessi) qb.andWhere('status::text IN (:...ammessi)', { ammessi });

    const result = await qb.execute();
    return result.affected ?? 0;
  }

  async updateStatus(
    correlationId: string,
    newStatus: WhatsappMessageStatus,
    extras?: UpdateLogExtras,
  ): Promise<void> {
    this.logger.log(
      `[WA-LOG] updateStatus: correlationId=${correlationId} newStatus=${newStatus} extras=${JSON.stringify(extras)}`,
    );

    const affected = await this.applyStatus({ correlationId }, newStatus, extras);

    this.logger.log(
      `[WA-LOG] updateStatus result: affected=${affected} for correlationId=${correlationId}`,
    );

    if (!affected) {
      // Nessuna riga toccata puo' voler dire due cose diverse: il log non
      // esiste, oppure esiste ed e' gia' piu' avanti di cosi'. La seconda e'
      // normale — Evolution ripete gli eventi — e non e' un problema.
      const esiste = await this.logRepo.findOne({ where: { correlationId } });
      if (esiste) {
        this.logger.debug(
          `[WA-LOG] ${correlationId}: ${newStatus} ignorato, gia' a ${esiste.status}`,
        );
      } else {
        this.logger.warn(`[WA-LOG] No log found for correlationId: ${correlationId}`);
      }
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

    const affected = await this.applyStatus({ id: pendingLog.id }, newStatus, extras);
    if (!affected) {
      this.logger.debug(
        `[WA-LOG] log ${pendingLog.id}: ${newStatus} ignorato, gia' a ${pendingLog.status}`,
      );
      return false;
    }

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

    const affected = await this.applyStatus({ evolutionMessageId }, newStatus, extras);

    this.logger.log(
      `[WA-LOG] updateStatusByEvolutionId result: affected=${affected} for evolutionMessageId=${evolutionMessageId}`,
    );

    if (!affected) {
      const esiste = await this.logRepo.findOne({ where: { evolutionMessageId } });
      if (esiste) {
        this.logger.debug(
          `[WA-LOG] ${evolutionMessageId}: ${newStatus} ignorato, gia' a ${esiste.status}`,
        );
      } else {
        this.logger.warn(`[WA-LOG] No log found for evolutionMessageId: ${evolutionMessageId}`);
      }
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

  /**
   * Annulla TUTTI i log ancora in sospeso di un appuntamento.
   *
   * Serve quando non è partito nulla davvero: se l'appuntamento viene disdetto
   * mentre il recap è ancora nel buffer del gateway, restano appese sia la riga
   * del recap sia quella della cancellazione, e nessuna delle due corrisponde a
   * un messaggio arrivato al paziente.
   */
  async cancelAllByAppointmentId(appointmentId: string): Promise<number> {
    const result = await this.logRepo.update(
      {
        appointmentId,
        status: In([WhatsappMessageStatus.DISPATCHED, WhatsappMessageStatus.PENDING]),
      },
      { status: WhatsappMessageStatus.CANCELLED },
    );

    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(
        `[WA-LOG] Annullati ${affected} log in sospeso per appointmentId=${appointmentId}`,
      );
    }
    return affected;
  }

  /**
   * Annulla il log di UN solo invio, identificato dal suo correlationId.
   *
   * A differenza di `cancelAllByAppointmentId` qui gli altri log dello stesso
   * appuntamento devono restare: è il caso dello spostamento confluito nella
   * conferma ancora in buffer, dove la conferma parte davvero e solo l'avviso
   * di spostamento non esiste più.
   */
  async cancelByCorrelationId(correlationId: string): Promise<boolean> {
    const result = await this.logRepo.update(
      {
        correlationId,
        status: In([WhatsappMessageStatus.DISPATCHED, WhatsappMessageStatus.PENDING]),
      },
      { status: WhatsappMessageStatus.CANCELLED },
    );

    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(`[WA-LOG] Annullato il log ${correlationId}: messaggio mai partito`);
    }
    return affected > 0;
  }

  /**
   * Annulla i log ancora in sospeso di un appuntamento per UN solo tipo.
   *
   * Serve quando più appuntamenti confluiscono in un unico elenco: le righe
   * dei singoli invii non corrispondono a nessun messaggio, ma quelle di altro
   * tipo per lo stesso appuntamento (la conferma, il promemoria) devono
   * restare dove sono.
   */
  async cancelPendingByAppointmentAndType(
    appointmentId: string,
    messageType: WhatsappMessageType,
  ): Promise<number> {
    const result = await this.logRepo.update(
      {
        appointmentId,
        messageType,
        status: In([WhatsappMessageStatus.DISPATCHED, WhatsappMessageStatus.PENDING]),
      },
      { status: WhatsappMessageStatus.CANCELLED },
    );
    return result.affected ?? 0;
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
