import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Idempotency tracking degli eventi RabbitMQ ricevuti dal modulo accounting
 * (`ex.accounting.events`, binding `billable.*.*`).
 *
 * Pattern insert-on-conflict-do-nothing: se la riga esiste, l'evento è già
 * stato processato → skip.
 *
 * Naming `processed_clinical_events` per simmetria con `processed_registry_events`
 * esistente (convenzione interna del clinico, non quella generica della spec).
 */
@Entity('processed_clinical_events')
@Index('idx_pce_processed_at', ['processedAt'])
@Index('idx_pce_treatment', ['treatmentId'])
export class ProcessedClinicalEvent {
  @PrimaryColumn({ name: 'eventId', type: 'uuid' })
  eventId: string;

  @Column({ name: 'eventType', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ name: 'tenantAlias', type: 'varchar', length: 50 })
  tenantAlias: string;

  @Column({ name: 'treatmentId', type: 'uuid', nullable: true })
  treatmentId?: string;

  @Column({ name: 'billableEventId', type: 'uuid', nullable: true })
  billableEventId?: string;

  @CreateDateColumn({ name: 'processedAt', type: 'timestamptz' })
  processedAt: Date;

  @Column({ name: 'resultSummary', type: 'jsonb', nullable: true })
  resultSummary?: Record<string, unknown>;
}
