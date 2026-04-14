import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class ResetKeycloakPasswordInput {
  @Field(() => ID)
  keycloakUserId: string;

  @Field()
  newPassword: string;

  @Field({ defaultValue: true })
  temporary: boolean;
}
