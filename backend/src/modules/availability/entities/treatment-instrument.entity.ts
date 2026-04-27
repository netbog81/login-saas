import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, DeleteDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { Treatment } from './treatment.entity';
import { Instrument } from './instrument.entity';
import { InstrumentCategory } from './instrument-category.entity';

@ObjectType('TreatmentInstrument')
@Entity('treatment_instruments')
@Index('IDX_treatment_instruments_treatment', ['treatmentId'])
@Index('IDX_treatment_instruments_instrument', ['instrumentId'])
export class TreatmentInstrument {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  treatmentId: string;

  @Field(() => ID)
  @Column('uuid')
  instrumentId: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  instrumentCategoryId?: string;

  /**
   * Flag che indica se lo strumento è stato effettivamente utilizzato.
   * L'operatore può deselezionare strumenti prenotati ma non usati.
   */
  @Field()
  @Column({ default: true })
  wasUsed: boolean;

  @Field(() => Int)
  @Column('int', { default: 0 })
  startOffsetMinutes: number;

  @Field(() => Int)
  @Column('int', { default: 30 })
  endOffsetMinutes: number;

  @Field(() => Int, { nullable: true })
  @Column('int', { nullable: true })
  orderPosition?: number;

  // ==================== SNAPSHOT ====================
  // Popolati al primo passaggio del trattamento a OPERATOR_COMPLETED.
  // Preservano i dati dello strumento/categoria anche se successivamente
  // soft-deletati o modificati. Sovrascritti a ogni nuovo COMPLETED da
  // parte dell'operatore; non modificati dalle transizioni gestite dalla
  // segreteria (CLOSED ↔ OPERATOR_COMPLETED).

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  instrumentNameSnapshot?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  brandSnapshot?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  modelSnapshot?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  categoryNameSnapshot?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  technicalDataSnapshot?: Record<string, any>;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  snapshotTakenAt?: Date;

  // ==================== SOFT DELETE ====================

  @Field({ nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  deletedByUserId?: string;

  // ==================== RELATIONS ====================

  @Field(() => Treatment)
  @ManyToOne(() => Treatment, treatment => treatment.instruments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treatmentId' })
  treatment: Treatment;

  @Field(() => Instrument, { nullable: true })
  @ManyToOne(() => Instrument, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'instrumentId' })
  instrument?: Instrument;

  @Field(() => InstrumentCategory, { nullable: true })
  @ManyToOne(() => InstrumentCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'instrumentCategoryId' })
  instrumentCategory?: InstrumentCategory;

  // ==================== VIRTUAL FIELDS ====================

  @Field({ nullable: true })
  instrumentName?: string;

  @Field({ nullable: true })
  categoryName?: string;
}
