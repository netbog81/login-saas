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
}

/**
 * Log audit per no-show e cancellazioni.
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
