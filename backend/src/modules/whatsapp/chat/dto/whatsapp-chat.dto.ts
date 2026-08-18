import { InputType, ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { WhatsappChatMessage } from '../entities/whatsapp-chat-message.entity';
import { WhatsappConversationStatus } from '../../enums/whatsapp-enums';

/** Pagina di messaggi di una conversazione, dal piu' vecchio al piu' recente. */
@ObjectType()
export class WhatsappChatMessagePage {
  @Field(() => [WhatsappChatMessage])
  items: WhatsappChatMessage[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}

/** Filtri dell'elenco conversazioni. */
@InputType()
export class WhatsappConversationFilterInput {
  @Field(() => WhatsappConversationStatus, { nullable: true })
  @IsOptional()
  status?: WhatsappConversationStatus;

  /** Ricerca libera su nominativo, nome profilo WhatsApp o numero. */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  limit?: number;

  /**
   * Solo conversazioni con messaggi in arrivo non letti. Serve al pannello
   * "Chat in corso", che deve mostrare da solo quelle a cui rispondere.
   */
  @Field({ nullable: true })
  @IsOptional()
  unreadOnly?: boolean;
}

/**
 * Apertura di una conversazione dal calendario o dall'anagrafica: si parte
 * sempre da un numero, il paziente e' un di piu' quando lo si conosce.
 */
@InputType()
export class OpenWhatsappConversationInput {
  @Field()
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  phone: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('all')
  patientId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  patientName?: string;
}

@InputType()
export class SendWhatsappChatMessageInput {
  @Field(() => ID)
  @IsUUID('all')
  conversationId: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text: string;
}

@InputType()
export class LinkWhatsappConversationPatientInput {
  @Field(() => ID)
  @IsUUID('all')
  conversationId: string;

  /** null per scollegare il paziente dalla conversazione. */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('all')
  patientId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  patientName?: string;
}
