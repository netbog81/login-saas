import { InputType, Field } from '@nestjs/graphql';
import { WhatsappTemplateType } from '../../enums/whatsapp-enums';

@InputType()
export class WhatsappTemplateInput {
  @Field(() => WhatsappTemplateType)
  templateType: WhatsappTemplateType;

  @Field()
  bodyTemplate: string;

  @Field({ nullable: true })
  footerTemplate?: string;

  @Field({ nullable: true })
  isActive?: boolean;
}
