import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { OperatorFeSettlement } from './operator-fe-settlement.entity';

/** Stato di una prestazione FE al momento della generazione del conteggio. */
export type OperatorFeLineState = 'PAID' | 'UNPAID' | 'OPEN';

/**
 * CONTI FE — una prestazione (riga servizio di un trattamento sconto FE)
 * con il calcolo del compenso snapshottato alla generazione.
 */
@ObjectType('OperatorFeSettlementLine')
@Entity('operator_fe_settlement_lines')
@Index('IDX_operator_fe_settlement_lines_settlement', ['settlementId'])
export class OperatorFeSettlementLine {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  settlementId: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  treatmentId: string;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  treatmentServiceId: string;

  /** Data esecuzione = startedAt del trattamento (come executionDate accounting). */
  @Field(() => String)
  @Column({ type: 'date' })
  executionDate: string;

  @Field()
  @Column({ length: 255 })
  description: string;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  serviceName?: string | null;

  /** Snapshot nome paziente (dal registry) alla generazione. */
  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  patientName?: string | null;

  /** Prezzo praticato FE (= Totale Sconto FE del servizio se non custom). */
  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  /** Extra studio FE considerato per la riga. */
  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  studioExtraAmount: number;

  /** Imponibile compenso: max(0, prezzo − extra studio FE). */
  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  baseAmount: number;

  /** Percentuale operatore applicata (snapshot). */
  @Field(() => Float)
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  percentage: number;

  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  compensationAmount: number;

  @Field(() => Float)
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  studioShareAmount: number;

  /** PAID (incassata) | UNPAID (chiusa da incassare) | OPEN (in corso). */
  @Field()
  @Column({ type: 'varchar', length: 20 })
  state: OperatorFeLineState;

  @Field()
  @Column({ default: false })
  isCustomPrice: boolean;

  @ManyToOne(() => OperatorFeSettlement, (s) => s.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'settlementId' })
  settlement: OperatorFeSettlement;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
