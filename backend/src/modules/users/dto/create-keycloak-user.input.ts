import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateKeycloakUserInput {
  @Field()
  email: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  username: string;

  @Field({ nullable: true })
  realmRole?: string;
}
