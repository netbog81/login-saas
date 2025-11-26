import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { AvailabilityAppointment } from './availability-appointment.entity';
import { Instrument } from './instrument.entity';

@ObjectType()
@Entity('appointment_instruments')
@Index('UQ_appointment_instruments_appointment_instrument', ['appointmentId', 'instrumentId'], { unique: true })
@Index('IDX_appointment_instruments_instrument_appointment', ['instrumentId', 'appointmentId'])
export class AppointmentInstrument {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'uuid' })
  appointmentId: string;

  @Field(() => AvailabilityAppointment)
  @ManyToOne(() => AvailabilityAppointment, appointment => appointment.instruments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: AvailabilityAppointment;

  @Field()
  @Column({ type: 'uuid' })
  instrumentId: string;

  @Field(() => Instrument)
  @ManyToOne(() => Instrument, instrument => instrument.appointmentInstruments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instrumentId' })
  instrument: Instrument;

  @Field(() => Int)
  @Column({ type: 'int' })
  startOffsetMinutes: number; // offset from appointment start: 0, 15, 30

  @Field(() => Int)
  @Column({ type: 'int' })
  endOffsetMinutes: number; // always startOffsetMinutes + 30

  @Field(() => Int, { nullable: true })
  @Column({ type: 'int', nullable: true })
  orderPosition?: number; // 1, 2 for instrument order

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
