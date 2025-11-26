import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { InstrumentCategory } from './instrument-category.entity';
import { InstrumentStatus } from './instrument-status.enum';
import { AppointmentInstrument } from './appointment-instrument.entity';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
@Entity('instruments')
export class Instrument {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ type: 'uuid' })
  categoryId: string;

  @Field(() => InstrumentCategory)
  @ManyToOne(() => InstrumentCategory, category => category.instruments)
  @JoinColumn({ name: 'categoryId' })
  category: InstrumentCategory;

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  brand?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  model?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: 'date', nullable: true })
  verificationExpiry?: Date;

  @Field(() => InstrumentStatus)
  @Column({
    type: 'enum',
    enum: InstrumentStatus,
    default: InstrumentStatus.ACTIVE
  })
  status: InstrumentStatus;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  technicalData?: Record<string, any>;

  @Field({ nullable: true })
  @Column({ length: 7, nullable: true })
  color?: string;

  @Field()
  @Column({ default: true })
  isActive: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @Field(() => [AppointmentInstrument], { nullable: true })
  @OneToMany(() => AppointmentInstrument, appointmentInstrument => appointmentInstrument.instrument)
  appointmentInstruments?: AppointmentInstrument[];
}
