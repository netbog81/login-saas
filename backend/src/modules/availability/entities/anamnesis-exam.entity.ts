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

/**
 * AnamnesisExam - Esami diagnostici allegati all'anamnesi
 *
 * Sezione 6: Esami Diagnostici (RX, RMN, TAC, analisi, etc.)
 */
@ObjectType('AnamnesisExam')
@Entity('anamnesis_exams')
@Index('IDX_anamnesis_exams_anamnesis', ['anamnesisId'])
export class AnamnesisExam {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  anamnesisId: string;

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

  // ==================== RELATIONS ====================

  @ManyToOne(() => PatientAnamnesis, anamnesis => anamnesis.exams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'anamnesisId' })
  anamnesis: PatientAnamnesis;
}
