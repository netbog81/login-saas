import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { AvailabilityAppointment } from './availability-appointment.entity';

/**
 * Tipi di eventi da tracciare per statistiche
 */
export enum AppointmentLogEventType {
  CANCELLED = 'cancelled',          // Disdetto dal paziente
  NO_SHOW = 'no_show',              // Paziente non presentato
  OPERATOR_ABSENT = 'operator_absent', // Operatore assente (malattia/ferie/imprevisto)
  RESCHEDULED = 'rescheduled',      // Appuntamento riprogrammato
  OPERATOR_SUBSTITUTED = 'operator_substituted' // Riassegnato al sostituto per eccezione palestra
}

registerEnumType(AppointmentLogEventType, {
  name: 'AppointmentLogEventType',
  description: 'Type of appointment event for logging',
});

/**
 * AppointmentLog - Log eventi appuntamenti per statistiche
 *
 * Traccia SOLO eventi significativi per statistiche:
 * - Disdette paziente
 * - No-show paziente
 * - Assenze operatore (malattia, ferie, imprevisti)
 * - Riprogrammazioni
 *
 * NON traccia: conflitti per cambio template (sono solo alert operativi)
 */
@ObjectType()
@Entity('appointment_logs')
@Index('IDX_appointment_logs_patient', ['patientId'])
@Index('IDX_appointment_logs_event', ['eventType'])
@Index('IDX_appointment_logs_operator', ['operatorId'])
@Index('IDX_appointment_logs_date', ['originalDate'])
export class AppointmentLog {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * ID dell'appuntamento coinvolto
   */
  @Field(() => ID)
  @Column('uuid')
  appointmentId: string;

  /**
   * ID del paziente (se presente)
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  patientId?: string;

  /**
   * ID dell'operatore coinvolto
   */
  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  /**
   * Tipo di evento
   */
  @Field(() => AppointmentLogEventType)
  @Column({
    type: 'enum',
    enum: AppointmentLogEventType
  })
  eventType: AppointmentLogEventType;

  /**
   * Motivo/descrizione dell'evento
   */
  @Field({ nullable: true })
  @Column('text', { nullable: true })
  reason?: string;

  /**
   * ID dell'utente che ha eseguito l'azione (segreteria)
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  performedBy?: string;

  /**
   * Data originale dell'appuntamento. String, non DateTime: TypeORM idrata
   * le colonne `date` come stringhe e GraphQLISODateTime.serialize le
   * rifiuta (vedi utils/date-string.util.ts).
   */
  @Field(() => String, { description: 'Data originale in formato YYYY-MM-DD' })
  @Column('date')
  originalDate: Date;

  /**
   * Ora di inizio originale dell'appuntamento
   */
  @Field()
  @Column('time')
  originalStartTime: string;

  /**
   * Nuova data (se riprogrammato)
   */
  @Field(() => String, { nullable: true, description: 'Nuova data in formato YYYY-MM-DD' })
  @Column('date', { nullable: true })
  newDate?: Date;

  /**
   * Nuova ora di inizio (se riprogrammato)
   */
  @Field({ nullable: true })
  @Column('time', { nullable: true })
  newStartTime?: string;

  /**
   * Anno solare di riferimento (per query statistiche)
   */
  @Field()
  @Column('integer')
  year: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => AvailabilityAppointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: AvailabilityAppointment;
}
