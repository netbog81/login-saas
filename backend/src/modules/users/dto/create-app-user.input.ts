import { InputType, Field } from '@nestjs/graphql';
import { AppUserType } from '../enums/app-user-type.enum';
import { GraphQLJSONObject } from 'graphql-type-json';

@InputType()
export class CreateAppUserInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  surname?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field(() => AppUserType)
  userType: AppUserType;

  @Field(() => GraphQLJSONObject, { nullable: true })
  attributes?: Record<string, any>;
}
