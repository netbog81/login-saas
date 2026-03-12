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

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  sendCancelNotification?: boolean;

  @Field(() => Int, { nullable: true })
  retentionDays?: number;
}
