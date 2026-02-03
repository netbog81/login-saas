import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne
} from 'typeorm';
import { ObjectType, Field, ID, Float, GraphQLISODateTime } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { TherapeuticPath } from './therapeutic-path.entity';
import { Operator } from './operator.entity';
import { EvaluationObjective } from './evaluation-objective.entity';
import { EvaluationTest } from './evaluation-test.entity';
import { EvaluationExam } from './evaluation-exam.entity';

/**
 * BodyMapMarker - Marker sulla mappa corporea (JSONB)
 */
@ObjectType('BodyMapMarker')
export class BodyMapMarker {
  @Field()
  id: string;

  @Field(() => Float, { description: 'Coordinata X normalizzata (0-1)' })
  x: number;

  @Field(() => Float, { description: 'Coordinata Y normalizzata (0-1)' })
  y: number;

  @Field({ nullable: true, description: 'Nota associata al punto' })
  note?: string;
}

/**
 * PatientEvaluation - Valutazione completa del paziente (8 sezioni)
 * (ex PatientAnamnesis - rinominato per chiarezza)
 *
 * Legata al TherapeuticPath con relazione 1:1
 * I dati anagrafici (nome, cognome, età, sesso) vengono dal Patient collegato al path
 */
@ObjectType('PatientEvaluation')
@Entity('patient_evaluations')
@Index('IDX_patient_evaluations_path', ['therapeuticPathId'], { unique: true })
@Index('IDX_patient_evaluations_operator', ['operatorId'])
export class PatientEvaluation {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid', { unique: true })
  therapeuticPathId: string;

  @Field(() => ID)
  @Column('uuid')
  operatorId: string;

  // ==================== SEZIONE 1: INFORMAZIONI GENERALI ====================
  // (nome, cognome, età, sesso vengono dal Patient tramite TherapeuticPath)

  @Field({ nullable: true, description: 'Professione del paziente' })
  @Column('varchar', { length: 255, nullable: true })
  professione?: string;

  @Field(() => [String], { nullable: true, description: 'Sport praticati dal paziente' })
  @Column('varchar', { array: true, nullable: true })
  sportPraticati?: string[];

  @Field(() => Float, { nullable: true, description: 'Body Mass Index' })
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  bmi?: number;

  // ==================== SEZIONE 2: IMMAGINE CORPOREA ====================

  @Field(() => [BodyMapMarker], { nullable: true, description: 'Marker sulla mappa corporea' })
  @Column('jsonb', { nullable: true, default: [] })
  bodyMapMarkers?: BodyMapMarker[];

  // ==================== SEZIONE 3: ANAMNESI PATOLOGICA REMOTA ====================
  // Nota: questi campi rimangono qui per storico, ma l'editing principale
  // avviene nella nuova PatientAnamnesis (legata al paziente)

  @Field({ nullable: true, description: 'Patologie pregresse' })
  @Column('text', { nullable: true })
  patologiePregresse?: string;

  @Field({ nullable: true, description: 'Interventi chirurgici precedenti' })
  @Column('text', { nullable: true })
  interventiChirurgici?: string;

  @Field({ nullable: true, description: 'Traumi precedenti' })
  @Column('text', { nullable: true })
  traumi?: string;

  @Field(() => [String], { nullable: true, description: 'Farmaci in uso' })
  @Column('varchar', { array: true, nullable: true })
  terapiaFarmacologica?: string[];

  // ==================== SEZIONE 4: ANAMNESI PATOLOGICA PROSSIMA ====================

  @Field({ nullable: true, description: 'Motivo del consulto' })
  @Column('text', { nullable: true })
  motivoConsulto?: string;

  @Field({ nullable: true, description: 'Data/periodo esordio sintomi' })
  @Column('text', { nullable: true })
  esordioSintomi?: string;

  @Field({ nullable: true, description: 'Stato attuale dei sintomi' })
  @Column('text', { nullable: true })
  statoAttualeSintomi?: string;

  @Field(() => [String], { nullable: true, description: 'Fattori che alleviano i sintomi' })
  @Column('varchar', { array: true, nullable: true })
  fattoriAllevianti?: string[];

  @Field(() => [String], { nullable: true, description: 'Fattori che aggravano i sintomi' })
  @Column('varchar', { array: true, nullable: true })
  fattoriAggravanti?: string[];

  @Field({ nullable: true, description: 'Andamento del dolore nel tempo' })
  @Column('text', { nullable: true })
  andamentoDolore?: string;

  // ==================== SEZIONE 5: ESAME OBIETTIVO ====================

  @Field({ nullable: true, description: 'Osservazione clinica' })
  @Column('text', { nullable: true })
  osservazione?: string;

  @Field({ nullable: true, description: 'Palpazione' })
  @Column('text', { nullable: true })
  palpazione?: string;

  @Field({ nullable: true, description: 'Valutazione movimento passivo' })
  @Column('text', { nullable: true })
  movimentoPassivo?: string;

  @Field({ nullable: true, description: 'Valutazione movimento attivo' })
  @Column('text', { nullable: true })
  movimentoAttivo?: string;

  @Field({ nullable: true, description: 'Valutazione forza muscolare' })
  @Column('text', { nullable: true })
  forzaMuscolare?: string;

  @Field({ nullable: true, description: 'Valutazione equilibrio' })
  @Column('text', { nullable: true })
  equilibrio?: string;

  @Field({ nullable: true, description: 'Esame neurologico' })
  @Column('text', { nullable: true })
  esameNeurologico?: string;

  @Field({ nullable: true, description: 'Limitazioni nelle attività quotidiane' })
  @Column('text', { nullable: true })
  limitazioniAttivita?: string;

  @Field({ nullable: true, description: 'Fattori prognostici positivi' })
  @Column('text', { nullable: true })
  fattoriPrognosticiPositivi?: string;

  @Field({ nullable: true, description: 'Fattori prognostici negativi' })
  @Column('text', { nullable: true })
  fattoriPrognosticiNegativi?: string;

  @Field({ nullable: true, description: 'Strategie di coping del paziente' })
  @Column('text', { nullable: true })
  strategieCoping?: string;

  @Field({ nullable: true, description: 'Diagnosi fisioterapica' })
  @Column('text', { nullable: true })
  diagnosiFisioterapica?: string;

  // ==================== SEZIONE 7: PIANIFICAZIONE TRATTAMENTO ====================

  @Field(() => [String], { nullable: true, description: 'Interventi terapeutici proposti' })
  @Column('varchar', { array: true, nullable: true })
  interventiProposti?: string[];

  @Field({ nullable: true, description: 'Frequenza delle sedute proposta' })
  @Column('varchar', { length: 255, nullable: true })
  frequenzaSedute?: string;

  // ==================== SEZIONE 8: MONITORAGGIO ====================

  @Field({ nullable: true, description: 'Outcome atteso/pianificato' })
  @Column('text', { nullable: true })
  outcome?: string;

  @Field(() => [String], { nullable: true, description: 'Criticità identificate' })
  @Column('varchar', { array: true, nullable: true })
  criticita?: string[];

  // ==================== AUDIT ====================

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn()
  updatedAt: Date;

  // ==================== RELATIONS ====================

  @Field(() => TherapeuticPath)
  @OneToOne(() => TherapeuticPath, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'therapeuticPathId' })
  therapeuticPath: TherapeuticPath;

  @Field(() => Operator)
  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operatorId' })
  operator: Operator;

  // Relazioni OneToMany con entity correlate
  @Field(() => [EvaluationObjective], { nullable: true })
  @OneToMany(() => EvaluationObjective, objective => objective.evaluation, { cascade: true })
  objectives?: EvaluationObjective[];

  @Field(() => [EvaluationTest], { nullable: true })
  @OneToMany(() => EvaluationTest, test => test.evaluation, { cascade: true })
  tests?: EvaluationTest[];

  @Field(() => [EvaluationExam], { nullable: true })
  @OneToMany(() => EvaluationExam, exam => exam.evaluation, { cascade: true })
  exams?: EvaluationExam[];
}
