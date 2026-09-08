import { InputType, Field } from '@nestjs/graphql';
import { WhatsappTemplateType } from '../../enums/whatsapp-enums';
import { NotificationChannel } from '../../notifications/entities/notification-channel-setting.entity';

@InputType()
export class WhatsappTemplateInput {
  @Field(() => WhatsappTemplateType)
  templateType: WhatsappTemplateType;

  /** Canale a cui appartiene il testo. Omesso = WhatsApp, per compatibilità. */
  @Field(() => NotificationChannel, { nullable: true })
  channel?: NotificationChannel;

  @Field()
  bodyTemplate: string;

  @Field({ nullable: true })
  footerTemplate?: string;

  /** Oggetto: solo per i template che viaggiano per posta. */
  @Field({ nullable: true })
  subjectTemplate?: string;

  @Field({ nullable: true })
  isActive?: boolean;
}
