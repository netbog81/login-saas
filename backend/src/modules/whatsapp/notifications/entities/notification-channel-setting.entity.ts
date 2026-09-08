import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

/**
 * Come lo studio raggiunge i pazienti: un record per canale.
 *
 * Una riga per canale e non un pugno di colonne su `whatsapp_tenant_config`
 * perché le domande sono le stesse per tutti e tre — è acceso? quali messaggi
 * può portare? in che ordine si prova? — e ripeterle moltiplicate per canale
 * avrebbe prodotto trenta colonne che dicono tre cose.
 *
 * Qui NON ci sono credenziali: host SMTP, password e chiavi dei provider SMS
 * stanno in OpenBao, letti dal gateway. Questa tabella tiene solo le
 * preferenze, che il tenant modifica dalla propria pagina impostazioni.
 */

export enum NotificationChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  SMS = 'sms',
}

/**
 * Categorie di messaggio, non i singoli tipi tecnici.
 *
 * Chi configura ragiona per "la conferma" e "il promemoria", non per
 * `recap_single` contro `recap_multi`: un messaggio singolo e il suo
 * equivalente raggruppato sono la stessa comunicazione, e poterli separare
 * sarebbe una scelta senza significato.
 */
export enum NotificationCategory {
  /** Conferma di prenotazione (singola o raggruppata). */
  CONFIRMATION = 'confirmation',
  /** Promemoria prima dell'appuntamento. */
  REMINDER = 'reminder',
  /** Appuntamento spostato. */
  RESCHEDULE = 'reschedule',
  /** Appuntamento disdetto. */
  CANCELLATION = 'cancellation',
}

registerEnumType(NotificationChannel, { name: 'NotificationChannel' });
registerEnumType(NotificationCategory, { name: 'NotificationCategory' });

@ObjectType()
@Entity('notification_channel_settings')
@Unique(['channel'])
export class NotificationChannelSetting {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => NotificationChannel)
  @Column({ length: 20 })
  channel: NotificationChannel;

  @Field()
  @Column({ default: false })
  enabled: boolean;

  /**
   * Categorie che questo canale può portare.
   *
   * Vuoto significa "nessuna": un canale acceso senza categorie non manda
   * niente, ed è uno stato legittimo — si accende il canale, si provano le
   * credenziali, si decide dopo cosa farci passare.
   */
  @Field(() => [NotificationCategory])
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  categories: NotificationCategory[];

  /**
   * Ordine di tentativo: più basso si prova prima.
   *
   * Vale come catena di riserva quando il paziente non ha espresso una
   * preferenza, e come seguito quando ce l'ha: il canale scelto dal paziente
   * va comunque per primo.
   */
  @Field(() => Int)
  @Column({ type: 'int', default: 100 })
  priority: number;

  /** Solo per il canale SMS. Le credenziali del driver stanno in OpenBao. */
  @Field({ nullable: true })
  @Column({ length: 20, nullable: true })
  smsDriver?: string;

  /**
   * Nome visualizzato come mittente delle email.
   *
   * Sta qui e non in OpenBao perché non è un segreto: è il nome dello studio.
   * Il relay condiviso della SaaS spedisce da un solo indirizzo, ma ogni
   * struttura può comparire con il proprio nome senza gestire la posta.
   */
  @Field({ nullable: true })
  @Column({ length: 120, nullable: true })
  emailFromName?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
