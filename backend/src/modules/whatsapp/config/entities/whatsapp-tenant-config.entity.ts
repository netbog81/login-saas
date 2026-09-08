import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { WhatsappReminderEarlyPolicy } from '../../enums/whatsapp-enums';

@ObjectType('WhatsappTenantConfig')
@Entity('whatsapp_tenant_config')
export class WhatsappTenantConfig {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ length: 500 })
  gatewayUrl: string;

  // Encrypted API key - NOT exposed via GraphQL
  @Column('text')
  apiKeyEncrypted: string;

  // Encrypted webhook secret - NOT exposed via GraphQL
  @Column('text', { nullable: true })
  webhookSecretEncrypted: string;

  @Field()
  @Column({ length: 255 })
  tenantApiId: string;

  @Field()
  @Column({ default: false })
  isActive: boolean;

  @Field()
  @Column({ default: false })
  sendCancelNotification: boolean;

  /**
   * Notifica al paziente lo spostamento di un appuntamento. A differenza della
   * cancellazione è attiva di default: uno spostamento riguarda sempre il
   * paziente. Quando è off il gateway riprogramma comunque il reminder 24h.
   */
  @Field()
  @Column({ default: true })
  sendUpdateNotification: boolean;

  /**
   * Finestra entro cui gli appuntamenti presi per lo stesso numero vengono
   * accorpati in un unico messaggio di recap (30-600s). Il conteggio riparte a
   * ogni nuovo appuntamento; il gateway non lo rinvia oltre 5 volte la finestra
   * (max 15 minuti).
   */
  @Field(() => Int)
  @Column({ type: 'int', default: 60 })
  recapBufferSeconds: number;

  /**
   * Invio del promemoria dentro una fascia oraria del giorno prima invece che
   * alle 24h esatte. Serve a dare al paziente margine reale rispetto alla
   * politica di disdetta entro le 24h, e a non concentrare tutti gli invii
   * sull'orario degli appuntamenti. Off = comportamento storico.
   */
  @Field()
  @Column({ default: false })
  reminderWindowEnabled: boolean;

  /** Inizio della fascia, HH:mm in ora locale (Europe/Rome). */
  @Field()
  @Column({ length: 5, default: '08:30' })
  reminderWindowStart: string;

  /** Fine della fascia, HH:mm. Dentro la fascia gli invii sono distribuiti. */
  @Field()
  @Column({ length: 5, default: '09:00' })
  reminderWindowEnd: string;

  /**
   * Appuntamenti che iniziano prima della fine della fascia: per loro la fascia
   * del giorno prima cadrebbe a meno di 24h dall'appuntamento.
   */
  @Field(() => WhatsappReminderEarlyPolicy)
  @Column({ length: 20, default: WhatsappReminderEarlyPolicy.SHIFT_PREVIOUS_DAY })
  reminderEarlyPolicy: WhatsappReminderEarlyPolicy;

  /**
   * Manda al paziente, insieme al recap della prenotazione, il link per
   * aggiungere i propri appuntamenti al calendario del telefono.
   *
   * Una mail sola per paziente: da lì in poi il calendario si aggiorna da sé a
   * ogni spostamento o disdetta, senza altra posta. Spento di default.
   */
  @Field()
  @Column({ default: false })
  patientCalendarFeedEnabled: boolean;

  @Field(() => Int)
  @Column({ type: 'int', default: 730 })
  retentionDays: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual field populated by resolver (masked API key)
  @Field({ nullable: true })
  maskedApiKey?: string;
}
