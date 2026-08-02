import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Field, ID, ObjectType, Float, registerEnumType } from '@nestjs/graphql';

/**
 * Esito della valutazione dello staff su un'assenza ingiustificata.
 */
export enum NoShowDecision {
  /** Da decidere (default alla prima apertura) */
  PENDING = 'PENDING',
  /** Si addebita la seduta */
  TO_CHARGE = 'TO_CHARGE',
  /** Si soprassiede (prima volta, paziente affidabile, ecc.) */
  WAIVED = 'WAIVED',
  /** Assenza giustificata (certificato, lutto, ecc.): non pesa sui conteggi */
  JUSTIFIED = 'JUSTIFIED',
}

registerEnumType(NoShowDecision, {
  name: 'NoShowDecision',
  description: 'Decisione dello staff su un\'assenza ingiustificata',
});

/**
 * NoShowReview — decisione dello staff su una singola assenza.
 *
 * Una riga per appuntamento (UNIQUE): senza questa tabella la pagina No Show
 * sarebbe solo consultiva e ogni volta si ridecide da zero. È anche il punto
 * di aggancio futuro verso la fatturazione ("seduta non disdetta").
 *
 * Scrittura riservata ai ruoli di fatturazione (BillingWriteGuard): decidere
 * se far pagare una seduta saltata è a tutti gli effetti fatturazione,
 * l'operatore vede ma non decide.
 */
@ObjectType('NoShowReview')
@Entity('no_show_reviews')
@Index('IDX_no_show_reviews_patient', ['patientId'])
@Index('IDX_no_show_reviews_decision', ['decision'])
export class NoShowReview {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid', { unique: true })
  appointmentId: string;

  /** subjectId del registry. Denormalizzato per filtrare senza join. */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  patientId?: string;

  @Field(() => NoShowDecision)
  @Column({
    type: 'enum',
    enum: NoShowDecision,
    enumName: 'no_show_review_decision_enum',
    default: NoShowDecision.PENDING,
  })
  decision: NoShowDecision;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  notes?: string;

  /**
   * Importo addebitato, se deciso. Solo informativo lato clinico: la
   * fatturazione vera resta all'accounting.
   */
  @Field(() => Float, { nullable: true })
  @Column('numeric', { precision: 12, scale: 2, nullable: true })
  chargedAmount?: number;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  decidedBy?: string;

  /** Nome snapshottato di chi ha deciso: sopravvive alla rimozione dell'utente. */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  decidedByName?: string;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  decidedAt?: Date;

  @Field()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
