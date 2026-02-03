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
import { EvaluationTest } from './evaluation-test.entity';
import { Operator } from './operator.entity';

/**
 * TestEvaluationHistory - Storico valutazioni test
 *
 * Traccia ogni valutazione/ripetizione di un test,
 * incluso il numero di trattamenti intercorsi dall'ultima valutazione.
 */
@ObjectType('TestEvaluationHistory')
@Entity('test_evaluation_history')
@Index('IDX_test_evaluation_history_test', ['testId'])
@Index('IDX_test_evaluation_history_created', ['createdAt'])
export class TestEvaluationHistory {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid', { name: 'test_id' })
  testId: string;

  @Field(() => ID)
  @Column('uuid', { name: 'operator_id' })
  operatorId: string;

  // ==================== FIELDS ====================

  @Field(() => Int, { description: 'Livello valutazione (0-5)' })
  @Column('int', { name: 'evaluation_level' })
  evaluationLevel: number;

  @Field({ nullable: true, description: 'Note sulla valutazione' })
  @Column('text', { nullable: true })
  note?: string;

  @Field(() => Int, { description: 'Numero trattamenti dall\'ultima valutazione', defaultValue: 0 })
  @Column('int', { name: 'treatments_since_last', default: 0 })
  treatmentsSinceLast: number;

  // ==================== AUDIT ====================

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ==================== RELATIONS ====================

  @ManyToOne(() => EvaluationTest, test => test.evaluationHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id' })
  test: EvaluationTest;

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator)
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;
}
