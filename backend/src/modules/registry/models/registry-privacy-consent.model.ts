import { Field, GraphQLISODateTime, ObjectType } from '@nestjs/graphql';

@ObjectType('RegistryPrivacyConsent')
export class RegistryPrivacyConsentModel {
  @Field()
  given: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  givenAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  revokedAt?: Date;

  @Field({ nullable: true })
  documentRef?: string;
}
