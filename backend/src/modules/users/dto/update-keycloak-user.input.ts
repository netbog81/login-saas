import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class UpdateKeycloakUserInput {
  @Field(() => ID)
  keycloakUserId: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;
}
