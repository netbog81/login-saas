import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index
} from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { EvaluationObjective } from './evaluation-objective.entity';
import { Operator } from './operator.entity';

/**
 * ObjectiveProgressHistory - Storico avanzamenti obiettivi
 *
 * Traccia ogni modifica del livello di progresso (0-5) di un obiettivo,
 * incluso il numero di trattamenti intercorsi dall'ultimo aggiornamento.
 */
@ObjectType('ObjectiveProgressHistory')
@Entity('objective_progress_history')
@Index('IDX_objective_progress_history_objective', ['objectiveId'])
@Index('IDX_objective_progress_history_created', ['createdAt'])
export class ObjectiveProgressHistory {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid', { name: 'objective_id' })
  objectiveId: string;

  @Field(() => ID)
  @Column('uuid', { name: 'operator_id' })
  operatorId: string;

  // ==================== FIELDS ====================

  @Field(() => Int, { description: 'Livello precedente (0-5)' })
  @Column('int', { name: 'previous_level' })
  previousLevel: number;

  @Field(() => Int, { description: 'Nuovo livello (0-5)' })
  @Column('int', { name: 'new_level' })
  newLevel: number;

  @Field(() => Int, { description: 'Numero trattamenti dall\'ultimo aggiornamento', defaultValue: 0 })
  @Column('int', { name: 'treatments_since_last', default: 0 })
  treatmentsSinceLast: number;

  @Field({ nullable: true, description: 'Note sull\'aggiornamento' })
  @Column('text', { nullable: true })
  note?: string;

  // ==================== AUDIT ====================

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ==================== RELATIONS ====================

  @ManyToOne(() => EvaluationObjective, objective => objective.progressHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'objective_id' })
  objective: EvaluationObjective;

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator)
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;
}
