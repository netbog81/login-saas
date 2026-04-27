import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index
} from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { PatientEvaluation } from './patient-evaluation.entity';
import { ObjectiveProgressHistory } from './objective-progress-history.entity';
import { ObjectiveType } from './evaluation-enums';

/**
 * EvaluationObjective - Obiettivi terapeutici (breve/medio/lungo termine)
 * (ex AnamnesisObjective - rinominato per chiarezza)
 *
 * Sezione 7 della valutazione: Pianificazione Trattamento
 * Ogni obiettivo può essere marcato come raggiunto nel tempo (Valutazione Trattamento)
 */
@ObjectType('EvaluationObjective')
@Entity('evaluation_objectives')
@Index('IDX_evaluation_objectives_evaluation', ['evaluationId'])
@Index('IDX_evaluation_objectives_tipo', ['tipo'])
export class EvaluationObjective {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  evaluationId: string;

  // ==================== FIELDS ====================

  @Field(() => ObjectiveType, { description: 'Tipo di obiettivo (breve, medio, lungo termine)' })
  @Column({ type: 'enum', enum: ObjectiveType, enumName: 'evaluation_objectives_tipo_enum' })
  tipo: ObjectiveType;

  @Field({ description: 'Descrizione dell\'obiettivo' })
  @Column('varchar', { length: 500 })
  descrizione: string;

  @Field({ description: 'Obiettivo raggiunto', defaultValue: false })
  @Column('boolean', { default: false })
  raggiunto: boolean;

  @Field(() => Int, { description: 'Livello progresso 0-5 (0=non iniziato, 5=completato)', defaultValue: 0 })
  @Column('int', { name: 'progress_level', default: 0 })
  progressLevel: number;

  @Field(() => GraphQLISODateTime, { nullable: true, description: 'Data in cui l\'obiettivo è stato raggiunto' })
  @Column('timestamp', { nullable: true })
  dataRaggiungimento?: Date;

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

  @ManyToOne(() => PatientEvaluation, evaluation => evaluation.objectives, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: PatientEvaluation;

  @Field(() => [ObjectiveProgressHistory], { nullable: true, description: 'Storico avanzamenti' })
  @OneToMany(() => ObjectiveProgressHistory, history => history.objective)
  progressHistory: ObjectiveProgressHistory[];
}
