import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

/**
 * Link temporaneo per far sottoscrivere l'agenda a un operatore.
 *
 * Non è esposto in GraphQL: è un dettaglio del meccanismo di invio, non un
 * dato che la UI debba leggere. Quello che serve al pannello — se e quando è
 * stato mandato — passa dallo stato del feed.
 */
@Entity('calendar_feed_setup_links')
export class CalendarFeedSetupLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  operatorId: string;

  /** Segreto temporaneo, distinto da quello permanente del feed. */
  @Index({ unique: true })
  @Column({ length: 64 })
  token: string;

  /**
   * A cosa serve questo link: `feed` per sottoscrivere l'agenda,
   * `google_renew` per riautorizzare Google.
   *
   * Distinti perche' aprono pagine diverse e concedono cose diverse: un link
   * nato per sottoscrivere il calendario non deve poter avviare
   * un'autorizzazione, che e' un permesso molto piu' ampio.
   */
  @Column({ length: 20, default: 'feed' })
  purpose: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  /** Valorizzato al primo utilizzo: da lì il link non vale più. */
  @Column({ type: 'timestamp', nullable: true })
  usedAt?: Date;

  /** 'whatsapp' | 'email', per sapere da dove è passato. */
  @Column({ length: 20, nullable: true })
  sentVia?: string;

  /** Numero o indirizzo a cui è stato mandato, per ricostruire cosa è successo. */
  @Column({ length: 255, nullable: true })
  sentTo?: string;

  @CreateDateColumn()
  createdAt: Date;
}
