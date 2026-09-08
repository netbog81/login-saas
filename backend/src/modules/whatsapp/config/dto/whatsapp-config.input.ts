import { InputType, Field, Int } from '@nestjs/graphql';
import { WhatsappReminderEarlyPolicy } from '../../enums/whatsapp-enums';

@InputType()
export class WhatsappConfigInput {
  @Field()
  gatewayUrl: string;

  @Field()
  tenantApiId: string;

  @Field({ nullable: true })
  apiKey?: string;

  @Field({ nullable: true })
  webhookSecret?: string;

  // Chiave API dell'istanza Evolution: NON viene salvata nel DB clinico.
  // Se valorizzata, viene inoltrata al gateway che la scrive in OpenBao
  // (kv/whatsapp/{tenant}/evolution_apikey) e invalida la propria cache Redis.
  @Field({ nullable: true })
  evolutionApiKey?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  sendCancelNotification?: boolean;

  @Field({ nullable: true })
  sendUpdateNotification?: boolean;

  /**
   * Manda al paziente, insieme al recap della prenotazione, il link per
   * aggiungere i propri appuntamenti al calendario del telefono.
   */
  @Field({ nullable: true })
  patientCalendarFeedEnabled?: boolean;

  /** Finestra di raggruppamento recap in secondi (30-600). */
  @Field(() => Int, { nullable: true })
  recapBufferSeconds?: number;

  /** Invia il promemoria in fascia oraria invece che alle 24h esatte. */
  @Field({ nullable: true })
  reminderWindowEnabled?: boolean;

  /** Inizio fascia, HH:mm. */
  @Field({ nullable: true })
  reminderWindowStart?: string;

  /** Fine fascia, HH:mm. Deve essere almeno 10 minuti dopo l'inizio. */
  @Field({ nullable: true })
  reminderWindowEnd?: string;

  @Field(() => WhatsappReminderEarlyPolicy, { nullable: true })
  reminderEarlyPolicy?: WhatsappReminderEarlyPolicy;

  @Field(() => Int, { nullable: true })
  retentionDays?: number;
}
