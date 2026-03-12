import { InputType, Field, Int } from '@nestjs/graphql';
import { ObjectType } from '@nestjs/graphql';
import { WhatsappMessageStatus, WhatsappMessageType } from '../../enums/whatsapp-enums';
import { WhatsappMessageLog } from '../entities/whatsapp-message-log.entity';

@InputType()
export class WhatsappLogFilterInput {
  @Field({ nullable: true })
  patientName?: string;

  @Field(() => WhatsappMessageStatus, { nullable: true })
  status?: WhatsappMessageStatus;

  @Field(() => WhatsappMessageType, { nullable: true })
  messageType?: WhatsappMessageType;

  @Field({ nullable: true })
  dateFrom?: Date;

  @Field({ nullable: true })
  dateTo?: Date;

  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 50 })
  limit: number;
}

@ObjectType()
export class WhatsappMessageLogPage {
  @Field(() => [WhatsappMessageLog])
  items: WhatsappMessageLog[];

  @Field(() => Int)
  total: number;
}
