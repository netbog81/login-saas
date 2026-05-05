import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('RegistryContact')
export class RegistryContactModel {
  @Field(() => ID)
  id: string;

  @Field()
  contactType: string;

  @Field()
  value: string;

  @Field({ nullable: true })
  label?: string;

  @Field()
  isPrimary: boolean;

  @Field()
  verified: boolean;
}
