import { InputType, Field } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

@InputType()
export class UpdateAppUserInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  surname?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field(() => GraphQLJSONObject, { nullable: true })
  attributes?: Record<string, any>;
}
