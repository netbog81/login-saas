import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';
import { Field, ID, ObjectType, GraphQLISODateTime } from '@nestjs/graphql';
import { TherapeuticPath } from '../../availability/entities/therapeutic-path.entity';
import { Treatment } from '../../availability/entities/treatment.entity';
import {
  PatientDocumentCategory,
  PatientDocumentKind,
} from './patient-document-enums';

/**
 * PatientDocument — documento della scheda paziente.
 *
 * Sostituisce path_documents. Tre livelli di associazione:
 *  - Generale:    therapeutic_path_id NULL, treatment_id NULL
 *  - Percorso:    therapeutic_path_id valorizzato
 *  - Trattamento: treatment_id valorizzato + therapeutic_path_id
 *                 DENORMALIZZATO (sempre coerente col percorso del
 *                 trattamento, validato server-side)
 *
 * Il blob vive su S3 (bucket-per-tenant) cifrato con envelope encryption:
 * DEK per documento generata da OpenBao Transit (chiave clinico-docs-<alias>),
 * AES-256-GCM locale in streaming. Qui restano solo i metadati + il wrap
 * della DEK. subject_id è lo subjectId del registry (nessuna FK verso
 * clinical_subject_index, che è una cache lazy).
 */
@ObjectType('PatientDocument')
@Entity('patient_documents')
@Index('IDX_patient_documents_subject', ['subjectId'])
@Index('IDX_patient_documents_path', ['therapeuticPathId'])
@Index('IDX_patient_documents_treatment', ['treatmentId'])
@Index('IDX_patient_documents_category', ['category'])
@Check('CHK_patient_documents_treatment_has_path', '"treatment_id" IS NULL OR "therapeutic_path_id" IS NOT NULL')
export class PatientDocument {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== ASSOCIAZIONI ====================

  /** subjectId del registry (la "scheda paziente") */
  @Field(() => ID)
  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Field(() => ID, { nullable: true })
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string;

  @Field(() => ID, { nullable: true })
  @Column({ name: 'therapeutic_path_id', type: 'uuid', nullable: true })
  therapeuticPathId?: string;

  @Field(() => ID, { nullable: true })
  @Column({ name: 'treatment_id', type: 'uuid', nullable: true })
  treatmentId?: string;

  // ==================== CLASSIFICAZIONE ====================

  @Field(() => PatientDocumentCategory)
  @Column({
    type: 'enum',
    enum: PatientDocumentCategory,
    enumName: 'patient_document_category_enum',
    default: PatientDocumentCategory.OTHER,
  })
  category: PatientDocumentCategory;

  @Field(() => PatientDocumentKind)
  @Column({
    name: 'content_kind',
    type: 'enum',
    enum: PatientDocumentKind,
    enumName: 'patient_document_kind_enum',
    default: PatientDocumentKind.OTHER,
  })
  contentKind: PatientDocumentKind;

  // ==================== FILE INFO ====================

  @Field()
  @Column({ name: 'original_file_name', length: 255 })
  originalFileName: string;

  @Field()
  @Column({ name: 'mime_type', length: 150 })
  mimeType: string;

  /** Bytes del plaintext (bigint: i video superano int4) */
  @Field()
  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: string;

  /** SHA-256 hex del plaintext, per verifica integrità end-to-end */
  @Field()
  @Column({ length: 64 })
  sha256: string;

  // ==================== STORAGE (S3) ====================

  @Column({ length: 63 })
  bucket: string;

  @Column({ name: 'object_key', type: 'text' })
  objectKey: string;

  // ==================== ENVELOPE ENCRYPTION ====================
  // Niente @Field: il materiale crittografico non esce mai via GraphQL.

  @Column({ name: 'enc_algorithm', length: 20, default: 'aes-256-gcm' })
  encAlgorithm: string;

  /** Wrap della DEK ("vault:vN:...") — si decifra solo via Transit */
  @Column({ name: 'enc_wrapped_dek', type: 'text' })
  encWrappedDek: string;

  @Column({ name: 'enc_iv', length: 32 })
  encIv: string;

  @Column({ name: 'enc_auth_tag', length: 32 })
  encAuthTag: string;

  /** Nome chiave Transit (es. clinico-docs-<tenantAlias>) */
  @Column({ name: 'enc_key_name', length: 100 })
  encKeyName: string;

  @Column({ name: 'enc_key_version', type: 'int', default: 1 })
  encKeyVersion: number;

  // ==================== METADATA ====================

  @Field({ nullable: true, description: 'Medico esterno (per prescrizioni/referti)' })
  @Column({ name: 'external_doctor_name', length: 255, nullable: true })
  externalDoctorName?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  notes?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  description?: string;

  // ==================== UPLOAD / LIFECYCLE ====================

  @Field(() => ID, { nullable: true })
  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  // ==================== RELATIONS ====================

  @Field(() => TherapeuticPath, { nullable: true })
  @ManyToOne(() => TherapeuticPath, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'therapeutic_path_id' })
  therapeuticPath?: TherapeuticPath;

  @Field(() => Treatment, { nullable: true })
  @ManyToOne(() => Treatment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'treatment_id' })
  treatment?: Treatment;
}
