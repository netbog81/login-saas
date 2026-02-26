import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreatePrivacyOfficerInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  surname?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  certification?: string;

  @Field({ nullable: true })
  certificationExpiry?: Date;

  @Field({ nullable: true })
  dpoRegistrationNumber?: string;
}
