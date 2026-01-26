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
import { TestSection } from './anamnesis-enums';

/**
 * AnamnesisTest - Test specifici dell'anamnesi
 *
 * Usato in due sezioni:
 * - Sezione 5: Esame Obiettivo (test diagnostici)
 * - Sezione 8: Monitoraggio (test di valutazione outcome)
 *
 * Permette tracking del risultato e superamento nel tempo (Valutazione Trattamento)
 */
@ObjectType('AnamnesisTest')
@Entity('anamnesis_tests')
@Index('IDX_anamnesis_tests_anamnesis', ['anamnesisId'])
@Index('IDX_anamnesis_tests_sezione', ['sezione'])
export class AnamnesisTest {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  anamnesisId: string;

  // ==================== FIELDS ====================

  @Field(() => TestSection, { description: 'Sezione dell\'anamnesi (esame obiettivo o monitoraggio)' })
  @Column({ type: 'enum', enum: TestSection })
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

  // ==================== RELATIONS ====================

  @ManyToOne(() => PatientAnamnesis, anamnesis => anamnesis.tests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'anamnesisId' })
  anamnesis: PatientAnamnesis;
}
