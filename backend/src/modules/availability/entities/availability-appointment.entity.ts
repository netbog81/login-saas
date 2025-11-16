import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { Service } from './service.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

registerEnumType(AppointmentStatus, {
  name: 'AppointmentStatus',
  description: 'Status of the appointment',
});

@ObjectType('AvailabilityAppointment') // Renamed to avoid conflict
@Entity('availability_appointments') // Different table to avoid conflict
@Index(['operatorId', 'appointmentDate'])
@Index(['appointmentDate', 'startTime'])
@Index(['status'], { where: "status != 'cancelled'" })
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

  @Field()
  @Column({ length: 255 })
  clientName: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  clientEmail?: string;

  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  clientPhone?: string;

  @Field()
  @Column('date')
  appointmentDate: Date;

  @Field()
  @Column('time')
  startTime: string;

  @Field()
  @Column('time')
  endTime: string;

  @Field(() => AppointmentStatus)
  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED
  })
  status: AppointmentStatus;

  // For gym classes with multiple participants
  @Field(() => Int)
  @Column({ default: 1 })
  participantCount: number;

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  maxParticipants?: number;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  notes?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  cancellationReason?: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  createdBy?: string; // Reference to user who created the appointment

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, operator => operator.appointments, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator?: Operator;

  @Field(() => Service, { nullable: true })
  @ManyToOne(() => Service, service => service.appointments, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serviceId' })
  service?: Service;
}