import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type EventOutboxStatus = 'pending' | 'sent' | 'failed';

/**
 * Outbox degli eventi in uscita verso il broker.
 *
 * Prima di questa tabella l'evento viveva solo in memoria: se il broker era
 * irraggiungibile il publish falliva, si scriveva `[OUTBOX-MISSING]` nei log
 * e l'evento era perso — e un riavvio del backend con il broker giù perdeva
 * anche quelli in attesa di riconnessione. Per una `treatment.closed`
 * significa una prestazione che non arriva mai alla fatturazione.
 *
 * Ora l'evento viene PRIMA scritto qui, POI pubblicato. Se il publish
 * fallisce la riga resta `pending` e ci ripassa il worker, con backoff
 * crescente, finché il broker non torna.
 *
 * LIMITE NOTO: la riga viene scritta subito DOPO il commit della
 * transazione di business (il buffer publish-after-commit funziona così),
 * non dentro. Un crash del processo nei millisecondi fra i due perde
 * l'evento. Chiuderlo del tutto richiede che `ClinicalEventBuffer.add()`
 * riceva l'EntityManager della transazione, cioè toccare ogni chiamante.
 */
@Entity('event_outbox')
@Index(['status', 'nextAttemptAt'])
@Index(['eventId'], { unique: true })
export class EventOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `eventId` dell'envelope: è anche l'AMQP messageId e la chiave di idempotenza del consumer. */
  @Column('uuid')
  eventId: string;

  @Column({ length: 100 })
  eventType: string;

  @Column({ length: 100 })
  tenantAlias: string;

  @Column({ length: 100, nullable: true })
  correlationId?: string;

  @Column('jsonb')
  payload: unknown;

  @Column({ length: 20, default: 'pending' })
  status: EventOutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /**
   * Quando ritentare. Backoff crescente sui fallimenti, così un broker giù
   * per ore non viene martellato ogni minuto.
   */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  @Column({ type: 'text', nullable: true })
  lastError?: string;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
