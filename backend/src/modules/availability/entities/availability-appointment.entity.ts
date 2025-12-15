import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, Float, registerEnumType } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { Service } from './service.entity';
import { GymRoom } from './gym-room.entity';
import { AppointmentType } from './appointment-type.enum';
import { AppointmentInstrument } from './appointment-instrument.entity';
import { Patient } from '../../../entities/patient.entity';
import GraphQLJSON from 'graphql-type-json';
import { TreatmentStatus } from './treatment-enums';

// ==================== ENUMS ====================

/**
 * @deprecated Use BookingStatus instead - kept for migration
 */
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

/**
 * BookingStatus - Stato della prenotazione
 */
export enum BookingStatus {
  SCHEDULED = 'scheduled',              // Prenotato
  CONFIRMED = 'confirmed',              // Confermato (dopo invio reminder 24h)
  CANCELLED = 'cancelled',              // Disdetto (legacy, per compatibilità)
  CANCELLED_EARLY = 'cancelled_early',  // Disdetto con >24h preavviso (no penalità)
  CANCELLED_LATE = 'cancelled_late',    // Disdetto con <24h preavviso (tracciato, penalità)
  NO_SHOW = 'no_show',                  // Paziente non presentato (tracciato, penalità)
  ATTENDED = 'attended'                 // Paziente presentato → abilita trattamento
}

/**
 * ConflictReason - Motivo del conflitto con disponibilità
 */
export enum ConflictReason {
  TEMPLATE_CHANGE = 'template_change',        // Cambio template (non loggato)
  OPERATOR_SICK = 'operator_sick',            // Malattia operatore
  OPERATOR_VACATION = 'operator_vacation',    // Ferie operatore
  OPERATOR_UNAVAILABLE = 'operator_unavailable' // Altro motivo assenza
}

// Register enums for GraphQL
registerEnumType(AppointmentStatus, {
  name: 'AppointmentStatus',
  description: 'Status of the appointment (deprecated)',
});

registerEnumType(BookingStatus, {
  name: 'BookingStatus',
  description: 'Booking status of the appointment',
});

// TreatmentStatus is registered in treatment.entity.ts

registerEnumType(ConflictReason, {
  name: 'ConflictReason',
  description: 'Reason for availability conflict',
});

// ==================== ENTITY ====================

@ObjectType('AvailabilityAppointment')
@Entity('availability_appointments')
@Index('IDX_availability_appointments_operator_date', ['operatorId', 'appointmentDate'])
@Index('IDX_availability_appointments_date_time', ['appointmentDate', 'startTime'])
@Index('IDX_availability_appointments_booking_status', ['bookingStatus'])
@Index('IDX_availability_appointments_conflict', ['hasConflict'], { where: '"hasConflict" = true' })
export class AvailabilityAppointment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  operatorId?: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  serviceId?: string;

  // ==================== CLIENT INFO ====================

  @Field()
  @Column({ length: 255 })
  clientName: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  clientEmail?: string;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  clientPhone?: string;

  @Field(() => Int, { nullable: true })
  @Column('integer', { nullable: true })
  patientId?: number;

  // ==================== DATE/TIME ====================

  @Field(() => String, { description: 'Data appuntamento in formato YYYY-MM-DD' })
  @Column('date')
  appointmentDate: Date;

  @Field()
  @Column('time')
  startTime: string;

  @Field()
  @Column('time')
  endTime: string;

  // ==================== STATUS FIELDS ====================

  /**
   * @deprecated Use bookingStatus instead - kept for migration
   */
  @Field(() => AppointmentStatus, { nullable: true, deprecationReason: 'Use bookingStatus instead' })
  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    nullable: true
  })
  status?: AppointmentStatus;

  /**
   * Booking status - stato della prenotazione
   */
  @Field(() => BookingStatus)
  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.SCHEDULED
  })
  bookingStatus: BookingStatus;

  /**
   * Treatment status - stato del trattamento (workflow in clinica)
   * null = paziente non ancora arrivato
   */
  @Field(() => TreatmentStatus, { nullable: true })
  @Column({
    type: 'enum',
    enum: TreatmentStatus,
    nullable: true
  })
  treatmentStatus?: TreatmentStatus;

  // ==================== CONFLICT FIELDS ====================

  /**
   * Flag che indica se l'appuntamento è in conflitto con la disponibilità
   */
  @Field()
  @Column({ default: false })
  hasConflict: boolean;

  /**
   * Motivo del conflitto (se presente)
   */
  @Field(() => ConflictReason, { nullable: true })
  @Column({
    type: 'enum',
    enum: ConflictReason,
    nullable: true
  })
  conflictReason?: ConflictReason;

  /**
   * Quando è stato rilevato il conflitto
   */
  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  conflictDetectedAt?: Date;

  // ==================== SUBSTITUTION FIELDS ====================

  /**
   * Operatore originale da template (se diverso dall'operatore attuale)
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  originalOperatorId?: string;

  /**
   * Flag che indica se c'è stata una sostituzione operatore
   */
  @Field()
  @Column({ default: false })
  isSubstitution: boolean;

  /**
   * Motivo della sostituzione (facoltativo)
   */
  @Field({ nullable: true })
  @Column('text', { nullable: true })
  substitutionReason?: string;

  // ==================== GYM/PARTICIPANT FIELDS ====================

  @Field(() => Int)
  @Column({ default: 1 })
  participantCount: number;

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  maxParticipants?: number;

  @Field(() => AppointmentType)
  @Column({
    type: 'enum',
    enum: AppointmentType,
    default: AppointmentType.STANDARD
  })
  appointmentType: AppointmentType;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  gymRoomId?: string;

  @Field()
  @Column({ default: false })
  instrumentOrderMatters: boolean;

  // ==================== RECURRING FIELDS ====================

  /**
   * Flag che indica se l'appuntamento fa parte di una serie ricorrente
   */
  @Field()
  @Column({ default: false })
  isRecurring: boolean;

  /**
   * UUID che raggruppa appuntamenti della stessa serie ricorrente
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  @Index('IDX_availability_appointments_recurring_group')
  recurringGroupId?: string;

  /**
   * Configurazione della ricorrenza (solo per il primo appuntamento della serie)
   * JSON: { type, interval, selectedDays, endType, occurrences, untilDate }
   */
  @Field(() => GraphQLJSON, { nullable: true })
  @Column('jsonb', { nullable: true })
  repeatConfig?: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
    selectedDays?: number[];
    endType: 'never' | 'after' | 'until';
    occurrences?: number;
    untilDate?: string;
  };

  // ==================== NOTES ====================

  /**
   * Note generali sull'appuntamento
   */
  @Field({ nullable: true })
  @Column('text', { nullable: true })
  notes?: string;

  /**
   * Motivo della cancellazione (se cancellato)
   */
  @Field({ nullable: true })
  @Column('text', { nullable: true })
  cancellationReason?: string;

  /**
   * Quando è stato cancellato l'appuntamento
   */
  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  cancelledAt?: Date;

  /**
   * Chi ha cancellato l'appuntamento (userId)
   */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  cancelledBy?: string;

  /**
   * Ore di preavviso con cui è stato cancellato (calcolato automaticamente)
   * Serve per tracciare se la cancellazione è avvenuta con >24h o <24h di preavviso
   */
  @Field(() => Float, { nullable: true })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cancellationHoursNotice?: number;

  /**
   * Note dell'operatore (indicazioni per segreteria dopo il trattamento)
   */
  @Field({ nullable: true })
  @Column('text', { nullable: true })
  operatorNotes?: string;

  // ==================== TIMESTAMPS ====================

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  createdBy?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Quando il trattamento è iniziato
   */
  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  treatmentStartedAt?: Date;

  /**
   * Quando l'operatore ha completato il trattamento
   */
  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  treatmentCompletedAt?: Date;

  /**
   * Quando la segreteria ha chiuso l'appuntamento (fatturazione completata)
   */
  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  closedAt?: Date;

  // ==================== RELATIONS ====================

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, operator => operator.appointments, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator?: Operator;

  @Field(() => Service, { nullable: true })
  @ManyToOne(() => Service, service => service.appointments, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serviceId' })
  service?: Service;

  @Field(() => GymRoom, { nullable: true })
  @ManyToOne(() => GymRoom, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'gymRoomId' })
  gymRoom?: GymRoom;

  @Field(() => [AppointmentInstrument], { nullable: true })
  @OneToMany(() => AppointmentInstrument, appointmentInstrument => appointmentInstrument.appointment)
  instruments?: AppointmentInstrument[];

  /**
   * Relazione con Patient entity
   */
  @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patientId' })
  patient?: Patient;

  /**
   * Relazione con l'operatore originale (in caso di sostituzione)
   */
  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'originalOperatorId' })
  originalOperator?: Operator;
}
