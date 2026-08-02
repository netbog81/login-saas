import { InputType, Field } from '@nestjs/graphql';
import { TaskMessageRecipientGroup } from '../enums/task-message-recipient-group.enum';

@InputType()
export class CreateTaskMessageInput {
  // Esattamente uno tra recipientUserId e recipientGroup
  @Field({ nullable: true })
  recipientUserId?: string;

  @Field(() => TaskMessageRecipientGroup, { nullable: true })
  recipientGroup?: TaskMessageRecipientGroup;

  @Field()
  content: string;

  @Field({ nullable: true })
  availableFrom?: Date;
}
