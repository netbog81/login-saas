import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Operator } from './operator.entity';
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

  @Field({ nullable: true })
  @DeleteDateColumn()
  deletedAt?: Date;

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  deletedByUserId?: string;

  // ==================== RELATIONS ====================

  // patientId è il subjectId del registry. Campo GraphQL `patient`
  // esposto via field resolver in TherapeuticPathResolver (SubjectLoader).

  // NULLABLE in GraphQL: se l'operatore referente del percorso è stato
  // soft-deleted (operators.deletedAt), TypeORM lo esclude dal join →
  // primaryOperator = null. Con il campo non-nullable, GraphQL faceva fallire
  // l'INTERA query therapeuticPathsByPatient ("Cannot return null for
  // non-nullable field TherapeuticPath.primaryOperator"), facendo sparire dalla
  // scheda paziente TUTTI i percorsi e i trattamenti sotto di essi. Stesso fix
  // già applicato a Treatment.operator. Il frontend gestisce null via
  // primaryOperatorName (mapper null-safe).
  @Field(() => Operator, { nullable: true })
  @ManyToOne(() => Operator, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primaryOperatorId' })
  primaryOperator: Operator;

  // NOTA: la relazione documents (path_documents) è stata sostituita da
  // patient_documents (query GraphQL patientDocuments con filtro percorso).

  @Field(() => [Treatment], { nullable: true })
  @OneToMany(() => Treatment, treatment => treatment.therapeuticPath)
  treatments?: Treatment[];
}
