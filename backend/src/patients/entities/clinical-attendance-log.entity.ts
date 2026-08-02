import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AttendanceEventType {
  NO_SHOW = 'NO_SHOW',
  CANCELLATION = 'CANCELLATION',
  /**
   * "Ritardatario conclamato": il paziente era stato segnato NO_SHOW e poi
   * si è presentato. Prima della gestione assenze la riga NO_SHOW veniva
   * CANCELLATA (traccia persa); ora viene degradata a LATE_ARRIVAL, così
   * non pesa sui no-show ma resta storicizzata.
   */
  LATE_ARRIVAL = 'LATE_ARRIVAL',
}

/**
 * Log audit per no-show, cancellazioni e ritardi.
 * Sostituisce i contatori JSONB cancellationsByYear/noShowsByYear della
 * vecchia entity Patient con un log relazionale propriamente queryabile.
 */
@Entity('clinical_attendance_log')
@Index('idx_attendance_subject_year', ['subjectId', 'year'])
@Index('idx_attendance_subject_type', ['subjectId', 'eventType'])
export class ClinicalAttendanceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: AttendanceEventType,
  })
  eventType: AttendanceEventType;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'operator_id', type: 'uuid', nullable: true })
  operatorId?: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId?: string;

  /**
   * Quando l'evento è stato revocato/degradato (es. NO_SHOW → LATE_ARRIVAL
   * perché il paziente è poi arrivato). Valorizzato insieme al cambio di
   * `eventType`: serve a distinguere un LATE_ARRIVAL nato da una revoca da
   * un ritardo registrato direttamente.
   */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
