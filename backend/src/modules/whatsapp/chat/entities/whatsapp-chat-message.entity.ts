import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import {
  WhatsappChatDirection,
  WhatsappMessageStatus,
} from '../../enums/whatsapp-enums';

/**
 * Un messaggio dentro una conversazione WhatsApp.
 *
 * Tabella separata da `whatsapp_message_logs`: quella traccia il ciclo di vita
 * dei messaggi AUTOMATICI per appuntamento (recap, reminder, disdette), questa
 * il contenuto di una conversazione bidirezionale. Contenuti e retention sono
 * diversi, tenerli insieme avrebbe mescolato due cose con regole diverse.
 *
 * Il corpo e' testo libero scritto da o verso il paziente: e' a tutti gli
 * effetti dato sanitario, quindi il record partecipa alla stessa
 * anonimizzazione dei log WhatsApp (`isAnonymized`).
 */
@ObjectType('WhatsappChatMessage')
@Entity('whatsapp_chat_messages')
@Index('IDX_wa_chat_messages_conversation', ['conversationId', 'createdAt'])
@Index('IDX_wa_chat_messages_evolution', ['evolutionMessageId'])
@Index('IDX_wa_chat_messages_correlation', ['correlationId'])
@Index('IDX_wa_chat_messages_anonymized', ['isAnonymized'])
export class WhatsappChatMessage {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => ID)
  @Column('uuid')
  conversationId: string;

  @Field(() => WhatsappChatDirection)
  @Column({
    type: 'enum',
    enum: WhatsappChatDirection,
    enumName: 'whatsapp_chat_direction_enum',
  })
  direction: WhatsappChatDirection;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  body?: string;

  /**
   * Tipo di allegato quando il messaggio non e' testo (image, audio,
   * document, ...). In v1 il contenuto non viene scaricato: si mostra un
   * segnaposto, cosi' la cronologia resta coerente.
   */
  @Field({ nullable: true })
  @Column({ length: 50, nullable: true })
  mediaType?: string;

  @Field(() => WhatsappMessageStatus)
  @Column({
    type: 'enum',
    enum: WhatsappMessageStatus,
    // Stesso tipo enum dei log automatici: gli stati di consegna sono gli
    // stessi, cambia solo il contenuto tracciato.
    enumName: 'whatsapp_message_status_enum',
    default: WhatsappMessageStatus.PENDING,
  })
  status: WhatsappMessageStatus;

  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  evolutionMessageId?: string;

  @Field({ nullable: true })
  @Column('uuid', { nullable: true })
  correlationId?: string;

  /** Utente Keycloak che ha inviato il messaggio (solo in uscita). */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  senderUserId?: string;

  /** Nome dell'operatore mittente, per non dover risolvere l'utente a display. */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  senderName?: string;

  @Field({ nullable: true })
  @Column('text', { nullable: true })
  errorMessage?: string;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  sentAt?: Date;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  deliveredAt?: Date;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  readAt?: Date;

  @Field()
  @Column({ default: false })
  isAnonymized: boolean;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  anonymizedAt?: Date;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
