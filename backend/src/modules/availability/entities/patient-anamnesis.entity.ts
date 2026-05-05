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
import { ObjectType, Field, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { Operator } from './operator.entity';

/**
 * PatientAnamnesis — Anamnesi e dati sanitari "anagrafici" del paziente.
 *
 * Relazione 1:1 col subject del registry (UUID = subjectId, FK logica
 * verso il registry: niente FK fisica lato clinico).
 *
 * Contiene:
 * - Dati art. 9 GDPR: gruppo sanguigno, allergie, terapia, patologie pregresse
 *   e croniche, medico base, traumi, storia familiare, note.
 *
 * NON contiene:
 * - Dati anagrafici PII (nome, cognome, CF, indirizzo, contatti) → registry.
 * - Tipo paziente / capacità legale → registry come `legalCapacity`.
 */
@ObjectType('PatientAnamnesis')
@Entity('patient_anamnesis')
@Index('IDX_patient_anamnesis_subject', ['subjectId'], { unique: true })
@Index('IDX_patient_anamnesis_operator', ['operatorId'])
export class PatientAnamnesis {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== LINK AL REGISTRY ====================

  @Field(() => ID)
  @Column('uuid', { name: 'subject_id', unique: true })
  subjectId: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { name: 'operator_id', nullable: true })
  operatorId?: string;

  // ==================== ANAMNESI PATOLOGICA REMOTA ====================

  @Field({ nullable: true, description: 'Patologie pregresse (storia patologica remota)' })
  @Column('text', { name: 'patologie_pregresse', nullable: true })
  patologiePregresse?: string;

  @Field({ nullable: true, description: 'Interventi chirurgici subiti' })
  @Column('text', { name: 'interventi_chirurgici', nullable: true })
  interventiChirurgici?: string;

  @Field({ nullable: true, description: 'Traumi significativi' })
  @Column('text', { nullable: true })
  traumi?: string;

  @Field(() => [String], { nullable: true, description: 'Terapia farmacologica in corso' })
  @Column('varchar', { name: 'terapia_farmacologica', array: true, nullable: true, default: '{}' })
  terapiaFarmacologica?: string[];

  @Field({ nullable: true, description: 'Allergie note' })
  @Column('text', { nullable: true })
  allergie?: string;

  @Field({ nullable: true, description: 'Storia familiare / Anamnesi familiare' })
  @Column('text', { name: 'storia_familiare', nullable: true })
  storiaFamiliare?: string;

  // ==================== DATI SANITARI "ANAGRAFICI" (consolidati da Patient) ====================

  @Field({ nullable: true, description: 'Gruppo sanguigno (es. A+, 0-, ...)' })
  @Column('varchar', { name: 'gruppo_sanguigno', length: 5, nullable: true })
  gruppoSanguigno?: string;

  @Field({ nullable: true, description: 'Medico di base / curante' })
  @Column('varchar', { name: 'medico_base', length: 100, nullable: true })
  medicoBase?: string;

  @Field({ nullable: true, description: 'Patologie croniche attuali' })
  @Column('text', { name: 'patologie_croniche', nullable: true })
  patologieCroniche?: string;

  // ==================== NOTE ====================

  @Field({ nullable: true, description: 'Note generali' })
  @Column('text', { nullable: true })
  note?: string;

  // ==================== AUDIT ====================

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ==================== RELATIONS ====================

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operator_id' })
  operator?: Operator;
}
