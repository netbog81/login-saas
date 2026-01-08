import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID, Int, GraphQLISODateTime } from '@nestjs/graphql';
import { TherapeuticPath } from './therapeutic-path.entity';
import { DocumentType, DocumentCategory } from './therapeutic-path-enums';

// Re-export enums for convenience
export { DocumentType, DocumentCategory } from './therapeutic-path-enums';

/**
 * PathDocument - Documento allegato a un percorso terapeutico
 *
 * Gestisce upload di file associati al percorso del paziente
 * (prescrizioni, referti, radiografie, consensi, etc.)
 */
@ObjectType('PathDocument')
@Entity('path_documents')
@Index('IDX_path_documents_path', ['therapeuticPathId'])
@Index('IDX_path_documents_category', ['category'])
export class PathDocument {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ==================== RELATIONS ====================

  @Field(() => ID)
  @Column('uuid')
  therapeuticPathId: string;

  // ==================== FILE INFO ====================

  @Field(() => DocumentType)
  @Column({
    type: 'enum',
    enum: DocumentType,
    default: DocumentType.OTHER
  })
  type: DocumentType;

  @Field(() => DocumentCategory)
  @Column({
    type: 'enum',
    enum: DocumentCategory,
    default: DocumentCategory.OTHER
  })
  category: DocumentCategory;

  @Field()
  @Column({ length: 255 })
  fileName: string;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  originalFileName?: string;

  @Field()
  @Column({ length: 100 })
  mimeType: string;

  @Field(() => Int)
  @Column('int')
  fileSize: number;

  @Field()
  @Column('text')
  storagePath: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  thumbnailPath?: string;

  // ==================== EXTERNAL DOCTOR (for prescriptions) ====================

  @Field({ nullable: true, description: 'Name of external doctor (for prescriptions/reports)' })
  @Column({ length: 255, nullable: true })
  externalDoctorName?: string;

  // ==================== METADATA ====================

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  notes?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  description?: string;

  // ==================== UPLOAD INFO ====================

  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  uploadedBy?: string;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  uploadedAt: Date;

  // ==================== RELATIONS ====================

  @Field(() => TherapeuticPath)
  @ManyToOne(() => TherapeuticPath, path => path.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'therapeuticPathId' })
  therapeuticPath: TherapeuticPath;
}
