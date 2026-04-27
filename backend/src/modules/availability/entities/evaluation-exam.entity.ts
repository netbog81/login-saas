import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index
} from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { PatientEvaluation } from './patient-evaluation.entity';

/**
 * EvaluationExam - Esami diagnostici allegati alla valutazione
 * (ex AnamnesisExam - rinominato per chiarezza)
 *
 * Sezione 6: Esami Diagnostici (RX, RMN, TAC, analisi, etc.)
 */
@ObjectType('EvaluationExam')
@Entity('evaluation_exams')
@Index('IDX_evaluation_exams_evaluation', ['evaluationId'])
export class EvaluationExam {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  evaluationId: string;

  // ==================== FIELDS ====================

  @Field({ description: 'Nome dell\'esame diagnostico' })
  @Column('varchar', { length: 255 })
  nomeEsame: string;

  @Field(() => GraphQLISODateTime, { nullable: true, description: 'Data dell\'esame' })
  @Column('timestamp', { nullable: true })
  data?: Date;

  @Field({ nullable: true, description: 'Note/risultati dell\'esame' })
  @Column('text', { nullable: true })
  note?: string;

  @Field(() => Int, { description: 'Ordine di visualizzazione', defaultValue: 0 })
  @Column('int', { default: 0 })
  orderIndex: number;

  // ==================== AUDIT ====================

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  deletedByUserId?: string;

  // ==================== RELATIONS ====================

  @ManyToOne(() => PatientEvaluation, evaluation => evaluation.exams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: PatientEvaluation;
}
