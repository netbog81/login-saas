import {
  Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

/**
 * Chi possiede il collegamento a Google Calendar.
 *
 * Non c'è OPERATOR: un operatore È un app_user con `user_type='operator'`,
 * e la tabella `operators` porta il ruolo e le policy di accesso, non
 * l'identità. Un account Google appartiene alla PERSONA, quindi il
 * collegamento sta dove sta la persona.
 *
 * PATIENT è previsto ma non ancora usato: quando l'area riservata pazienti
 * arriverà, quegli utenti entrano qui senza migrazione. È il motivo per cui
 * resta un enum invece di sparire del tutto.
 */
export enum GoogleCalendarOwnerType {
  APP_USER = 'APP_USER',
  /** Non ancora usato: previsto per l'area riservata pazienti. */
  PATIENT = 'PATIENT',
}

registerEnumType(GoogleCalendarOwnerType, {
  name: 'GoogleCalendarOwnerType',
  description: 'Tipo di utente a cui appartiene il collegamento Google Calendar',
});

export enum GoogleCalendarConnectionStatus {
  ACTIVE = 'ACTIVE',
  /** Refresh token non più valido: serve una nuova autorizzazione. */
  EXPIRED = 'EXPIRED',
  /** Revocato da noi o dall'utente lato Google. */
  REVOKED = 'REVOKED',
  /** Errori ripetuti in sincronizzazione: da guardare. */
  ERROR = 'ERROR',
}

registerEnumType(GoogleCalendarConnectionStatus, {
  name: 'GoogleCalendarConnectionStatus',
  description: 'Stato del collegamento a Google Calendar',
});

/**
 * Autorizzazione OAuth di un utente verso Google Calendar.
 *
 * Il refresh token vive qui, ma **cifrato con il Transit di OpenBao** — mai
 * in chiaro nel database. `encKeyName` registra con quale chiave: senza
 * quell'informazione una rotazione della chiave non saprebbe cosa
 * ri-wrappare, e i token diventerebbero illeggibili.
 */
@ObjectType()
@Entity('google_calendar_connections')
@Index('UQ_google_calendar_connections_owner', ['ownerType', 'ownerId'], { unique: true })
export class GoogleCalendarConnection {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => GoogleCalendarOwnerType)
  @Column({ type: 'enum', enum: GoogleCalendarOwnerType })
  ownerType: GoogleCalendarOwnerType;

  @Field(() => ID)
  @Column('uuid')
  ownerId: string;

  /**
   * L'account che ha DAVVERO autorizzato, come lo riporta Google.
   *
   * Distinto dall'indirizzo dichiarato sull'app_user: confrontarli è una
   * protezione concreta contro l'autorizzazione fatta con l'account
   * sbagliato, che manderebbe gli appuntamenti nel calendario di un'altra
   * persona senza che nessuno se ne accorga.
   */
  @Field()
  @Column({ length: 255 })
  googleEmail: string;

  /** Calendario dedicato creato dall'app dentro l'account dell'utente. */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  calendarId?: string;

  /** Nome scelto per quel calendario (es. il nome dello studio). */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  calendarName?: string;

  /** Scope concessi: se in futuro ne servissero altri, si sa chi va riautorizzato. */
  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  scope?: string;

  /**
   * Chiave Transit usata per cifrare il token (`clinico-oauth-<alias>`).
   * NON esposta in GraphQL: è un dettaglio di custodia, non un dato d'uso.
   */
  @Column({ length: 128 })
  encKeyName: string;

  /** Refresh token cifrato (ciphertext Transit). Mai esposto in GraphQL. */
  @Column({ type: 'text' })
  encRefreshToken: string;

  @Field(() => GoogleCalendarConnectionStatus)
  @Column({
    type: 'enum',
    enum: GoogleCalendarConnectionStatus,
    default: GoogleCalendarConnectionStatus.ACTIVE,
  })
  status: GoogleCalendarConnectionStatus;

  @Field()
  @Column({ type: 'timestamp', default: () => 'now()' })
  connectedAt: Date;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt?: Date;

  /**
   * Fin dove siamo SICURI che Google sia allineato.
   *
   * Diverso da `lastSyncAt`, che dice solo quando abbiamo parlato con Google
   * l'ultima volta: qui c'e' la garanzia che ogni appuntamento modificato
   * fino a questo istante sia stato scritto. E' cio' che permette al giro
   * ordinario di guardare solo le modifiche invece di riscrivere tutto.
   *
   * Avanza solo a riversata pulita. Se qualcosa e' fallito torna indietro
   * appena prima del piu' vecchio fallimento, cosi' il giro successivo lo
   * ripesca insieme a quello che nel frattempo e' cambiato — senza tenere
   * nessun elenco di cose da riprovare, che sarebbe una cosa in piu' da
   * mantenere allineata.
   *
   * NON esposto in GraphQL: e' contabilita' interna, non un dato d'uso.
   */
  @Column({ type: 'timestamp', nullable: true })
  syncedThroughAt?: Date;

  /**
   * Ultima riversata integrale della finestra.
   *
   * Il giro incrementale segue le modifiche degli appuntamenti, ma non vede
   * cio' che cambia INTORNO a loro — un servizio rinominato, il recapito di
   * un paziente aggiornato nel registry — ne' cio' che qualcuno cancella a
   * mano dal proprio calendario. La riversata integrale, una al giorno per
   * collegamento, e' quello che rimette a posto anche quelli.
   */
  @Column({ type: 'timestamp', nullable: true })
  lastFullSyncAt?: Date;

  /**
   * Ultimo giorno i cui appuntamenti passati sono gia' stati tolti da Google
   * (formato 'YYYY-MM-DD', come tutte le colonne `date`).
   *
   * Senza, la potatura ripercorreva ogni volta l'intera finestra all'indietro
   * per ricancellare cose gia' cancellate: centinaia di 404 a giro, che
   * bruciavano la quota necessaria a scrivere gli appuntamenti veri.
   */
  @Column({ type: 'date', nullable: true })
  prunedThroughDate?: string;

  @Field({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  lastErrorAt?: Date;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  lastErrorMessage?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
