import { InputType, Field, ID } from '@nestjs/graphql';

@InputType()
export class LinkKeycloakUserInput {
  @Field(() => ID)
  appUserId: string;

  @Field()
  keycloakUserId: string;

  @Field()
  userMappingId: string;
}

@InputType()
export class AssignRoleInput {
  @Field(() => ID)
  appUserId: string;

  @Field(() => ID)
  roleId: string;
}

@InputType()
export class ProvisionUserInput {
  @Field(() => ID)
  appUserId: string;

  @Field()
  temporaryPassword: string;

  @Field(() => [String])
  keycloakRoles: string[];
}
