import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { AvailabilityAppointment, BookingStatus, ConflictReason } from '../entities/availability-appointment.entity';
import { AppointmentType } from '../entities/appointment-type.enum';
import { AppointmentLog, AppointmentLogEventType } from '../entities/appointment-log.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { AvailabilityCache } from '../entities/availability-cache.entity';
import { ExceptionType } from '../entities/availability-exception.entity';
import { ClinicalAttendanceService } from '../../../patients/services/clinical-attendance.service';
import { AttendanceEventType } from '../../../patients/entities/clinical-attendance-log.entity';

/**
 * Risultato della verifica conflitti
 */
export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: ConflictedAppointment[];
  totalCount: number;
}

/**
 * Appuntamento in conflitto con info aggiuntive
 */
export interface ConflictedAppointment {
  appointment: AvailabilityAppointment;
  reason: string;
  sourceType: 'template_change' | 'exception';
  sourceId: string;
}

/**
 * Statistiche conflitti per dashboard
 */
export interface ConflictStats {
  totalConflicts: number;
  byReason: Record<string, number>;
  byOperator: { operatorId: string; operatorName: string; count: number }[];
}

@Injectable()
export class AppointmentConflictService {
  constructor(
    @InjectRepository(AvailabilityAppointment)
    private appointmentRepo: Repository<AvailabilityAppointment>,
    @InjectRepository(AppointmentLog)
    private logRepo: Repository<AppointmentLog>,
    @InjectRepository(TemplateAssignment)
    private assignmentRepo: Repository<TemplateAssignment>,
    @InjectRepository(AvailabilityCache)
    private cacheRepo: Repository<AvailabilityCache>,
    private attendanceService: ClinicalAttendanceService,
  ) {}

  // ==================== CONFLICT DETECTION ====================

  /**
   * Verifica conflitti quando si modifica un template (PatternGroup)
   * NON crea log - solo alert operativo
   */
  async checkConflictsOnTemplateChange(
    patternGroupId: string
  ): Promise<ConflictCheckResult> {
    // 1. Trova tutti gli operatori che usano questo pattern group
    const assignments = await this.assignmentRepo.find({
      where: { patternGroupId, isCurrent: true },
      relations: ['operator']
    });

    if (assignments.length === 0) {
      return { hasConflicts: false, conflicts: [], totalCount: 0 };
    }

    const operatorIds = assignments.map(a => a.operatorId);
    const today = new Date();

    // 2. Trova tutti gli appuntamenti futuri per questi operatori
    const appointments = await this.appointmentRepo.find({
      where: {
        operatorId: In(operatorIds),
        appointmentDate: MoreThanOrEqual(today),
        bookingStatus: In([BookingStatus.SCHEDULED, BookingStatus.CONFIRMED])
      },
      relations: ['operator', 'service']
    });

    // 3. Per ora, segnala tutti gli appuntamenti come potenziali conflitti
    // TODO: Implementare verifica dettagliata contro la cache di disponibilità
    const conflicts: ConflictedAppointment[] = appointments.map(apt => ({
      appointment: apt,
      reason: 'Modifica al template di disponibilità',
      sourceType: 'template_change' as const,
      sourceId: patternGroupId
    }));

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      totalCount: conflicts.length
    };
  }

  /**
   * Verifica conflitti quando viene creata un'eccezione operatore
   * CREA log per statistiche
   */
  async checkConflictsOnException(
    operatorId: string,
    exceptionDate: Date,
    exceptionType: ExceptionType,
    exceptionId: string,
    startTime?: string,
    endTime?: string
  ): Promise<ConflictCheckResult> {
    // Query per trovare appuntamenti in conflitto
    const queryBuilder = this.appointmentRepo.createQueryBuilder('apt')
      .leftJoinAndSelect('apt.operator', 'operator')
      .leftJoinAndSelect('apt.service', 'service')
      .where('apt.operatorId = :operatorId', { operatorId })
      .andWhere('apt.appointmentDate = :date', { date: exceptionDate })
      .andWhere('apt.bookingStatus IN (:...statuses)', {
        statuses: [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED]
      });

    // Se l'eccezione ha orari specifici (MODIFIED), verifica solo overlap
    if (startTime && endTime && exceptionType === ExceptionType.MODIFIED) {
      queryBuilder.andWhere(
        '(apt.startTime < :endTime AND apt.endTime > :startTime)',
        { startTime, endTime }
      );
    }

    const appointments = await queryBuilder.getMany();

    const conflictReason = this.getConflictReasonFromExceptionType(exceptionType);
    const conflicts: ConflictedAppointment[] = appointments.map(apt => ({
      appointment: apt,
      reason: this.getExceptionReasonText(exceptionType),
      sourceType: 'exception' as const,
      sourceId: exceptionId
    }));

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      totalCount: conflicts.length
    };
  }

  /**
   * Verifica conflitti per uno slot scoperto di una GymException.
   *
   * A differenza di `checkConflictsOnException` (che lavora su
   * AvailabilityException generica), questo metodo filtra per:
   *   - operatorId dell'assente
   *   - gymRoomId dello slot originale
   *   - appointmentType = GYM
   *   - sovrapposizione con la fascia [startTime, endTime]
   *
   * Usato da GymExceptionService.create/update quando uno slot operator-wide
   * o scoped non ha un sostituto assegnato.
   */
  async checkConflictsOnGymException(params: {
    operatorId: string;
    gymRoomId: string;
    exceptionDate: Date;
    startTime: string;
    endTime: string;
    exceptionId: string;
    reasonText: string;
  }): Promise<ConflictCheckResult> {
    const { operatorId, gymRoomId, exceptionDate, startTime, endTime, exceptionId, reasonText } = params;

    const appointments = await this.appointmentRepo
      .createQueryBuilder('apt')
      .leftJoinAndSelect('apt.operator', 'operator')
      .leftJoinAndSelect('apt.service', 'service')
      .where('apt.operatorId = :operatorId', { operatorId })
      .andWhere('apt.gymRoomId = :gymRoomId', { gymRoomId })
      .andWhere('apt.appointmentDate = :date', { date: exceptionDate })
      .andWhere('apt.appointmentType = :type', { type: AppointmentType.GYM })
      .andWhere('apt.bookingStatus IN (:...statuses)', {
        statuses: [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED],
      })
      .andWhere('(apt.startTime < :endTime AND apt.endTime > :startTime)', {
        startTime,
        endTime,
      })
      .getMany();

    const conflicts: ConflictedAppointment[] = appointments.map((apt) => ({
      appointment: apt,
      reason: reasonText,
      sourceType: 'exception' as const,
      sourceId: exceptionId,
    }));

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      totalCount: conflicts.length,
    };
  }

  /**
   * Azzera il flag hasConflict sugli appuntamenti collegati a una specifica
   * GymException tramite AppointmentLog. Best-effort: se non trova log,
   * ritorna senza fare nulla e lascia il ricalcolo al chiamante.
   */
  async clearConflictsByGymExceptionId(exceptionId: string): Promise<void> {
    // Cerchiamo i log dei conflitti creati per questa eccezione.
    // Gli AppointmentLog non hanno una FK diretta all'eccezione, quindi
    // usiamo sourceId nel metadata del reason — al momento non è persistito
    // in modo affidabile. Strategia alternativa pragmatica: il chiamante
    // (GymExceptionService.update) farà ricalcolo completo per [operatorId, date].
    //
    // Lascio questa come no-op esplicita per rendere il contratto chiaro.
    // Future: aggiungere colonna sourceExceptionId in availability_appointments
    // oppure aggiungere metadata JSONB in AppointmentLog.
    void exceptionId;
  }

  /**
   * Strategia fallback: azzera hasConflict per tutti gli appointment di
   * (operatorId, date) che hanno conflictReason relativo a un'assenza
   * operatore. Usato da GymExceptionService.update come pre-step prima di
   * ricalcolare i conflitti. Non tocca appuntamenti con altri conflictReason
   * (es. TEMPLATE_CHANGE).
   */
  async clearOperatorAbsenceConflicts(
    operatorId: string,
    date: Date,
  ): Promise<void> {
    await this.appointmentRepo
      .createQueryBuilder()
      .update(AvailabilityAppointment)
      .set({
        hasConflict: false,
        conflictReason: undefined,
        conflictDetectedAt: undefined,
      })
      .where('operatorId = :operatorId', { operatorId })
      .andWhere('appointmentDate = :date', { date })
      .andWhere('hasConflict = :hasConflict', { hasConflict: true })
      .andWhere('conflictReason IN (:...reasons)', {
        reasons: [
          ConflictReason.OPERATOR_SICK,
          ConflictReason.OPERATOR_VACATION,
          ConflictReason.OPERATOR_UNAVAILABLE,
        ],
      })
      .execute();
  }

  // ==================== CONFLICT MARKING ====================

  /**
   * Marca appuntamenti come in conflitto per cambio template
   * NON crea log (è solo un alert operativo)
   */
  async markTemplateConflicts(appointmentIds: string[]): Promise<void> {
    if (appointmentIds.length === 0) return;

    await this.appointmentRepo.update(appointmentIds, {
      hasConflict: true,
      conflictReason: ConflictReason.TEMPLATE_CHANGE,
      conflictDetectedAt: new Date()
    });
  }

  /**
   * Marca appuntamenti come in conflitto per eccezione operatore
   * CREA log per statistiche
   */
  async markExceptionConflicts(
    conflicts: ConflictedAppointment[],
    exceptionType: ExceptionType,
    performedBy?: string
  ): Promise<void> {
    const conflictReason = this.getConflictReasonFromExceptionType(exceptionType);
    const year = new Date().getFullYear();

    for (const conflict of conflicts) {
      // 1. Aggiorna l'appuntamento
      await this.appointmentRepo.update(conflict.appointment.id, {
        hasConflict: true,
        conflictReason,
        conflictDetectedAt: new Date()
      });

      // 2. Crea log per statistiche
      await this.logRepo.save({
        appointmentId: conflict.appointment.id,
        patientId: conflict.appointment.patientId,
        operatorId: conflict.appointment.operatorId!,
        eventType: AppointmentLogEventType.OPERATOR_ABSENT,
        reason: conflict.reason,
        performedBy,
        originalDate: conflict.appointment.appointmentDate,
        originalStartTime: conflict.appointment.startTime,
        year
      });
    }
  }

  // ==================== CONFLICT RESOLUTION ====================

  /**
   * Query appuntamenti in conflitto per dashboard segreteria
   */
  async getConflictedAppointments(filters?: {
    operatorId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    conflictReason?: ConflictReason;
  }): Promise<AvailabilityAppointment[]> {
    const query = this.appointmentRepo.createQueryBuilder('apt')
      .leftJoinAndSelect('apt.operator', 'operator')
      .leftJoinAndSelect('apt.service', 'service')
      .where('apt.hasConflict = :hasConflict', { hasConflict: true });

    if (filters?.operatorId) {
      query.andWhere('apt.operatorId = :operatorId', { operatorId: filters.operatorId });
    }
    if (filters?.dateFrom) {
      query.andWhere('apt.appointmentDate >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      query.andWhere('apt.appointmentDate <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters?.conflictReason) {
      query.andWhere('apt.conflictReason = :reason', { reason: filters.conflictReason });
    }

    return query
      .orderBy('apt.appointmentDate', 'ASC')
      .addOrderBy('apt.startTime', 'ASC')
      .getMany();
  }

  /**
   * Risolvi un conflitto singolo (usato dalla segreteria)
   */
  async resolveConflict(
    appointmentId: string,
    action: 'keep' | 'reschedule' | 'cancel',
    resolvedBy: string,
    newData?: { date?: string; startTime?: string; endTime?: string },
    notes?: string
  ): Promise<AvailabilityAppointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['operator', 'service']
    });

    if (!appointment) {
      throw new NotFoundException('Appuntamento non trovato');
    }

    const year = new Date().getFullYear();

    switch (action) {
      case 'keep':
        // Rimuovi flag conflitto, mantieni appuntamento come era
        await this.appointmentRepo.update(appointmentId, {
          hasConflict: false,
          conflictReason: undefined,
          conflictDetectedAt: undefined
        });
        break;

      case 'reschedule':
        if (!newData?.date || !newData?.startTime || !newData?.endTime) {
          throw new Error('Dati nuova data/ora mancanti per riprogrammazione');
        }

        // Log riprogrammazione
        await this.logRepo.save({
          appointmentId,
          patientId: appointment.patientId,
          operatorId: appointment.operatorId!,
          eventType: AppointmentLogEventType.RESCHEDULED,
          reason: notes || 'Riprogrammato per conflitto disponibilità',
          performedBy: resolvedBy,
          originalDate: appointment.appointmentDate,
          originalStartTime: appointment.startTime,
          newDate: new Date(newData.date),
          newStartTime: newData.startTime,
          year
        });

        // Aggiorna appuntamento
        await this.appointmentRepo.update(appointmentId, {
          appointmentDate: new Date(newData.date),
          startTime: newData.startTime,
          endTime: newData.endTime,
          hasConflict: false,
          conflictReason: undefined,
          conflictDetectedAt: undefined
        });
        break;

      case 'cancel':
        // Log cancellazione
        await this.logRepo.save({
          appointmentId,
          patientId: appointment.patientId,
          operatorId: appointment.operatorId!,
          eventType: AppointmentLogEventType.CANCELLED,
          reason: notes || 'Annullato per conflitto disponibilità',
          performedBy: resolvedBy,
          originalDate: appointment.appointmentDate,
          originalStartTime: appointment.startTime,
          year
        });

        // NON incrementiamo contatore paziente perché è cancellazione per conflitto,
        // non per volontà del paziente

        // Aggiorna stato
        await this.appointmentRepo.update(appointmentId, {
          bookingStatus: BookingStatus.CANCELLED,
          cancellationReason: notes || 'Annullato per conflitto disponibilità operatore',
          hasConflict: false
        });
        break;
    }

    // Ritorna appuntamento aggiornato
    return this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['operator', 'service']
    }) as Promise<AvailabilityAppointment>;
  }

  /**
   * Risolvi multipli conflitti in batch (stesso action per tutti)
   */
  async resolveMultipleConflicts(
    appointmentIds: string[],
    action: 'keep' | 'cancel',
    resolvedBy: string,
    notes?: string
  ): Promise<AvailabilityAppointment[]> {
    const results: AvailabilityAppointment[] = [];

    for (const id of appointmentIds) {
      const result = await this.resolveConflict(id, action, resolvedBy, undefined, notes);
      results.push(result);
    }

    return results;
  }

  // ==================== STATISTICS ====================

  /**
   * Statistiche conflitti per dashboard
   */
  async getConflictStats(): Promise<ConflictStats> {
    // Count totale conflitti attivi
    const totalConflicts = await this.appointmentRepo.count({
      where: { hasConflict: true }
    });

    // Count per motivo
    const byReasonQuery = await this.appointmentRepo
      .createQueryBuilder('apt')
      .select('apt.conflictReason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .where('apt.hasConflict = true')
      .groupBy('apt.conflictReason')
      .getRawMany();

    const byReason: Record<string, number> = {};
    byReasonQuery.forEach(row => {
      byReason[row.reason || 'unknown'] = parseInt(row.count);
    });

    // Count per operatore
    const byOperatorQuery = await this.appointmentRepo
      .createQueryBuilder('apt')
      .leftJoin('apt.operator', 'operator')
      .select('apt.operatorId', 'operatorId')
      .addSelect("CONCAT(operator.name, ' ', operator.surname)", 'operatorName')
      .addSelect('COUNT(*)', 'count')
      .where('apt.hasConflict = true')
      .groupBy('apt.operatorId')
      .addGroupBy('operator.name')
      .addGroupBy('operator.surname')
      .getRawMany();

    const byOperator = byOperatorQuery.map(row => ({
      operatorId: row.operatorId,
      operatorName: row.operatorName || 'N/A',
      count: parseInt(row.count)
    }));

    return { totalConflicts, byReason, byOperator };
  }

  // ==================== PATIENT COUNTERS ====================

  /**
   * Registra una cancellazione paziente nel log audit clinical_attendance_log.
   */
  async incrementPatientCancellation(
    patientId: string,
    year?: number,
    reason?: string,
    appointmentId?: string,
    operatorId?: string,
  ): Promise<void> {
    const occurredAt = year
      ? new Date(year, 0, 1)
      : new Date();
    await this.attendanceService.recordEvent({
      subjectId: patientId,
      eventType: AttendanceEventType.CANCELLATION,
      occurredAt,
      reason,
      appointmentId,
      operatorId,
    });
  }

  /**
   * Registra un no-show paziente nel log audit clinical_attendance_log.
   */
  async incrementPatientNoShow(
    patientId: string,
    year?: number,
    reason?: string,
    appointmentId?: string,
    operatorId?: string,
  ): Promise<void> {
    const occurredAt = year
      ? new Date(year, 0, 1)
      : new Date();
    await this.attendanceService.recordEvent({
      subjectId: patientId,
      eventType: AttendanceEventType.NO_SHOW,
      occurredAt,
      reason,
      appointmentId,
      operatorId,
    });
  }

  // ==================== HELPERS ====================

  private getConflictReasonFromExceptionType(type: ExceptionType): ConflictReason {
    switch (type) {
      case ExceptionType.SICK:
        return ConflictReason.OPERATOR_SICK;
      case ExceptionType.VACATION:
        return ConflictReason.OPERATOR_VACATION;
      default:
        return ConflictReason.OPERATOR_UNAVAILABLE;
    }
  }

  private getExceptionReasonText(type: ExceptionType): string {
    const reasons: Record<string, string> = {
      [ExceptionType.SICK]: 'Malattia operatore',
      [ExceptionType.VACATION]: 'Ferie operatore',
      [ExceptionType.HOLIDAY]: 'Festività',
      [ExceptionType.PERSONAL_LEAVE]: 'Permesso personale',
      [ExceptionType.UNAVAILABLE]: 'Operatore non disponibile',
      [ExceptionType.MODIFIED]: 'Disponibilità modificata'
    };
    return reasons[type] || 'Conflitto disponibilità';
  }
}
