import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { AvailabilityAppointment } from './availability-appointment.entity';
import { Operator } from './operator.entity';
import { Service } from './service.entity';
import { Patient } from '../../../entities/patient.entity';
import { PatientModel } from '../../../patients/models/patient.model';
import { TreatmentInstrument } from './treatment-instrument.entity';
import { TherapeuticPath } from './therapeutic-path.entity';
import { TreatmentStatus, PaymentMethod } from './treatment-enums';

// Re-export enums for backward compatibility
export { TreatmentStatus, PaymentMethod } from './treatment-enums';

// ==================== ENTITY ====================

@ObjectType('Treatment')
@Entity('treatments')
@Index('IDX_treatments_operator', ['operatorId'])
@Index('IDX_treatments_patient', ['patientId'])
@Index('IDX_treatments_status', ['status'])
@Index('IDX_treatments_started_at', ['startedAt'])
@Index('IDX_treatments_therapeutic_path', ['therapeuticPathId'])
export class Treatment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  @Index('IDX_treatments_appointment')
  appointmentId: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  @Field(() => Int, { nullable: true })
  @Column('int', { nullable: true })
  patientId?: number;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  serviceId?: string;

  @Field(() => ID)
  @Column('uuid')
  therapeuticPathId: string;

  // ==================== FLAGS ====================

  @Field()
  @Column({ default: false })
  scontoFE: boolean;

  // ==================== STATUS ====================

  @Field(() => TreatmentStatus)
  @Column({
    type: 'enum',
    enum: TreatmentStatus,
    default: TreatmentStatus.IN_PROGRESS
  })
  status: TreatmentStatus;

  @Field()
  @Column({ default: false })
  isTest: boolean;

  // ==================== TIMESTAMPS ====================

  @Field()
  @Column('timestamp', { default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  completedAt?: Date;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  closedAt?: Date;

  // ==================== NOTES ====================

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  clinicalNotes?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  secretaryNotes?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  operatorNotes?: string;

  // ==================== PAYMENT ====================

  @Field(() => Float)
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Field()
  @Column({ default: false })
  @Index('IDX_treatments_is_paid', { where: '"isPaid" = false' })
  isPaid: boolean;

  @Field(() => PaymentMethod, { nullable: true })
  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: true
  })
  paymentMethod?: PaymentMethod;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  paidAt?: Date;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  collectedBy?: string;

  // ==================== PATIENT INVOICE ====================

  @Field()
  @Column({ default: false })
  @Index('IDX_treatments_invoiced_patient', { where: '"isInvoicedToPatient" = false' })
  isInvoicedToPatient: boolean;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  invoicedToPatientAt?: Date;

  @Field({ nullable: true })
  @Column({ length: 100, nullable: true })
  patientInvoiceNumber?: string;

  // ==================== OPERATOR INVOICE ====================

  @Field()
  @Column({ default: false })
  @Index('IDX_treatments_invoiced_operator', { where: '"isInvoicedByOperator" = false' })
  isInvoicedByOperator: boolean;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  invoicedByOperatorAt?: Date;

  @Field({ nullable: true })
  @Column({ length: 100, nullable: true })
  operatorInvoiceNumber?: string;

  // ==================== AUDIT ====================

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // ==================== RELATIONS ====================

  @Field(() => AvailabilityAppointment)
  @OneToOne(() => AvailabilityAppointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: AvailabilityAppointment;

  @Field(() => Operator)
  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  @Field(() => PatientModel, { nullable: true })
  @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patientId' })
  patient?: Patient;

  @Field(() => Service, { nullable: true })
  @ManyToOne(() => Service, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serviceId' })
  service?: Service;

  @Field(() => [TreatmentInstrument], { nullable: true })
  @OneToMany(() => TreatmentInstrument, instrument => instrument.treatment)
  instruments?: TreatmentInstrument[];

  @Field(() => TherapeuticPath)
  @ManyToOne(() => TherapeuticPath, path => path.treatments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'therapeuticPathId' })
  therapeuticPath: TherapeuticPath;
}
