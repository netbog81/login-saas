import { InputType, Field, Int } from '@nestjs/graphql';

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

  /** Finestra di raggruppamento recap in secondi (30-600). */
  @Field(() => Int, { nullable: true })
  recapBufferSeconds?: number;

  @Field(() => Int, { nullable: true })
  retentionDays?: number;
}
