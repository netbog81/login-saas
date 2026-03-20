import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class UpdateTaskMessageInput {
  @Field({ nullable: true })
  content?: string;

  @Field({ nullable: true })
  availableFrom?: Date;
}
