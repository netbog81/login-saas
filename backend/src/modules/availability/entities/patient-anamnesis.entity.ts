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
import { Patient } from '../../../entities/patient.entity';
import { PatientModel } from '../../../patients/models/patient.model';
import { Operator } from './operator.entity';

/**
 * PatientAnamnesis - Anamnesi del Paziente
 *
 * Contiene le informazioni sull'anamnesi patologica del paziente,
 * indipendente dal percorso terapeutico.
 * Relazione 1:1 con Patient.
 *
 * Campi:
 * - patologiePregresse: storia patologica remota
 * - interventiChirurgici: interventi subiti
 * - traumi: traumi significativi
 * - terapiaFarmacologica: farmaci in uso (array)
 * - allergie: allergie note
 * - storiaFamiliare: anamnesi familiare
 */
@ObjectType('PatientAnamnesis')
@Entity('patient_anamnesis')
@Index('IDX_patient_anamnesis_patient', ['patientId'])
@Index('IDX_patient_anamnesis_operator', ['operatorId'])
export class PatientAnamnesis {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid', { name: 'patient_id', unique: true })
  patientId: string;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { name: 'operator_id', nullable: true })
  operatorId?: string;

  // ==================== ANAMNESI PATOLOGICA REMOTA ====================

  @Field({ nullable: true, description: 'Patologie pregresse' })
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

  // ==================== NUOVI CAMPI ====================

  @Field({ nullable: true, description: 'Allergie note' })
  @Column('text', { nullable: true })
  allergie?: string;

  @Field({ nullable: true, description: 'Storia familiare / Anamnesi familiare' })
  @Column('text', { name: 'storia_familiare', nullable: true })
  storiaFamiliare?: string;

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

  @Field(() => PatientModel)
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operator_id' })
  operator?: Operator;
}
