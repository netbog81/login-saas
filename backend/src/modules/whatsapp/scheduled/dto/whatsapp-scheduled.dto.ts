import { ObjectType, Field, Int } from '@nestjs/graphql';

/**
 * Messaggio WhatsApp già in coda sul gateway e non ancora inviato.
 *
 * Non è un'entità: vive nella coda BullMQ del gateway, qui viene solo esposto
 * in lettura (più l'annullamento del singolo invio).
 */
@ObjectType('WhatsappScheduledMessage')
export class WhatsappScheduledMessage {
  /** Id del job BullMQ: serve per annullare l'invio. */
  @Field()
  jobId: string;

  /** reminder | update_notification | cancel_notification | recap */
  @Field()
  type: string;

  @Field()
  phone: string;

  /** Nome paziente risolto dai log del clinico (il gateway conosce solo il numero). */
  @Field({ nullable: true })
  patientName?: string;

  @Field(() => [String])
  appointmentIds: string[];

  /** Testo già composto. Assente per i recap: si compone alla chiusura della finestra. */
  @Field({ nullable: true })
  content?: string;

  /** Solo per i recap: appuntamenti già accumulati nel buffer. */
  @Field(() => Int, { nullable: true })
  bufferedCount?: number;

  /** Istante di invio previsto. */
  @Field()
  scheduledFor: Date;

  /** delayed = in attesa dell'orario, waiting = pronto a partire */
  @Field()
  state: string;
}
