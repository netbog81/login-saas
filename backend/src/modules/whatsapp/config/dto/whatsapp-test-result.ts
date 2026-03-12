import { ObjectType, Field } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class WhatsappTestResult {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  data?: any;
}
