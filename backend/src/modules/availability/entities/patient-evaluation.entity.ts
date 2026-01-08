import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { TherapeuticPath } from './therapeutic-path.entity';
import { Operator } from './operator.entity';

/**
 * PatientEvaluation - Valutazione del paziente (ex Anamnesi)
 *
 * In futuro supporterà template dinamici. Per ora usa un form fisso.
 * fieldValues sarà usato quando implementeremo i template configurabili.
 */
@ObjectType('PatientEvaluation')
@Entity('patient_evaluations')
@Index('IDX_patient_evaluations_path', ['therapeuticPathId'])
@Index('IDX_patient_evaluations_operator', ['operatorId'])
export class PatientEvaluation {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  therapeuticPathId: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  @Field(() => ID, { nullable: true, description: 'Template ID for dynamic forms (future use)' })
  @Column('uuid', { nullable: true })
  templateId?: string;

  // ==================== FIXED FORM FIELDS (MVP) ====================

  @Field({ nullable: true, description: 'Motivo della visita' })
  @Column('text', { nullable: true })
  chiefComplaint?: string;

  @Field({ nullable: true, description: 'Storia della malattia attuale' })
  @Column('text', { nullable: true })
  historyOfPresentIllness?: string;

  @Field({ nullable: true, description: 'Fattori aggravanti' })
  @Column('text', { nullable: true })
  aggravatingFactors?: string;

  @Field({ nullable: true, description: 'Fattori allevianti' })
  @Column('text', { nullable: true })
  relievingFactors?: string;

  @Field({ nullable: true, description: 'Obiettivi del paziente' })
  @Column('text', { nullable: true })
  patientGoals?: string;

  @Field({ nullable: true, description: 'Obiettivi del terapista' })
  @Column('text', { nullable: true })
  therapistGoals?: string;

  @Field({ nullable: true, description: 'Valutazione funzionale' })
  @Column('text', { nullable: true })
  functionalAssessment?: string;

  // ==================== CONCLUSIONS ====================

  @Field({ nullable: true, description: 'Conclusioni della valutazione' })
  @Column('text', { nullable: true })
  conclusions?: string;

  // ==================== DYNAMIC FIELDS (future use) ====================

  @Field(() => GraphQLJSON, { nullable: true, description: 'Dynamic field values from template (JSON)' })
  @Column('jsonb', { nullable: true })
  fieldValues?: Record<string, unknown>;

  // ==================== AUDIT ====================

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn()
  updatedAt: Date;

  // ==================== RELATIONS ====================

  @Field(() => TherapeuticPath)
  @ManyToOne(() => TherapeuticPath, path => path.evaluations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'therapeuticPathId' })
  therapeuticPath: TherapeuticPath;

  @Field(() => Operator)
  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;
}
