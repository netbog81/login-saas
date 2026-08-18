import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import {
  WhatsappChatDirection,
  WhatsappConversationStatus,
} from '../../enums/whatsapp-enums';

/**
 * Una conversazione WhatsApp con un numero di telefono.
 *
 * L'identita' della conversazione e' il NUMERO, non il paziente: la segreteria
 * riceve messaggi anche da numeri non ancora in anagrafica, e quelle chat
 * devono comunque esistere ed essere consultabili. `patientId` viene
 * valorizzato quando il numero e' riconosciuto (o collegato a mano dopo).
 */
@ObjectType('WhatsappConversation')
@Entity('whatsapp_conversations')
@Index('IDX_wa_conversations_phone', ['phoneNumber'], { unique: true })
@Index('IDX_wa_conversations_patient', ['patientId'])
@Index('IDX_wa_conversations_last_message', ['lastMessageAt'])
export class WhatsappConversation {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Numero normalizzato in sole cifre con prefisso internazionale
   * (es. 393471234567). Chiave naturale della conversazione.
   */
  @Field()
  @Column({ length: 32 })
  phoneNumber: string;

  /** Paziente collegato, se il numero e' riconosciuto in anagrafica. */
  @Field(() => ID, { nullable: true })
  @Column('uuid', { nullable: true })
  patientId?: string;

  /** Nominativo del paziente, denormalizzato per l'elenco chat. */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  patientName?: string;

  /**
   * Nome profilo WhatsApp (pushName) di chi scrive. E' l'unica etichetta
   * disponibile per i numeri non riconosciuti.
   */
  @Field({ nullable: true })
  @Column({ length: 255, nullable: true })
  contactName?: string;

  @Field(() => WhatsappConversationStatus)
  @Column({
    type: 'enum',
    enum: WhatsappConversationStatus,
    enumName: 'whatsapp_conversation_status_enum',
    default: WhatsappConversationStatus.OPEN,
  })
  status: WhatsappConversationStatus;

  @Field({ nullable: true })
  @Column('timestamptz', { nullable: true })
  lastMessageAt?: Date;

  /** Anteprima dell'ultimo messaggio, per l'elenco chat. */
  @Field({ nullable: true })
  @Column({ length: 300, nullable: true })
  lastMessagePreview?: string;

  @Field(() => WhatsappChatDirection, { nullable: true })
  @Column({
    type: 'enum',
    enum: WhatsappChatDirection,
    enumName: 'whatsapp_chat_direction_enum',
    nullable: true,
  })
  lastMessageDirection?: WhatsappChatDirection;

  /** Messaggi in arrivo non ancora letti dalla segreteria. */
  @Field(() => Int)
  @Column({ type: 'int', default: 0 })
  unreadCount: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
