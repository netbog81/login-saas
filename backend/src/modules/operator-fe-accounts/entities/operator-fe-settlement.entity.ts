import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { OperatorFeSettlementLine } from './operator-fe-settlement-line.entity';

/**
 * CONTI FE — conteggio compensi di UN operatore per UN periodo, calcolato
 * sui trattamenti con sconto FE (che non passano mai dall'accounting) usando
 * la scomposizione FE dei servizi: prezzo praticato (= Totale Sconto FE per
 * le righe non custom) meno Extra studio FE.
 *
 * Speculare a `operator_settlements` dell'accounting, ma senza metodo di
 * pagamento / banca / riferimento fattura operatore (decisione Marco
 * 2026-07-12): del pagamento resta solo la data.
 *
 * I valori sono SNAPSHOT immutabili presi alla generazione: cambi successivi
 * a percentuali, prezzi o scomposizioni FE non li toccano.
 */
@ObjectType('OperatorFeSettlement')
@Entity('operator_fe_settlements')
@Index('IDX_operator_fe_settlements_operator', ['operatorAppUserId', 'periodFrom'])
export class OperatorFeSettlement {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Lotto di generazione: i conteggi creati con la stessa "Genera conteggi"
   * condividono il batchId (vista ad albero nel frontend).
   */
  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  batchId?: string | null;

  /** AppUser.id dell'operatore (= treatment_services.executedByOperatorId). */
  @Field(() => ID)
  @Column({ type: 'uuid' })
  operatorAppUserId: string;

  /** Snapshot del nome operatore alla generazione. */
  @Field()
  @Column({ length: 255 })
  operatorName: string;

  // Colonne `date` esposte come String (vedi utils/date-string.util.ts).
  @Field(() => String)
  @Column({ type: 'date' })
  periodFrom: string;

  @Field(() => String)
  @Column({ type: 'date' })
  periodTo: string;

  /** Scelte di inclusione alla generazione (le incassate entrano sempre). */
  @Field()
  @Column({ default: false })
  includeUnpaid: boolean;

  @Field()
  @Column({ default: false })
  includeOpen: boolean;

  // Conteggi prestazioni (una riga servizio = una prestazione)
  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  countTotal: number;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  countPaid: number;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  countUnpaid: number;

  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  countOpen: number;

  /** Totale prestazioni FE (prezzo praticato). */
  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  grossAmount: number;

  /** Imponibile compenso: Σ max(0, prezzo − extra studio FE). */
  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  baseAmount: number;

  /** Compenso operatore: Σ imponibile × percentuale. */
  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  compensationAmount: number;

  /** Quota studio: totale prestazioni − compenso. */
  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  studioShareAmount: number;

  /** Totale Extra studio FE (già compreso nella quota studio). */
  @Field(() => Float)
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  studioExtraAmount: number;

  // Workflow (i toggle boolean del frontend diventano timestamp)
  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  communicatedAt?: Date | null;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  verifiedAt?: Date | null;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  paidAt?: Date | null;

  /** Data del pagamento (unico dato di pagamento previsto nei Conti FE). */
  @Field(() => String, { nullable: true })
  @Column({ type: 'date', nullable: true })
  paymentDate?: string | null;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Field(() => ID, { nullable: true })
  @Column({ type: 'uuid', nullable: true })
  createdByUserId?: string | null;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 200, nullable: true })
  createdByEmail?: string | null;

  @Field(() => [OperatorFeSettlementLine], { nullable: true })
  @OneToMany(() => OperatorFeSettlementLine, (line) => line.settlement, {
    cascade: ['insert'],
  })
  lines?: OperatorFeSettlementLine[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
