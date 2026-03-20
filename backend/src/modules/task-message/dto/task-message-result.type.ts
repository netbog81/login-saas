import { ObjectType, Field } from '@nestjs/graphql';
import { TaskMessageStatus } from '../enums/task-message-status.enum';

@ObjectType()
export class TaskMessageResult {
  @Field()
  messageId: string;

  @Field(() => TaskMessageStatus)
  status: TaskMessageStatus;
}
