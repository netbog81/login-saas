import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Idempotency tracking dei messaggi RabbitMQ del registry.
 * Insert-on-conflict: se la riga esiste, l'evento è già stato processato → skip.
 */
@Entity('processed_registry_events')
@Index('idx_pre_processed_at', ['processedAt'])
export class ProcessedRegistryEvent {
  @PrimaryColumn({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType: string;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId?: string;

  @Column({ name: 'tenant_alias', type: 'text', nullable: true })
  tenantAlias?: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;
}
