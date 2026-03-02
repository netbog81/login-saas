import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Operator } from './operator.entity';
import { Patient } from '../../../entities/patient.entity';
import { PatientModel } from '../../../patients/models/patient.model';
import { PathDocument } from './path-document.entity';
import { Treatment } from './treatment.entity';
import { TherapeuticPathStatus } from './therapeutic-path-enums';

// Re-export enums for convenience
export { TherapeuticPathStatus } from './therapeutic-path-enums';

@ObjectType('TherapeuticPath')
@Entity('therapeutic_paths')
@Index('IDX_therapeutic_paths_patient', ['patientId'])
@Index('IDX_therapeutic_paths_operator', ['primaryOperatorId'])
@Index('IDX_therapeutic_paths_status', ['status'])
export class TherapeuticPath {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  patientId: string;

  @Field(() => ID)
  @Column('uuid')
  primaryOperatorId: string;

  // ==================== BASIC INFO ====================

  @Field()
  @Column({ length: 255 })
  name: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  diagnosis?: string;

  @Field({ nullable: true })
  @Column({ length: 20, nullable: true })
  icdCode?: string;

  // ==================== STATUS ====================

  @Field(() => TherapeuticPathStatus)
  @Column({
    type: 'enum',
    enum: TherapeuticPathStatus,
    default: TherapeuticPathStatus.ACTIVE
  })
  status: TherapeuticPathStatus;

  // ==================== EXTERNAL DOCTOR (simplified) ====================

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  externalDoctorName?: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  externalPrescriptionRef?: string;

  // ==================== NOTES ====================

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  notes?: string;

  // ==================== AUDIT ====================

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  @Field({ nullable: true })
  @Column('timestamp', { nullable: true })
  closedAt?: Date;

  // ==================== RELATIONS ====================

  @Field(() => PatientModel)
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Field(() => Operator)
  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primaryOperatorId' })
  primaryOperator: Operator;

  @Field(() => [PathDocument], { nullable: true })
  @OneToMany(() => PathDocument, document => document.therapeuticPath)
  documents?: PathDocument[];

  @Field(() => [Treatment], { nullable: true })
  @OneToMany(() => Treatment, treatment => treatment.therapeuticPath)
  treatments?: Treatment[];
}
