import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class LinkKeycloakUserInput {
  @Field(() => ID)
  appUserId: string;

  @Field()
  keycloakUserId: string;
}

@InputType()
export class AssignRoleInput {
  @Field(() => ID)
  appUserId: string;

  @Field(() => ID)
  roleId: string;
}
