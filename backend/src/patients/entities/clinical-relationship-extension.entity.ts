import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Estensione clinica delle relazioni del registry.
 *
 * Il registry è autoritativo per il TIPO di relazione (PARENT_OF, LEGAL_GUARDIAN_OF, ...).
 * Il clinico aggiunge solo flag operativi (contatto emergenza, ritiro autorizzato,
 * caregiver durante visite) JOIN-ati per registry_relationship_id.
 *
 * Mai duplicare il tipo di relazione: se domani il registry aggiunge un nuovo
 * tipo, il clinico lo vede automaticamente.
 */
@Entity('clinical_relationship_extension')
@Index('idx_cre_org', ['organizationId'])
export class ClinicalRelationshipExtension {
  @PrimaryColumn({ name: 'registry_relationship_id', type: 'uuid' })
  registryRelationshipId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'is_emergency_contact', type: 'boolean', default: false })
  isEmergencyContact: boolean;

  @Column({ name: 'is_authorized_pickup', type: 'boolean', default: false })
  isAuthorizedPickup: boolean;

  @Column({ name: 'is_caregiver_during_visits', type: 'boolean', default: false })
  isCaregiverDuringVisits: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
