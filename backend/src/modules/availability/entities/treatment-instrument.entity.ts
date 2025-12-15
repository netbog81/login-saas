import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
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
