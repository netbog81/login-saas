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
import { TestEvaluationHistory } from './test-evaluation-history.entity';
import { TestSection } from './evaluation-enums';

/**
 * EvaluationTest - Test specifici della valutazione
 * (ex AnamnesisTest - rinominato per chiarezza)
 *
 * Usato in due sezioni:
 * - Sezione 5: Esame Obiettivo (test diagnostici)
 * - Sezione 8: Monitoraggio (test di valutazione outcome)
 *
 * Permette tracking del risultato e superamento nel tempo (Valutazione Trattamento)
 */
@ObjectType('EvaluationTest')
@Entity('evaluation_tests')
@Index('IDX_evaluation_tests_evaluation', ['evaluationId'])
@Index('IDX_evaluation_tests_sezione', ['sezione'])
export class EvaluationTest {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  evaluationId: string;

  // ==================== FIELDS ====================

  @Field(() => TestSection, { description: 'Sezione della valutazione (esame obiettivo o monitoraggio)' })
  @Column({ type: 'enum', enum: TestSection, enumName: 'evaluation_tests_sezione_enum' })
  sezione: TestSection;

  @Field({ description: 'Nome del test' })
  @Column('varchar', { length: 255 })
  nome: string;

  @Field({ nullable: true, description: 'Risultato del test' })
  @Column('varchar', { length: 500, nullable: true })
  risultato?: string;

  @Field({ nullable: true, description: 'Test superato (null = non ancora valutato)' })
  @Column('boolean', { nullable: true })
  superato?: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true, description: 'Data di esecuzione del test' })
  @Column('timestamp', { nullable: true })
  dataEsecuzione?: Date;

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

  @ManyToOne(() => PatientEvaluation, evaluation => evaluation.tests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: PatientEvaluation;

  @Field(() => [TestEvaluationHistory], { nullable: true, description: 'Storico valutazioni' })
  @OneToMany(() => TestEvaluationHistory, history => history.test)
  evaluationHistory: TestEvaluationHistory[];
}
