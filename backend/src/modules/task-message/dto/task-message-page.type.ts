import { ObjectType, Field, Int } from '@nestjs/graphql';
import { TaskMessage } from '../entities/task-message.entity';

@ObjectType()
export class TaskMessagePage {
  @Field(() => [TaskMessage])
  items: TaskMessage[];

  @Field(() => Int)
  total: number;
}
