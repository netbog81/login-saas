import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { PatientAnamnesis } from './patient-anamnesis.entity';
import { ObjectiveType } from './anamnesis-enums';

/**
 * AnamnesisObjective - Obiettivi terapeutici (breve/medio/lungo termine)
 *
 * Sezione 7 dell'anamnesi: Pianificazione Trattamento
 * Ogni obiettivo può essere marcato come raggiunto nel tempo (Valutazione Trattamento)
 */
@ObjectType('AnamnesisObjective')
@Entity('anamnesis_objectives')
@Index('IDX_anamnesis_objectives_anamnesis', ['anamnesisId'])
@Index('IDX_anamnesis_objectives_tipo', ['tipo'])
export class AnamnesisObjective {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  anamnesisId: string;

  // ==================== FIELDS ====================

  @Field(() => ObjectiveType, { description: 'Tipo di obiettivo (breve, medio, lungo termine)' })
  @Column({ type: 'enum', enum: ObjectiveType })
  tipo: ObjectiveType;

  @Field({ description: 'Descrizione dell\'obiettivo' })
  @Column('varchar', { length: 500 })
  descrizione: string;

  @Field({ description: 'Obiettivo raggiunto', defaultValue: false })
  @Column('boolean', { default: false })
  raggiunto: boolean;

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

  // ==================== RELATIONS ====================

  @ManyToOne(() => PatientAnamnesis, anamnesis => anamnesis.objectives, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'anamnesisId' })
  anamnesis: PatientAnamnesis;
}
