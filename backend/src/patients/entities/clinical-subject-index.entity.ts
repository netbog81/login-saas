import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Cache locale di lookup per i subject del registry.
 *
 * - Niente PII: solo display_name (per UI senza fetch REST per ogni riga)
 *   e tax_code_hash (HMAC del CF, opzionale, per ricerche interne).
 * - Popolata lazy al primo accesso o invalidata da eventi RabbitMQ
 *   (subject.updated/deactivated → stale=true).
 */
@Entity('clinical_subject_index')
@Index('idx_csi_display_name_lower', ['displayNameLower'])
@Index('idx_csi_org_active', ['organizationId', 'isActive'])
export class ClinicalSubjectIndex {
  @PrimaryColumn({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  displayName?: string;

  @Column({ name: 'display_name_lower', type: 'text', nullable: true })
  displayNameLower?: string;

  @Column({ name: 'tax_code_hash', type: 'text', nullable: true })
  taxCodeHash?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'stale', type: 'boolean', default: false })
  stale: boolean;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
