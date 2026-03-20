import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateTaskMessageInput {
  @Field()
  recipientUserId: string;

  @Field()
  content: string;

  @Field({ nullable: true })
  availableFrom?: Date;
}
