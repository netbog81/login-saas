import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('RegistryAddress')
export class RegistryAddressModel {
  @Field(() => ID)
  id: string;

  @Field()
  addressType: string;

  @Field({ nullable: true })
  street?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  zipCode?: string;

  @Field({ nullable: true })
  province?: string;

  @Field()
  countryCode: string;

  @Field()
  isPrimary: boolean;
}
